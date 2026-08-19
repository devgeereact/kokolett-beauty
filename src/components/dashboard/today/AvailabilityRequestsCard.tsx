import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Inbox, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { listAllRequests, listQueuedRequests } from '@/services/requestService';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface RequestBucket {
  key: string;
  icon: LucideIcon;
  iconTone: string;
  label: string;
  description: string;
  count: number;
}

/**
 * The availability-request queue, grouped by where each one stands —
 * `listQueuedRequests` for the open lane (new / awaiting response),
 * `listAllRequests` for how the answered ones landed. Same two calls
 * `InboxPage`'s Requests tab and `RequestsPanel` already use.
 */
export function AvailabilityRequestsCard({
  className,
}: {
  className?: string;
}): JSX.Element {
  const [counts, setCounts] = useState<{
    new: number;
    awaiting: number;
    converted: number;
    declined: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([listQueuedRequests(), listAllRequests()])
      .then(([queued, answered]) => {
        setCounts({
          new: queued.filter((r) => r.status === 'new').length,
          awaiting: queued.filter((r) => r.status === 'awaiting_response').length,
          converted: answered.filter((r) => r.status === 'converted').length,
          declined: answered.filter((r) => r.status === 'declined').length,
        });
      })
      .catch(() => setCounts({ new: 0, awaiting: 0, converted: 0, declined: 0 }));
  }, []);

  const requestsHref = `${routes.owner.inbox}?tab=requests`;

  const buckets: RequestBucket[] = counts
    ? [
        {
          key: 'new',
          icon: Inbox,
          // Explicit color-mix() tokens (docs/DESIGN.md §7), not an opacity
          // modifier — `bg-status-in-service/15` silently resolves to
          // nothing against these var() colours (docs/DESIGN.md §8).
          iconTone: 'bg-tint-in-service text-status-in-service',
          label: 'New requests',
          description: 'Customers requesting times',
          count: counts.new,
        },
        {
          key: 'awaiting',
          icon: Clock,
          iconTone: 'bg-muted text-muted-foreground',
          label: 'Awaiting response',
          description: 'You replied, waiting on customer',
          count: counts.awaiting,
        },
        {
          key: 'converted',
          icon: CheckCircle2,
          iconTone: 'bg-tint-completed text-status-completed',
          label: 'Converted to booking',
          description: 'Successfully booked',
          count: counts.converted,
        },
        {
          key: 'declined',
          icon: XCircle,
          iconTone: 'bg-tint-no-show text-status-no-show',
          label: 'Declined',
          description: 'Not able to offer',
          count: counts.declined,
        },
      ]
    : [];

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          Availability requests
        </h2>
        <Link
          to={requestsHref}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {!counts && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      <div className="space-y-3">
        {buckets.map((bucket) => {
          const Icon = bucket.icon;
          return (
            <Link
              key={bucket.key}
              to={requestsHref}
              className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-1 hover:bg-muted"
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bucket.iconTone}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {bucket.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {bucket.description}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {bucket.count}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
