import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { listUnpaidCompletedAppointments } from '@/services/appointmentService';
import { formatDateShort } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

const PREVIEW_COUNT = 4;
const WINDOW_DAYS = 30;

/**
 * Completed appointments from the last 30 days with nothing logged against
 * them in `payments` — the owner's own append-only record of what she
 * actually charged (docs/KOKO_GAP.md §5, P1: money lost by forgetting to
 * record a payment is the one gap here with a direct income impact).
 */
export function PaymentReconciliationCard({
  className,
}: {
  className?: string;
}): JSX.Element {
  const [rows, setRows] = useState<AppointmentDetailed[] | null>(null);

  useEffect(() => {
    listUnpaidCompletedAppointments(WINDOW_DAYS)
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const preview = rows?.slice(0, PREVIEW_COUNT) ?? [];

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          Payments to record
        </h2>
        <Link
          to={routes.owner.appointments}
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
          title="All caught up"
          description="Every completed appointment in the last 30 days has a payment logged."
        />
      )}

      <div className="space-y-3">
        {preview.map((row) => (
          <Link
            key={row.id}
            to={routes.owner.appointments}
            className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-1 hover:bg-muted"
          >
            <Avatar name={row.customer_name ?? '?'} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {row.customer_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.service_name}</p>
            </div>
            {row.starts_at && (
              <span className="shrink-0 text-right text-xs font-medium text-muted-foreground">
                {formatDateShort(row.starts_at)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {rows !== null && rows.length > 0 && (
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">{rows.length} unrecorded</span>
          <Link
            to={routes.owner.appointments}
            className="inline-flex h-9 items-center rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground hover:brightness-95"
          >
            Record payments
          </Link>
        </div>
      )}
    </Card>
  );
}
