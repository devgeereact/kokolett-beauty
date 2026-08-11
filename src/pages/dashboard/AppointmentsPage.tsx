import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AppointmentCard } from '@/components/dashboard/AppointmentCard';
import {
  NewBookingPanel,
  type PrefilledCustomer,
} from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAppointments } from '@/hooks/useAppointments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { setAppointmentStatus, setOwnerNote } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { addDays, formatDateShort, salonDayRange, toSalonDate } from '@/lib/format';
import { LIVE_STATUSES, type AppointmentDetailed, type AppointmentStatus } from '@/types';

/**
 * Every booking in a window, and the two things the owner actually does here:
 * mark a day off as done, and write down what happened so next time is easier.
 *
 * The counters at the top exist to answer a question the list cannot: how much
 * of this period is still outstanding. A page of cards tells you what is booked;
 * it does not tell you that four of last week's appointments were never closed
 * off, which is exactly the state that leaves customers without their thank-you
 * email and the salon without a record.
 */
const RANGES = [
  { key: 'today', label: 'Today', from: 0, to: 1 },
  { key: '7', label: 'Next 7 days', from: 0, to: 7 },
  { key: '30', label: 'Next 30 days', from: 0, to: 30 },
  { key: '-7', label: 'Last 7 days', from: -7, to: 0 },
  { key: '-30', label: 'Last 30 days', from: -30, to: 0 },
] as const;

export function AppointmentsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [rangeKey, setRangeKey] = useState<string>('7');
  const [statusFilter, setStatusFilter] = useState<string>('live');
  const [search, setSearch] = useState('');
  const [booking, setBooking] = useState(false);
  const [prefill, setPrefill] = useState<PrefilledCustomer | null>(null);
  const [justBooked, setJustBooked] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
    const today = toSalonDate(new Date(), timezone);
    return {
      from: salonDayRange(addDays(today, range.from), timezone).start,
      to: salonDayRange(addDays(today, Math.max(range.to - 1, range.from)), timezone).end,
    };
  }, [rangeKey, timezone]);

  const statuses = useMemo<AppointmentStatus[] | undefined>(() => {
    if (statusFilter === 'all') return undefined;
    if (statusFilter === 'live') return [...LIVE_STATUSES];
    return [statusFilter as AppointmentStatus];
  }, [statusFilter]);

  const { appointments, loading, error, refresh } = useAppointments({
    from,
    to,
    statuses,
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((a) =>
      [a.customer_name, a.customer_email, a.customer_mobile, a.reference]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [appointments, search]);

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      total: appointments.length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      // A booking whose time has come and gone but is still sitting as
      // confirmed. This is the number the owner is meant to act on.
      unclosed: appointments.filter(
        (a) =>
          new Date(a.ends_at).getTime() < now &&
          ['confirmed', 'checked_in', 'in_service'].includes(a.status),
      ).length,
      firstVisits: appointments.filter((a) => a.customer_completed_count === 0).length,
    };
  }, [appointments]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentDetailed[]>();
    for (const a of visible) {
      const key = toSalonDate(a.starts_at, timezone);
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    return [...map.entries()];
  }, [visible, timezone]);

  const changeStatus = async (id: string, status: AppointmentStatus): Promise<void> => {
    try {
      await setAppointmentStatus(id, status);
      await refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const saveNote = async (id: string, note: string): Promise<void> => {
    try {
      await setOwnerNote(id, note);
      await refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const stats: { label: string; value: number; tone?: 'warn' }[] = [
    { label: 'Bookings', value: counts.total },
    { label: 'Completed', value: counts.completed },
    { label: 'Needs closing off', value: counts.unclosed, tone: 'warn' },
    { label: 'First visits', value: counts.firstVisits },
  ];

  return (
    <DashboardLayout
      title="Appointments"
      subtitle="Mark them complete and keep your notes"
      actions={
        <>
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
        </>
      }
    >
      {booking && (
        <NewBookingPanel
          prefill={prefill}
          onClose={() => setBooking(false)}
          onBooked={(reference) => {
            setBooking(false);
            setJustBooked(reference);
            setSearch(reference);
            void refresh();
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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p
              className={
                s.tone === 'warn' && s.value > 0
                  ? 'font-display text-2xl font-semibold text-status-pending'
                  : 'font-display text-2xl font-semibold text-foreground'
              }
            >
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {counts.unclosed > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-muted p-4 text-sm">
          <p className="text-foreground">
            {counts.unclosed}{' '}
            {counts.unclosed === 1 ? 'appointment has' : 'appointments have'} passed
            without being marked complete.
          </p>
          <p className="mt-1 text-muted-foreground">
            Completing one sends the customer their thank-you email and counts them as a
            returning customer, so their next booking is confirmed instantly.
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-x-4 sm:grid-cols-3">
        <Field label="Period">
          {({ id }) => (
            <Select
              id={id}
              value={rangeKey}
              onChange={(e) => setRangeKey(e.target.value)}
            >
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {({ id }) => (
            <Select
              id={id}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="live">Live bookings</option>
              <option value="all">Everything</option>
              <option value="pending_approval">Awaiting approval</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No shows</option>
            </Select>
          )}
        </Field>
        <Field label="Find someone" hint="Name, email, mobile or reference.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="search"
              placeholder="Koko, KB-XXXX…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Field>
      </div>

      {loading && <LoadingState label="Loading appointments…" />}
      {error && <ErrorState error={error} onRetry={() => void refresh()} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={search ? 'Nobody matches that' : 'Nothing in this period'}
          description={
            search
              ? 'Try part of a name, or the booking reference.'
              : 'Try a wider period, or a different status filter.'
          }
        />
      )}

      <div className="space-y-8">
        {grouped.map(([date, rows]) => (
          <section key={date}>
            <h2 className="mb-3 font-display text-base font-semibold text-foreground">
              {formatDateShort(`${date}T12:00:00Z`, timezone)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {rows.length} {rows.length === 1 ? 'booking' : 'bookings'}
              </span>
            </h2>
            <div className="space-y-3">
              {rows.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  timezone={timezone}
                  onStatusChange={changeStatus}
                  onNoteSave={saveNote}
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
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
