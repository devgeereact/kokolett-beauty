import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AppointmentDetailModal } from '@/components/dashboard/AppointmentDetailModal';
import { ScheduleTimeline } from '@/components/dashboard/today/ScheduleTimeline';
import { NextUpCard } from '@/components/dashboard/today/NextUpCard';
import { GlanceGrid } from '@/components/dashboard/today/GlanceGrid';
import { ApprovalsQueueCard } from '@/components/dashboard/today/ApprovalsQueueCard';
import { TodayDateTimeCard } from '@/components/dashboard/today/TodayDateTimeCard';
import { BookingsOverviewChart } from '@/components/dashboard/today/BookingsOverviewChart';
import { AvailabilityRequestsCard } from '@/components/dashboard/today/AvailabilityRequestsCard';
import { PaymentReconciliationCard } from '@/components/dashboard/today/PaymentReconciliationCard';
import { AssistantInsightsRow } from '@/components/dashboard/today/AssistantInsightsRow';
import { ReschedulePicker } from '@/components/public/ReschedulePicker';
import {
  NewBookingPanel,
  type PrefilledCustomer,
} from '@/components/dashboard/NewBookingPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useOwnerSummary } from '@/hooks/useOwnerSummary';
import { useAppointments } from '@/hooks/useAppointments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments';
import { useSalonToday } from '@/hooks/useSalonToday';
import { useLiveClock } from '@/hooks/useLiveClock';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  setAppointmentStatus,
  setOwnerNote,
  rescheduleAppointmentAsOwner,
} from '@/services/appointmentService';
import { logPayment } from '@/services/paymentService';
import { getProfile } from '@/services/profileService';
import { getRecentActivity } from '@/services/notificationsService';
import {
  formatDateLong,
  formatTime,
  greetingForHour,
  minutesSinceMidnight,
} from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { findNextUpcoming } from '@/lib/insights';
import { routes } from '@/lib/routes';
import { statusLabel } from '@/lib/status';
import { LIVE_STATUSES, type AppointmentStatus } from '@/types';

/**
 * The dashboard opens on today's schedule — the question the owner actually has
 * when she picks up her phone between clients.
 *
 * "Today" is the salon's day, not the browser's: `useSalonToday` anchors to the
 * salon timezone so an owner abroad still sees the same day her clients booked,
 * and re-derives it on rollover so a tablet left open overnight moves on too.
 * That's also why this page never grew day-to-day navigation — Calendar already
 * owns browsing other dates; this one screen is deliberately always "today".
 */
