import { type JSX, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { getSystemHealth } from '@/services/systemHealthService';
import { formatDateTime } from '@/lib/format';
import { routes } from '@/lib/routes';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { cn } from '@/lib/utils';
import type { SystemHealth, SystemHealthJob } from '@/types';

function JobStatusIcon({ status }: { status: string | null }): JSX.Element {
  if (status === 'succeeded') {
    return (
      <CheckCircle2
        aria-label="Succeeded"
        className="h-4 w-4 shrink-0 text-status-confirmed"
        strokeWidth={2}
      />
    );
  }
  if (status === 'failed') {
    return (
      <AlertCircle
        aria-label="Failed"
        className="h-4 w-4 shrink-0 text-status-no-show"
        strokeWidth={2}
      />
    );
  }
  return (
    <HelpCircle
      aria-label="Never run yet"
      className="h-4 w-4 shrink-0 text-muted-foreground"
      strokeWidth={2}
    />
  );
}

function JobRow({
  job,
  timezone,
}: {
  job: SystemHealthJob;
  timezone: string;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3 border-b border-border p-3 last:border-b-0">
      <JobStatusIcon status={job.last_status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{job.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {job.last_start ? formatDateTime(job.last_start, timezone) : 'Never run'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {job.schedule} · {job.active ? 'active' : 'disabled'}
        </p>
        {job.last_status === 'failed' && job.last_message && (
          <p className="mt-1 text-xs text-status-no-show">{job.last_message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Read-only: pg_cron's own run history (nothing new logged — cron already
 * records every run in `cron.job_run_details`, this just surfaces it), plus
 * the existing email/reviews staleness signals, plus the running build
 * version (migration 0053). One place to check "is anything broken."
 */
export function SystemHealthPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback((): void => {
    setError(null);
    getSystemHealth()
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  useEffect(load, [load]);

  if (error) {
    return (
      <DashboardLayout title="System Health">
        <ErrorState error={error} onRetry={load} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="System Health"
      subtitle="Scheduled jobs, email delivery and the Google reviews sync — one place to check if anything's broken."
    >
      {!health ? (
        <LoadingState label="Checking…" />
      ) : (
        <div className="space-y-6">
          <Card className="flex items-center justify-between p-4 text-xs text-muted-foreground">
            <span>
              Build <span className="font-mono text-foreground">{__APP_VERSION__}</span>
            </span>
            <span>Built {formatDateTime(__BUILD_TIME__, timezone)}</span>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-0">
              <h2 className="border-b border-border p-4 text-base font-semibold text-foreground">
                Scheduled jobs
              </h2>
              {health.jobs.map((job) => (
                <JobRow key={job.name} job={job} timezone={timezone} />
              ))}
            </Card>

            <div className="space-y-6">
              <Card className="p-4">
                <h2 className="mb-3 text-base font-semibold text-foreground">Email</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Queued</dt>
                  <dd className="text-foreground">{health.email.queued_count}</dd>
                  <dt className="text-muted-foreground">Failed / bounced</dt>
                  <dd
                    className={cn(
                      health.email.failed_count > 0
                        ? 'text-status-no-show'
                        : 'text-foreground',
                    )}
                  >
                    {health.email.failed_count}
                  </dd>
                </dl>
                <Link
                  to={routes.owner.email}
                  className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                >
                  View the outbox
                </Link>
              </Card>

              <Card className="p-4">
                <h2 className="mb-3 text-base font-semibold text-foreground">
                  Google reviews
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Last synced</dt>
                  <dd className="text-foreground">
                    {health.reviews.last_fetched_at
                      ? formatDateTime(health.reviews.last_fetched_at, timezone)
                      : 'Never'}
                  </dd>
                  {health.reviews.last_error && (
                    <>
                      <dt className="text-muted-foreground">Last error</dt>
                      <dd className="text-status-no-show">{health.reviews.last_error}</dd>
                    </>
                  )}
                </dl>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
