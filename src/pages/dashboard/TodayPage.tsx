import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AppointmentCard } from '@/components/dashboard/AppointmentCard';
import { ReschedulePicker } from '@/components/public/ReschedulePicker';
import { NewBookingPanel, type PrefilledCustomer } from '@/components/dashboard/NewBookingPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useOwnerSummary } from '@/hooks/useOwnerSummary';
import { useAppointments } from '@/hooks/useAppointments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments';
import { useSalonToday } from '@/hooks/useSalonToday';
import { useLiveClock } from '@/hooks/useLiveClock';
import { setAppointmentStatus, createAppointmentAsOwner } from '@/services/appointmentService';
import { formatDateLong, formatMoney, formatTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { LIVE_STATUSES, type AppointmentStatus } from '@/types';

/**
 * The dashboard opens on today's schedule — the question the owner actually has
 * when she picks up her phone between clients.
 *
 * "Today" is the salon's day, not the browser's: `useSalonToday` anchors to the
 * salon timezone so an owner abroad still sees the same day her clients booked,
 * and re-derives it on rollover so a tablet left open overnight moves on too.
 */
export function TodayPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { summary, refresh: refreshSummary } = useOwnerSummary();

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

  // A booking taken on the website while this screen is open must appear here.
  const onRealtimeChange = useCallback(() => {
    void refresh();
    void refreshSummary();
  }, [refresh, refreshSummary]);
  const { connected } = useRealtimeAppointments(onRealtimeChange);

  const [booking, setBooking] = useState(false);
  const [prefill, setPrefill] = useState<PrefilledCustomer | null>(null);
  const [justBooked, setJustBooked] = useState<string | null>(null);
  const [rescheduleInitial, setRescheduleInitial] = useState<{
    initialStartsAt?: string;
    initialDurationMin?: number;
    initialNote?: string;
  } | null>(null);

  // Reschedule picker state (compact flow for owners)
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [movedReference, setMovedReference] = useState<string | null>(null);

  const [lastAction, setLastAction] = useState<{
    id: string;
    prevStatus: AppointmentStatus;
    newStatus: AppointmentStatus;
  } | null>(null);

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
        const prev = app.status;

        await setAppointmentStatus(id, status);
        await Promise.all([refresh(), refreshSummary()]);

        // show undo banner
        setLastAction({ id, prevStatus: prev, newStatus: status });
        // auto-dismiss after 8s
        setTimeout(() => setLastAction((cur) => (cur && cur.id === id ? null : cur)), 8000);
      } catch (e) {
        window.alert(errorMessage(e));
      }
    },
    [appointments, refresh, refreshSummary],
  );

  const undoLast = useCallback(async (): Promise<void> => {
    if (!lastAction) return;
    try {
      await setAppointmentStatus(lastAction.id, lastAction.prevStatus);
      await Promise.all([refresh(), refreshSummary()]);
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setLastAction(null);
    }
  }, [lastAction, refresh, refreshSummary]);

  const doOwnerReschedule = useCallback(
    async (id: string, startsAt: string): Promise<void> => {
      setMoveBusy(true);
      setMoveError(null);
      try {
        const app = appointments.find((a) => a.id === id);
        if (!app) throw new Error('Original appointment not found');
        const durationMin = Math.round((new Date(app.ends_at).getTime() - new Date(app.starts_at).getTime()) / 60000);
        const ownerBooking = await createAppointmentAsOwner({
          startsAt: new Date(startsAt),
          fullName: app.customer_name ?? '',
          email: app.customer_email ?? '',
          mobile: app.customer_mobile ?? undefined,
          durationMin,
          note: `Reschedule of ${app.reference}`,
        });
        setMovedReference(ownerBooking.reference ?? null);
        setMovingId(null);
        await Promise.all([refresh(), refreshSummary()]);
      } catch (e) {
        setMoveError(errorMessage(e));
      } finally {
        setMoveBusy(false);
      }
    },
    [appointments, refresh, refreshSummary],
  );

  const stats = [
    { label: 'Booked today', value: summary ? String(summary.today_count) : '—' },
    {
      label: 'Expected takings',
      value: summary ? formatMoney(summary.today_revenue_pence) : '—',
    },
    {
      label: 'Awaiting approval',
      value: summary ? String(summary.pending_approval_count) : '—',
      to: routes.owner.approvals,
      urgent: (summary?.urgent_approval_count ?? 0) > 0,
    },
    {
      label: 'New enquiries',
      value: summary ? String(summary.new_request_count) : '—',
      to: routes.owner.requests,
    },
  ];

  return (
    <DashboardLayout
      title="Today"
      subtitle={formatDateLong(start, timezone)}
      badges={{
        approvals: summary?.pending_approval_count,
        requests: summary?.new_request_count,
      }}
      actions={
        <div className="flex items-center gap-3">
          <span
            className="hidden font-mono text-sm font-medium tabular-nums text-foreground sm:inline"
            aria-label="Current time"
          >
            {formatTime(now, timezone)}
          </span>
          <span
            className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
            title={connected ? 'Live updates connected' : 'Live updates unavailable'}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-status-completed' : 'bg-status-cancelled'}`}
              aria-hidden="true"
            />
            {connected ? 'Live' : 'Offline'}
          </span>

          <div className="ml-2 inline-flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPrefill(null);
                setBooking(true);
              }}
            >
              New booking
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const body = (
            <Card className="h-full p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
              {stat.urgent && (
                <p className="mt-1 text-xs font-medium text-status-pending">
                  Some expire within 2 hours
                </p>
              )}
            </Card>
          );
          return stat.to ? (
            <Link
              key={stat.label}
              to={stat.to}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {body}
            </Link>
          ) : (
            <div key={stat.label}>{body}</div>
          );
        })}
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
        Today&rsquo;s schedule
      </h2>

      {lastAction && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-border bg-muted p-3">
          <p className="text-sm">
            Action applied — <span className="font-medium">{lastAction.newStatus}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => void undoLast()}>
              Undo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setLastAction(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {loading && <LoadingState label="Loading today's appointments…" />}
      {error && <ErrorState error={error} onRetry={() => void refresh()} />}

      {!loading && !error && appointments.length === 0 && (
        <EmptyState
          title="Nothing booked today"
          description="When a customer books online it will appear here straight away."
          action={
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />
      )}

      {booking && (
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
      )}

      {justBooked && (
        <div className="mb-6 rounded-lg border border-status-completed p-4 text-sm">
          <p className="font-medium text-foreground">Booked. Reference {justBooked}.</p>
          <p className="mt-1 text-muted-foreground">
            Their confirmation email is on its way, with a link they can use to change or
            cancel it themselves.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {appointments.map((appointment) => (
          <div key={appointment.id}>
            <AppointmentCard
              appointment={appointment}
              timezone={timezone}
              onStatusChange={changeStatus}
              onBookFollowUp={(a) => {
                setPrefill({
                  fullName: a.customer_name ?? '',
                  email: a.customer_email ?? '',
                  mobile: a.customer_mobile ?? '',
                });
                setJustBooked(null);
                setBooking(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onReschedule={(a) => {
                // Open the compact reschedule picker inline for quick owner reschedules.
                setMovingId(a.id);
                setMoveError(null);
                setMovedReference(null);
              }}
            />

            {movingId === appointment.id && (
              <div className="mt-3">
                <ReschedulePicker
                  currentStartsAt={appointment.starts_at}
                  busy={moveBusy}
                  error={moveError}
                  onCancel={() => {
                    setMovingId(null);
                    setMoveError(null);
                  }}
                  onChoose={(startsAt) => void doOwnerReschedule(appointment.id, startsAt)}
                />
              </div>
            )}

            {movedReference && (
              <div className="mt-2 rounded-md border border-status-completed p-3 text-sm">
                <p className="font-medium text-foreground">Replacement booked — reference {movedReference}.</p>
                <p className="mt-1 text-muted-foreground">The original booking is left intact; cancel or mark it as appropriate.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
