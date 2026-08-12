import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { getRecentActivity } from '@/services/notificationsService';
import { formatRelative } from '@/lib/format';
import type { ActivityEvent, ActivityKind } from '@/lib/insights';

const KIND_LABELS: Record<ActivityKind, string> = {
  created: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  completed: 'Completed',
  no_show: 'No show',
};

const KIND_DOTS: Record<ActivityKind, string> = {
  created: 'bg-status-confirmed',
  rescheduled: 'bg-status-pending',
  cancelled: 'bg-status-cancelled',
  rejected: 'bg-status-cancelled',
  completed: 'bg-status-completed',
  no_show: 'bg-status-no-show',
};

function EventRow({ event }: { event: ActivityEvent }): JSX.Element {
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOTS[event.kind]}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{KIND_LABELS[event.kind]}</span>
          {' — '}
          {event.customerName}
          {event.reference && (
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
              {event.reference}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {event.detail} · {formatRelative(event.at)}
        </p>
      </div>
    </li>
  );
}

/**
 * What's happened lately, derived live from appointment and waitlist
 * timestamps — there is no stored notifications table, so nothing here
 * can be marked read or dismissed. It's a window onto the data, not a log.
 */
export function NotificationsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getRecentActivity(timezone)
      .then(setEvents)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  return (
    <DashboardLayout title="Notifications" subtitle="Last 14 days">
      {error && <ErrorState error={error} onRetry={load} />}
      {!error && !events && <LoadingState label="Gathering recent activity…" />}
      {events && events.length === 0 && (
        <EmptyState
          title="Nothing recent"
          description="New bookings, cancellations, and completions from the last 14 days will show up here."
        />
      )}
      {events && events.length > 0 && (
        <Card className="p-5">
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </Card>
      )}
    </DashboardLayout>
  );
}
