import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { getScheduleConflicts } from '@/services/assistantService';
import { formatDateLong, formatTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { ScheduleConflict } from '@/lib/insights';
import type { AppointmentDetailed } from '@/types';

function Summary({
  appointment,
  timezone,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
}): JSX.Element {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-border p-3">
      <p className="truncate font-medium text-foreground">
        {appointment.customer_name ?? 'Customer'}
      </p>
      <p className="text-sm text-muted-foreground">
        {formatTime(appointment.starts_at, timezone)}–
        {formatTime(appointment.ends_at, timezone)}
        {' · '}
        {appointment.source === 'owner' ? 'Phone / walk-in' : 'Online'}
      </p>
    </div>
  );
}

/**
 * Overlapping live appointments on the same day.
 *
 * `appointments_no_overlap` forbids two web bookings from ever colliding, so
 * this only ever fires when a walk-in was deliberately placed over a booked
 * time (`create_appointment_as_owner` skips that constraint on purpose).
 */
export function ConflictDetectionPanel({ timezone }: { timezone: string }): JSX.Element {
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getScheduleConflicts(timezone)
      .then(setConflicts)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!conflicts) return <LoadingState label="Checking the next 14 days…" />;
  if (conflicts.length === 0) {
    return (
      <EmptyState
        title="No conflicts"
        description="Nothing overlaps in the next 14 days. This only ever fires when a phone or walk-in booking lands on an already-booked time."
      />
    );
  }

  return (
    <div className="space-y-3">
      {conflicts.map((c) => (
        <Card key={`${c.a.id}-${c.b.id}`} className="p-4">
          <p className="mb-3 text-sm font-medium text-destructive">
            {formatDateLong(`${c.date}T12:00:00Z`, 'UTC')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Summary appointment={c.a} timezone={timezone} />
            <Summary appointment={c.b} timezone={timezone} />
          </div>
          <Link
            to={routes.owner.calendar}
            className="mt-3 inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Open the calendar
          </Link>
        </Card>
      ))}
    </div>
  );
}
