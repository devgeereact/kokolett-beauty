import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { listPendingApprovals } from '@/services/appointmentService';
import { formatCountdown } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const PREVIEW_COUNT = 4;

interface ApprovalPreviewRow {
  id: string;
  customer_name: string | null;
  service_name: string | null;
  approval_deadline: string | null;
}

/** First-time bookings holding a slot while they wait on a decision — same query InboxPage's Approvals lane uses. */
export function ApprovalsQueueCard({ className }: { className?: string }): JSX.Element {
  const [rows, setRows] = useState<ApprovalPreviewRow[] | null>(null);

  useEffect(() => {
    listPendingApprovals()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const preview = rows?.slice(0, PREVIEW_COUNT) ?? [];
  const approvalsHref = `${routes.owner.inbox}?tab=approvals`;

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          Approvals queue
        </h2>
        <Link
          to={approvalsHref}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {rows === null && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <EmptyState
          title="Nothing waiting"
          description="Your published hours book instantly, so nothing needs a decision right now."
        />
      )}

      <div className="space-y-3">
        {preview.map((row) => (
          <Link
            key={row.id}
            to={approvalsHref}
            className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-1 hover:bg-muted"
          >
            <Avatar name={row.customer_name ?? '?'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {row.customer_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.service_name}</p>
            </div>
            {row.approval_deadline && (
              <span className="shrink-0 text-right text-xs font-medium text-status-pending">
                {formatCountdown(row.approval_deadline)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {rows !== null && rows.length > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">{rows.length} pending</span>
          <Link
            to={approvalsHref}
            className="inline-flex h-9 items-center rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:brightness-95"
          >
            Review queue
          </Link>
        </div>
      )}
    </Card>
  );
}
