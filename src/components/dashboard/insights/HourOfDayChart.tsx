import type { HourOfDayTrend } from '@/lib/insights';

/** Bookings by salon-local start hour, as a vertical bar chart — where peak hour actually falls. */
export function HourOfDayChart({ trend }: { trend: HourOfDayTrend[] }): JSX.Element {
  const maxCount = Math.max(1, ...trend.map((t) => t.count));

  return (
    <div className="flex h-32 items-end gap-1">
      {trend.map((t) => (
        <div
          key={t.hour}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          title={`${String(t.hour).padStart(2, '0')}:00 — ${t.count} booking${t.count === 1 ? '' : 's'}`}
        >
          <div
            className="w-full rounded-t-sm bg-chart-1"
            style={{ height: `${(t.count / maxCount) * 100}%` }}
          />
          {t.hour % 3 === 0 && (
            <span className="text-2xs text-muted-foreground">{t.hour}</span>
          )}
        </div>
      ))}
    </div>
  );
}
