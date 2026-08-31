import { type JSX, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import {
  getEmailDiagnostics,
  getSystemHealth,
  type EmailAuthCheck,
  type EmailDiagnostics,
} from '@/services/systemHealthService';
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

function AuthCheckRow({
  label,
  check,
  detail,
}: {
  label: string;
  check: EmailAuthCheck;
  detail?: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'flex items-center gap-1.5 font-medium',
          check.present ? 'text-status-confirmed' : 'text-status-no-show',
        )}
      >
        {check.present ? (
          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {check.present ? (detail ?? 'Set up') : 'Missing'}
      </span>
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
  const [emailAuth, setEmailAuth] = useState<EmailDiagnostics | null>(null);
  const [emailAuthError, setEmailAuthError] = useState(false);

  const load = useCallback((): void => {
    setError(null);
    getSystemHealth()
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
    setEmailAuthError(false);
    getEmailDiagnostics()
      .then(setEmailAuth)
      .catch(() => setEmailAuthError(true));
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
      subtitle="Scheduled jobs, email delivery and the Google reviews sync. One place to check if anything's broken."
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
                  Email authentication
                </h2>
                {emailAuth ? (
                  <div className="divide-y divide-border text-sm">
                    <AuthCheckRow label="SPF" check={emailAuth.spf} />
                    <AuthCheckRow
                      label="DKIM"
                      check={emailAuth.dkim}
                      detail={`Selector "${emailAuth.dkim.selector}"`}
                    />
                    <AuthCheckRow
                      label="DMARC"
                      check={emailAuth.dmarc}
                      detail={
                        emailAuth.dmarc.policy
                          ? `Policy: ${emailAuth.dmarc.policy}`
                          : undefined
                      }
                    />
                  </div>
                ) : emailAuthError ? (
                  <p className="text-xs text-muted-foreground">
                    Couldn&rsquo;t check the domain&rsquo;s DNS records right now.
                  </p>
                ) : (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {emailAuth
                    ? `Checked ${formatDateTime(emailAuth.checkedAt, timezone)}. Live DNS lookup, not stored.`
                    : 'These three records tell a receiving mail server the email genuinely came from us.'}
                </p>
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