export function TodayPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { summary, refresh: refreshSummary } = useOwnerSummary();
  const { user } = useSupabaseAuth();

  const [firstName, setFirstName] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => setFirstName(p?.full_name?.split(' ')[0] ?? null))
      .catch(() => setFirstName(null));
  }, [user]);

  // Header bell badge — last 24h of activity, since there's no read/unread
  // state to count instead.
  const [recentNotificationCount, setRecentNotificationCount] = useState(0);
  useEffect(() => {
    getRecentActivity(timezone, 1)
      .then((events) => setRecentNotificationCount(events.length))
      .catch(() => setRecentNotificationCount(0));
  }, [timezone]);

  // Recomputed on rollover, not frozen at mount — this screen is left open on a
  // salon tablet overnight.
  const { start, end } = useSalonToday(timezone);
  const now = useLiveClock();
  const statuses = useMemo<AppointmentStatus[]>(() => [...LIVE_STATUSES], []);
  const { appointments, loading, error, refresh } = useAppointments({
    from: start,
    to: end,
    statuses,
  });

  // "Next up" isn't bounded to today — a quiet afternoon with only one
  // booking left should still show two by reaching into tomorrow, so this
  // queries a 60-day horizon independent of the today-only list above.
  // `now` deliberately isn't in this hook's own range (it ticks every
  // second); `findNextUpcoming` below does the ">now" filtering against
  // this already-fetched pool instead, so the query itself stays stable.
  const upcomingHorizon = useMemo(
    () => new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000),
    [start],
  );
  const upcomingStatuses = useMemo<AppointmentStatus[]>(
    () => ['confirmed', 'checked_in'],
    [],
  );
  const { appointments: upcomingPool, refresh: refreshUpcoming } = useAppointments({
    from: start,
    to: upcomingHorizon,
    statuses: upcomingStatuses,
  });

  // A booking taken on the website while this screen is open must appear here.
  const onRealtimeChange = useCallback(() => {
    void refresh();
    void refreshUpcoming();
    void refreshSummary();
  }, [refresh, refreshUpcoming, refreshSummary]);
  const { connected } = useRealtimeAppointments(onRealtimeChange);

  const [booking, setBooking] = useState(false);
  const [prefill, setPrefill] = useState<PrefilledCustomer | null>(null);
  const [justBooked, setJustBooked] = useState<string | null>(null);
  const [rescheduleInitial, setRescheduleInitial] = useState<{
    initialStartsAt?: string;
    initialDurationMin?: number;
    initialNote?: string;
  } | null>(null);

  // Which schedule row is expanded to its full detail popup.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reschedule picker state (compact flow for owners)
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const { showToast } = useToast();

  // Replaces the page-local `lastAction` banner + hand-rolled 8s setTimeout
  // this used to be: a Toast with an Undo action generalises exactly that
  // interaction.
  const changeStatus = useCallback(
    async (id: string, status: AppointmentStatus): Promise<void> => {
      try {
        // find previous status from the local list so we can allow Undo
        const app = appointments.find((a) => a.id === id);
        if (!app) {
          // fallback: perform the change without undo
          await setAppointmentStatus(id, status);
          await Promise.all([refresh(), refreshSummary()]);
          return;
        }
        const prevStatus = app.status;

        await setAppointmentStatus(id, status);
        await Promise.all([refresh(), refreshSummary()]);

        showToast({
          message: `Action applied: ${statusLabel(status)}.`,
          action: {
            label: 'Undo',
            onClick: () => {
              void (async (): Promise<void> => {
                try {
                  await setAppointmentStatus(id, prevStatus);
                  await Promise.all([refresh(), refreshSummary()]);
                } catch (e) {
                  showToast({ message: errorMessage(e) });
                }
              })();
            },
          },
        });
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [appointments, refresh, refreshSummary, showToast],
  );

  const logPaymentHandler = useCallback(
    async (
      id: string,
      amountPence: number,
      note: string,
      correctsPaymentId?: string,
    ): Promise<void> => {
      try {
        await logPayment(id, amountPence, note, correctsPaymentId);
        await Promise.all([refresh(), refreshSummary()]);
      } catch (e) {
        showToast({ message: errorMessage(e) });
        throw e;
      }
    },
    [refresh, refreshSummary, showToast],
  );

  const saveNote = useCallback(
    async (id: string, note: string): Promise<void> => {
      try {
        await setOwnerNote(id, note);
        await refresh();
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [refresh, showToast],
  );

  const doOwnerReschedule = useCallback(
    async (id: string, startsAt: string): Promise<void> => {
      setMoveBusy(true);
      setMoveError(null);
      try {
        await rescheduleAppointmentAsOwner(id, new Date(startsAt));
        setMovingId(null);
        showToast({ message: 'Appointment rescheduled.' });
        await Promise.all([refresh(), refreshSummary()]);
      } catch (e) {
        setMoveError(errorMessage(e));
      } finally {
        setMoveBusy(false);
      }
    },
    [refresh, refreshSummary, showToast],
  );

  const greeting = greetingForHour(Math.floor(minutesSinceMidnight(now, timezone) / 60));
  const nextUpcoming = useMemo(
    () => findNextUpcoming(upcomingPool, now, 2),
    [upcomingPool, now],
  );
  const expandedAppointment = appointments.find((a) => a.id === expandedId) ?? null;

  return (
    <DashboardLayout
      title={firstName ? `${greeting}, ${firstName} 👋` : greeting}
      subtitle="Here's what's happening at your salon today."
      badges={{
        // Separate counts for the sidebar's Approvals and Availability
        // Requests rows — matches the "Awaiting approval" stat card directly
        // below and InboxPage's own per-tab counts.
        approvals: summary?.pending_approval_count ?? 0,
        requests: summary?.new_request_count ?? 0,
        notifications: recentNotificationCount,
      }}
      actions={
        <div className="flex items-center gap-3">
          <span
            className="hidden font-mono text-sm font-medium tabular-nums text-foreground md:inline"
            aria-label="Current time"
          >
            {formatTime(now, timezone)}
          </span>
          <span
            className="hidden items-center gap-2 text-xs text-muted-foreground md:inline-flex"
            title={connected ? 'Live updates connected' : 'Live updates unavailable'}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-status-completed' : 'bg-status-cancelled'}`}
              aria-hidden="true"
            />
            {connected ? 'Live' : 'Offline'}
          </span>

          <div className="ml-2 inline-flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refresh();
                void refreshUpcoming();
              }}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPrefill(null);
                setBooking(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              New booking
            </Button>
          </div>
        </div>
      }
    >
      {justBooked && (
        <div className="mb-6 rounded-lg border border-status-completed p-4 text-sm">
          <p className="font-medium text-foreground">Booked. Reference {justBooked}.</p>
          <p className="mt-1 text-muted-foreground">
            Their confirmation email is on its way, with a link they can use to change or
            cancel it themselves.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        <Card className="flex h-full min-h-0 flex-col p-4 lg:col-span-3 lg:row-span-2">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-base font-semibold text-foreground">
                Today&rsquo;s schedule
              </h2>
              <p className="text-xs text-muted-foreground">
                {formatDateLong(start, timezone)}
              </p>
            </div>
            {/* Same plain-text header link every other card uses (View all /
                View list / …) — the bordered button this used to be sat
                heavier than its siblings and squeezed the title onto two
                lines in this narrower column. */}
            <Link
              to={routes.owner.calendar}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              View calendar
            </Link>
          </div>

          {loading && <LoadingState label="Loading today's appointments…" />}
          {error && <ErrorState error={error} onRetry={() => void refresh()} />}

          {!loading && !error && (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <ScheduleTimeline
                appointments={appointments}
                timezone={timezone}
                nextUpId={nextUpcoming[0]?.id ?? null}
                expandedId={expandedId}
                onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              />
              {/* The hour grid renders regardless of whether today has any
                  bookings — an empty day is still today's calendar, not a
                  reason to hide it. The empty-state message sits as an
                  overlay on top of that grid rather than replacing it. */}
              {appointments.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                  <div className="pointer-events-auto rounded-md bg-card">
                    <EmptyState
                      title="Nothing booked today"
                      description="When a customer books online it will appear here straight away."
                      action={
                        <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                          Refresh
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reschedule stays an inline panel, not a popup — it's opened from
              inside the Edit popup, so closing that popup first (below) keeps
              it from appearing behind the overlay. */}
          {expandedAppointment && movingId === expandedAppointment.id && (
            <div className="mt-3">
              <ReschedulePicker
                currentStartsAt={expandedAppointment.starts_at}
                busy={moveBusy}
                error={moveError}
                onCancel={() => {
                  setMovingId(null);
                  setMoveError(null);
                }}
                onChoose={(startsAt) =>
                  void doOwnerReschedule(expandedAppointment.id, startsAt)
                }
              />
            </div>
          )}

          {!loading && !error && appointments.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                {appointments.length} appointment{appointments.length === 1 ? '' : 's'}
              </span>
              <Link
                to={routes.owner.appointments}
                className="text-xs font-medium text-primary hover:underline"
              >
                View full day
              </Link>
            </div>
          )}
        </Card>

        <NextUpCard
          className="lg:col-span-3"
          appointments={nextUpcoming}
          timezone={timezone}
          now={now}
          onViewDetails={(id) => setExpandedId(id)}
        />
        {/* One lg:col-span-6 wrapper standing in for the two lg:col-span-3
            cells Today at a glance / Approvals queue used to occupy
            directly — same total column width, so row 1's flow (and every
            card after it) lands exactly where it did before. The date/time
            strip's own height comes out of the flex-1 row below it, which is
            why it doesn't grow the row. */}
        <div className="flex h-full min-h-0 flex-col gap-4 lg:col-span-6">
          <TodayDateTimeCard now={now} timezone={timezone} />
          <div className="flex min-h-0 flex-1 gap-4">
            <GlanceGrid
              className="flex-1"
              appointments={appointments}
              todayCount={summary?.today_count ?? null}
              collectedPence={summary?.today_collected_pence ?? null}
              timezone={timezone}
            />
            <ApprovalsQueueCard className="flex-1" />
          </div>
        </div>

        {/* Row 2 is 9 wide, not 12: the schedule card above is `lg:row-span-2`
            and still holds columns 1 to 3 here. A span-6 chart left columns 10
            to 12 empty and pushed the next card onto its own row, so the page
            carried a hole in the middle and a half-width card alone at the
            bottom. */}
        <BookingsOverviewChart className="lg:col-span-9" timezone={timezone} />

        {/* A matched pair, both lg:col-span-6, sharing a full row of their own.
            The grid's `lg:items-stretch` sizes the taller of the two and both
            cards carry `flex h-full flex-col`, so their top and bottom edges
            line up whatever each one happens to contain that day. */}
        <PaymentReconciliationCard className="lg:col-span-6" />
        <AssistantInsightsRow className="lg:col-span-6" timezone={timezone} />

        <AvailabilityRequestsCard className="lg:col-span-12" />
      </div>

      <Modal
        open={expandedId !== null && movingId === null}
        onClose={() => setExpandedId(null)}
        ariaLabel="Edit appointment"
        className="max-w-modal-lg"
      >
        {expandedAppointment && (
          <AppointmentDetailModal
            appointment={expandedAppointment}
            timezone={timezone}
            onClose={() => setExpandedId(null)}
            onStatusChange={changeStatus}
            onNoteSave={saveNote}
            onLogPayment={logPaymentHandler}
            onBookFollowUp={(a) => {
              setPrefill({
                fullName: a.customer_name ?? '',
                email: a.customer_email ?? '',
                mobile: a.customer_mobile ?? '',
              });
              setJustBooked(null);
              setExpandedId(null);
              setBooking(true);
            }}
            onMove={(a) => {
              setMovingId(a.id);
              setMoveError(null);
            }}
          />
        )}
      </Modal>

      <Modal open={booking} onClose={() => setBooking(false)} ariaLabel="New booking">
        <NewBookingPanel
          prefill={prefill}
          initialStartsAt={rescheduleInitial?.initialStartsAt}
          initialDurationMin={rescheduleInitial?.initialDurationMin}
          initialNote={rescheduleInitial?.initialNote}
          onClose={() => {
            setBooking(false);
            setRescheduleInitial(null);
          }}
          onBooked={(reference) => {
            setBooking(false);
            setRescheduleInitial(null);
            setJustBooked(reference);
            void refresh();
            void refreshSummary();
          }}
        />
      </Modal>
    </DashboardLayout>
  );
}
