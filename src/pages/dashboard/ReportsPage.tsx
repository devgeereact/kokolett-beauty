import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  PoundSterling,
  TrendingUp,
  UserPlus,
  UserX,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DayOfWeekChart } from '@/components/dashboard/insights/DayOfWeekChart';
import { HourOfDayChart } from '@/components/dashboard/insights/HourOfDayChart';
import { StatTrendTile } from '@/components/dashboard/reports/StatTrendTile';
import { TrendLineChart } from '@/components/dashboard/reports/TrendLineChart';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  getReportsData,
  getReportsOverview,
  type ReportsData,
  type ReportsOverview,
} from '@/services/reportsService';
import { downloadCsv } from '@/lib/csv';
import {
  addDays,
  formatDateShort,
  formatDateTime,
  formatMoney,
  toSalonDate,
} from '@/lib/format';
import { routes } from '@/lib/routes';

/**
 * Reports, rebuilt onto `docs/design/reports.png`'s Overview tab — real
 * stat tiles with a trend vs the equal-length period before, real time
 * series, all computed live from `appointments_detailed` (no separate
 * stored report). The reference's other
 * six tabs (Appointments/Revenue/Customers/Services/Staff/Availability)
 * aren't built — this salon has one staff member and one bookable service
 * today, so most of that tab set would either duplicate this Overview or
 * have nothing real to show.
 *
 * The day-of-week/peak-hour charts and Google reviews card below are kept
 * from the previous version of this page — real, already-shipped features
 * not in the reference image, not worth deleting.
 */
const RANGE_OPTIONS = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 28, label: 'Last 28 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

