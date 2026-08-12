import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DayOfWeekChart } from '@/components/dashboard/insights/DayOfWeekChart';
import { HourOfDayChart } from '@/components/dashboard/insights/HourOfDayChart';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { getReportsData, type ReportsData } from '@/services/reportsService';
import { formatDateShort } from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * Charts and rankings over the last six months — day-of-week and peak-hour
 * demand, and who's actually coming back. Everything here is computed live
 * from appointment data already in the DB (same `@/lib/insights` the AI
 * Assistant uses); nothing is a separate stored report.
 */
export function ReportsPage(): JSX.Element {
  const { settings, timezone } = useBusinessSettings();
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getReportsData(timezone)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  const reviewsConfigured = Boolean(settings?.google_place_id);

  return (
    <DashboardLayout title="Reports" subtitle="Last 6 months">
      {error && <ErrorState error={error} onRetry={load} />}
      {!error && !data && <LoadingState label="Building your reports…" />}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
                Bookings by day of week
              </h2>
              <DayOfWeekChart trend={data.dayOfWeek} />
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
                Bookings by hour of day
              </h2>
              <HourOfDayChart trend={data.hourOfDay} />
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Top customers
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Ranked by completed visits, last 6 months.
            </p>
            {data.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody has a completed visit in this window yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {data.topCustomers.map((r) => (
                  <li
                    key={r.customer.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="font-medium text-foreground">
                      {r.customer.full_name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {r.completedCount} visit{r.completedCount === 1 ? '' : 's'}
                      {r.lastVisitAt &&
                        ` · last ${formatDateShort(r.lastVisitAt, timezone)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Google reviews
            </h2>
            {reviewsConfigured ? (
              <p className="text-sm text-foreground">
                Reviews are set up — a request goes out automatically a couple of hours
                after each appointment is marked complete.
                {settings?.google_review_url && (
                  <>
                    {' '}
                    <a
                      href={settings.google_review_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      View your review link
                    </a>
                    .
                  </>
                )}
              </p>
            ) : (
              <EmptyState
                title="Not set up yet"
                description="Add your Google Place ID in Settings to start collecting reviews automatically."
                action={
                  <Link
                    to={routes.owner.settings}
                    className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    Go to Settings
                  </Link>
                }
              />
            )}
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
