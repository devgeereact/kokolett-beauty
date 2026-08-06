import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AppointmentCard } from '@/components/dashboard/AppointmentCard';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAppointments } from '@/hooks/useAppointments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { setAppointmentStatus } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { addDays, formatDateShort, salonDayRange, toSalonDate } from '@/lib/format';
import { LIVE_STATUSES, type AppointmentDetailed, type AppointmentStatus } from '@/types';

const RANGES = [
  { key: '7', label: 'Next 7 days', days: 7 },
  { key: '30', label: 'Next 30 days', days: 30 },
  { key: '-7', label: 'Last 7 days', days: -7 },
] as const;

/** Appointments across a window, grouped by salon-local day. */
export function AppointmentsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [rangeKey, setRangeKey] = useState<string>('7');
  const [statusFilter, setStatusFilter] = useState<string>('live');

  const { from, to } = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 7;
    const today = toSalonDate(new Date(), timezone);
    const startDate = days < 0 ? addDays(today, days) : today;
    const endDate = days < 0 ? today : addDays(today, days);
    return {
      from: salonDayRange(startDate, timezone).start,
      to: salonDayRange(endDate, timezone).end,
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

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentDetailed[]>();
    for (const a of appointments) {
      const key = toSalonDate(a.starts_at, timezone);
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    return [...map.entries()];
  }, [appointments, timezone]);

  const changeStatus = async (id: string, status: AppointmentStatus): Promise<void> => {
    try {
      await setAppointmentStatus(id, status);
      await refresh();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  return (
    <DashboardLayout
      title="Appointments"
      subtitle="Everything booked, past and future"
      actions={
        <Button variant="ghost" size="sm" onClick={() => void refresh()}>
          Refresh
        </Button>
      }
    >
      <div className="mb-6 grid gap-x-4 sm:grid-cols-2 lg:max-w-xl">
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
      </div>

      {loading && <LoadingState label="Loading appointments…" />}
      {error && <ErrorState error={error} onRetry={() => void refresh()} />}

      {!loading && !error && appointments.length === 0 && (
        <EmptyState
          title="Nothing in this period"
          description="Try a wider period, or a different status filter."
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
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