export function ReportsPage(): JSX.Element {
  const { settings, timezone } = useBusinessSettings();
  const [rangeDays, setRangeDays] = useState<number>(28);
  const range = (() => {
    const today = toSalonDate(new Date(), timezone);
    return { from: addDays(today, -(rangeDays - 1)), to: today };
  })();
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [legacy, setLegacy] = useState<ReportsData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    Promise.all([
      getReportsOverview(timezone, range.from, range.to),
      getReportsData(timezone),
    ])
      .then(([o, l]) => {
        setOverview(o);
        setLegacy(l);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [timezone, rangeDays]);

  const reviewsConfigured = Boolean(settings?.google_place_id);

  const exportReport = (): void => {
    if (!overview) return;
    const header = ['Metric', 'Value'];
    const rows: string[][] = [
      ['Period', `${overview.from} to ${overview.to}`],
      ['Total appointments', String(overview.totals.appointments)],
      ['Total revenue', formatMoney(overview.totals.revenuePence)],
      ['New customers', String(overview.totals.newCustomers)],
      ['Average booking value', formatMoney(overview.totals.avgBookingValuePence)],
      ['No-show rate', `${overview.totals.noShowRate}%`],
    ];
    downloadCsv(`reports-${overview.from}-to-${overview.to}.csv`, [header, ...rows]);
  };

  return (
    <DashboardLayout
      title="Reports"
      subtitle="Track your business performance and gain valuable insights."
      actions={
        overview && (
          <>
            <div className="relative">
              <Calendar
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2}
              />
              <select
                aria-label="Report period"
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="h-9 rounded-sm border border-border bg-input py-2 pl-9 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.days} value={o.days}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="hidden text-sm text-muted-foreground md:inline">
              {formatDateShort(`${overview.from}T00:00:00Z`)} –{' '}
              {formatDateShort(`${overview.to}T00:00:00Z`)}
            </span>
            <Button variant="ghost" size="sm" onClick={exportReport}>
              Export report
            </Button>
          </>
        )
      }
    >
      {error && <ErrorState error={error} onRetry={load} />}
      {!error && !overview && <LoadingState label="Building your reports…" />}

      {overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTrendTile
              icon={Calendar}
              tone="primary"
              label="Total appointments"
              value={String(overview.totals.appointments)}
              current={overview.totals.appointments}
              previous={overview.previous.appointments}
              previousLabel="previous period"
            />
            <StatTrendTile
              icon={PoundSterling}
              tone="in_service"
              label="Total revenue"
              value={formatMoney(overview.totals.revenuePence)}
              current={overview.totals.revenuePence}
              previous={overview.previous.revenuePence}
              previousLabel="previous period"
            />
            <StatTrendTile
              icon={UserPlus}
              tone="completed"
              label="New customers"
              value={String(overview.totals.newCustomers)}
              current={overview.totals.newCustomers}
              previous={overview.previous.newCustomers}
              previousLabel="previous period"
            />
            <StatTrendTile
              icon={TrendingUp}
              tone="pending"
              label="Average booking value"
              value={formatMoney(overview.totals.avgBookingValuePence)}
              current={overview.totals.avgBookingValuePence}
              previous={overview.previous.avgBookingValuePence}
              previousLabel="previous period"
            />
            <StatTrendTile
              icon={UserX}
              tone="cancelled"
              label="No-show rate"
              value={`${overview.totals.noShowRate}%`}
              current={overview.totals.noShowRate}
              previous={overview.previous.noShowRate}
              previousLabel="previous period"
              invert
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TrendLineChart
              title="Appointments over time"
              points={overview.seriesByDay.map((d) => ({
                date: d.date,
                value: d.appointments,
              }))}
              colorVar="var(--primary)"
              formatValue={(n) => String(n)}
            />
            <TrendLineChart
              title="Revenue over time"
              points={overview.seriesByDay.map((d) => ({
                date: d.date,
                value: d.revenuePence / 100,
              }))}
              colorVar="var(--chart-3)"
              formatValue={(n) => `£${n}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
                Recent bookings
              </h2>
              {overview.recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing booked in this period yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3">Client</th>
                        <th className="py-2 pr-3">Service</th>
                        <th className="py-2 pr-3">Date &amp; time</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentBookings.map((b) => (
                        <tr key={b.id} className="border-b border-border last:border-0">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={b.customer_name ?? 'Customer'} size="sm" />
                              <span className="truncate text-foreground">
                                {b.customer_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-foreground">
                            {b.service_name}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                            {formatDateTime(b.starts_at, timezone)}
                          </td>
                          <td className="py-2.5 pr-3 text-foreground">
                            {formatMoney(b.price_pence)}
                          </td>
                          <td className="py-2.5">
                            <StatusChip status={b.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
                Top customers by visits
              </h2>
              {overview.topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nobody has a completed visit yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {overview.topCustomers.map((r) => (
                    <li key={r.customer.id} className="flex items-center gap-3">
                      <Avatar name={r.customer.full_name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {r.customer.full_name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {r.completedCount} visit{r.completedCount === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
              Insights
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-in-service text-status-in-service">
                  <TrendingUp aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Revenue{' '}
                    {overview.totals.revenuePence === overview.previous.revenuePence
                      ? 'is unchanged'
                      : overview.totals.revenuePence > overview.previous.revenuePence
                        ? 'is up'
                        : 'is down'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You earned {formatMoney(overview.totals.revenuePence)} this period,
                    compared to {formatMoney(overview.previous.revenuePence)} last period.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-completed text-status-completed">
                  <UserPlus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    New customer growth
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You gained {overview.totals.newCustomers} new customer
                    {overview.totals.newCustomers === 1 ? '' : 's'} this period.
                  </p>
                </div>
              </div>
              {overview.busiestDay && (
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-pending text-status-pending">
                    <CalendarCheck
                      aria-hidden="true"
                      className="h-4 w-4"
                      strokeWidth={2}
                    />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">Peak day</p>
                    <p className="text-xs text-muted-foreground">
                      {overview.busiestDay.name} is your busiest day, with{' '}
                      {overview.busiestDay.count} appointments.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {legacy && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
                  Bookings by day of week
                </h2>
                <DayOfWeekChart trend={legacy.dayOfWeek} />
              </Card>

              <Card className="p-5">
                <h2 className="mb-4 font-serif text-lg font-semibold text-foreground">
                  Bookings by hour of day
                </h2>
                <HourOfDayChart trend={legacy.hourOfDay} />
              </Card>
            </div>
          )}

          <Card className="p-5">
            <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
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
