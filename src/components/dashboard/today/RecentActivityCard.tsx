import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { getRecentActivity } from '@/services/notificationsService';
import { formatRelative } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { ActivityEvent, ActivityKind } from '@/lib/insights';

const PREVIEW_COUNT = 5;

// Same vocabulary as NotificationsPage's full activity feed, kept local
// since this card only ever shows a short preview of it.
const KIND_LABELS: Record<ActivityKind, string> = {
  created: 'New booking',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  completed: 'Payment received',
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

/** What's happened lately, derived live from appointment timestamps — same source as NotificationsPage. */
export function RecentActivityCard({
  timezone,
  className,
}: {
  timezone: string;
  className?: string;
}): JSX.Element {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  useEffect(() => {
    getRecentActivity(timezone)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [timezone]);

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          Recent notifications
        </h2>
        <Link
          to={routes.owner.notifications}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {!events && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {events && events.length === 0 && (
        <EmptyState title="Nothing recent" description="New activity will show up here." />
      )}

      <ul className="space-y-3">
        {events?.slice(0, PREVIEW_COUNT).map((event) => (
          <li key={event.id} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOTS[event.kind]}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                <span className="font-medium">{KIND_LABELS[event.kind]}</span>
                {' from '}
                {event.customerName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRelative(event.at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
