import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { getDayOfWeekTrend } from '@/services/assistantService';
import type { DayOfWeekTrend } from '@/lib/insights';

/** Monday-first, matching the app's own weekday convention everywhere else. */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** `dayOfWeek` (0=Sun..6=Sat) reordered to match `DAY_LABELS`. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Bookings by day-of-week over the last 90 days, called out against the weekly template. */
export function TrendAnalysisPanel({ timezone }: { timezone: string }): JSX.Element {
  const [trend, setTrend] = useState<DayOfWeekTrend[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getDayOfWeekTrend(timezone)
      .then(setTrend)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!trend) return <LoadingState label="Looking at the last 90 days…" />;

  const byDay = new Map(trend.map((t) => [t.dayOfWeek, t]));
  const maxCount = Math.max(1, ...trend.map((t) => t.count));
  const closedDays = DISPLAY_ORDER.filter(
    (d) => !(byDay.get(d)?.templateOpen ?? false),
  ).map((d) => DAY_LABELS[DISPLAY_ORDER.indexOf(d)]);

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
        Bookings by day of week
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Last 90 days.{' '}
        {closedDays.length > 0
          ? `${closedDays.join(' and ')} ${closedDays.length === 1 ? 'is' : 'are'} closed in your weekly template, so a low count there is expected, not a demand problem.`
          : 'Every day is open in your weekly template.'}
      </p>

      <div className="space-y-2.5">
        {DISPLAY_ORDER.map((dow, i) => {
          const row = byDay.get(dow);
          const count = row?.count ?? 0;
          const open = row?.templateOpen ?? false;
          return (
            <div key={dow} className="flex items-center gap-3">
              <span className="w-9 shrink-0 text-xs font-medium text-muted-foreground">
                {DAY_LABELS[i]}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className={
                    open ? 'h-full rounded-md bg-primary' : 'h-full rounded-md bg-border'
                  }
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-foreground">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
