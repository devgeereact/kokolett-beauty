import type { DayOfWeekTrend } from '@/lib/insights';

/** Monday-first, matching the app's own weekday convention everywhere else. */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** `dayOfWeek` (0=Sun..6=Sat) reordered to match `DAY_LABELS`. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Bookings by day of week, as horizontal bars. A closed day (per the weekly
 * template) renders in the neutral `border` tone rather than `chart-1`, so
 * a quiet Sunday reads as "closed", not "underperforming".
 */
export function DayOfWeekChart({ trend }: { trend: DayOfWeekTrend[] }): JSX.Element {
  const byDay = new Map(trend.map((t) => [t.dayOfWeek, t]));
  const maxCount = Math.max(1, ...trend.map((t) => t.count));

  return (
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
                  open ? 'h-full rounded-md bg-chart-1' : 'h-full rounded-md bg-border'
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
  );
}
