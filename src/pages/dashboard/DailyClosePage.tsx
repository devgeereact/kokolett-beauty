import { type JSX, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import {
  closeDay,
  getDailyCloseSummary,
  getLastClose,
} from '@/services/dailyCloseService';
import { formatDateLong, formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useToast } from '@/context/ToastContext';
import type { DailyCloseSummary } from '@/types';

function Stat({
  label,
  value,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  tone?: 'warning';
  to?: string;
}): JSX.Element {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'warning'
            ? 'mt-1 text-2xl font-semibold text-status-no-show'
            : 'mt-1 text-2xl font-semibold text-foreground'
        }
      >
        {value}
      </p>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="block rounded-lg p-4 hover:bg-muted">
        {body}
      </Link>
    );
  }
  return <div className="p-4">{body}</div>;
}

/**
 * End-of-day reconciliation. `daily_close_summary()` is a read-only
 * preview — safe to call on every visit — separate from `close_day()`,
 * which is the one that logs a `day.closed` audit row (migration
 * 0054/0055). Re-closable, not blocked: closing again just logs another
 * row. Scoped to today only in the salon's own timezone.
 */
export function DailyClosePage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<DailyCloseSummary | null>(null);
  const [lastClose, setLastClose] = useState<{
    createdAt: string;
    summary: DailyCloseSummary;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback((): void => {
    setError(null);
    Promise.all([getDailyCloseSummary(), getLastClose()])
      .then(([s, last]) => {
        setSummary(s);
        setLastClose(last);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  useEffect(load, [load]);

  const closedToday = lastClose && summary && lastClose.summary.date === summary.date;

  const handleClose = (): void => {
    setClosing(true);
    closeDay()
      .then((s) => {
        setSummary(s);
        setLastClose({ createdAt: new Date().toISOString(), summary: s });
        showToast({ message: 'Day closed.' });
      })
      .catch((e: unknown) => showToast({ message: errorMessage(e) }))
      .finally(() => setClosing(false));
  };

  if (error) {
    return (
      <DashboardLayout title="Daily Close">
        <ErrorState error={error} onRetry={load} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Daily Close"
      subtitle={`${formatDateLong(new Date(), timezone)}: an end-of-day snapshot of today's bookings, payments and outstanding items.`}
    >
      {!summary ? (
        <LoadingState label="Loading…" />
      ) : (
        <div className="space-y-6">
          {closedToday && lastClose && (
            <Card className="flex items-center gap-2 p-4 text-sm text-foreground">
              <CheckCircle2
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-status-confirmed"
                strokeWidth={2}
              />
              Last closed {formatDateTime(lastClose.createdAt, timezone)}. Closing again
              records a fresh snapshot. Nothing is overwritten.
            </Card>
          )}

          <Card className="grid grid-cols-2 gap-2 p-0 md:grid-cols-4">
            <Stat label="Scheduled" value={summary.scheduled_count} />
            <Stat label="Completed" value={summary.completed_count} />
            <Stat label="Cancelled / no-show" value={summary.cancelled_count} />
            <Stat
              label="Collected"
              value={`£${(summary.collected_pence / 100).toFixed(2)}`}
            />
            <Stat
              label="Unpaid completed"
              value={summary.unpaid_completed_count}
              tone={summary.unpaid_completed_count > 0 ? 'warning' : undefined}
              to={routes.owner.appointments}
            />
            <Stat
              label="Pending requests"
              value={summary.pending_requests_count}
              tone={summary.pending_requests_count > 0 ? 'warning' : undefined}
              to={`${routes.owner.inbox}?tab=requests`}
            />
            <Stat
              label="Failed emails"
              value={summary.failed_email_count}
              tone={summary.failed_email_count > 0 ? 'warning' : undefined}
              to={routes.owner.email}
            />
          </Card>

          <Button onClick={handleClose} disabled={closing}>
            {closing ? 'Closing…' : closedToday ? 'Close day again' : 'Close day'}
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
