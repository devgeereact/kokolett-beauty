import type { JSX } from 'react';
import {
  CALENDAR_GRID_HEIGHT_CLASS,
  WEEKDAY_HEADINGS,
  dayNumber,
  isSameMonth,
  monthGrid,
} from '@/lib/calendar';
import { formatTime } from '@/lib/format';
import { STATUS_DOTS, STATUS_PILL_BG } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { DaySummary } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface MonthViewProps {
  year: number;
  month: number;
  today: string;
  timezone: string;
  summary: Map<string, DaySummary>;
  appointmentsByDate: Map<string, AppointmentDetailed[]>;
  onSelectDate: (date: string) => void;
}

const MAX_PILLS = 2;

/**
 * Month-at-a-glance grid: six Monday-first weeks, each day showing up to
 * `MAX_PILLS` appointment pills and an overflow count. Clicking any cell —
 * not just the "+N more" text — hands off to `DayView` for that date; this
 * grid never shows a "Manage published times" affordance itself.
 */
export function MonthView({
  year,
  month,
  today,
  timezone,
  summary,
  appointmentsByDate,
  onSelectDate,
}: MonthViewProps): JSX.Element {
  const weeks = monthGrid(year, month);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md border border-border bg-card',
        CALENDAR_GRID_HEIGHT_CLASS,
      )}
    >
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted">
        {WEEKDAY_HEADINGS.map((heading) => (
          <div
            key={heading}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {heading}
          </div>
        ))}
      </div>

      {/* Fixed 6 rows filling whatever height is left, not a row per week
          sized to its own content — so the month always fits the screen
          instead of pushing the page taller in a 6-week month. */}
      <div
        className="grid flex-1 grid-cols-7"
        style={{ gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}
      >
        {weeks.flat().map((date) => {
          const row = summary.get(date);
          const inMonth = isSameMonth(date, year, month);
          const isToday = date === today;
          const appointments = appointmentsByDate.get(date) ?? [];
          const pills = appointments.slice(0, MAX_PILLS);
          const overflow = appointments.length - pills.length;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              aria-label={`${date}: ${row?.slot_count ?? 0} times, ${row?.booked_count ?? 0} booked`}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex min-h-0 flex-col items-start gap-1 overflow-hidden border-b border-r border-border p-2 text-left',
                'focus-visible:relative focus-visible:z-sticky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                inMonth ? 'bg-card hover:bg-muted' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm',
                  isToday
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : inMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {dayNumber(date)}
              </span>

              {inMonth && (
                // A separate flex group (not just more siblings in the cell's
                // own gap-1 stack) so the "N times" fact and the appointment
                // pills read as one unit, set apart from the day badge above.
                <div className="flex min-h-0 w-full flex-col gap-1 overflow-hidden">
                  {/*
                    The published-times count is a fact of its own — how many
                    slots are open that day — independent of whether any of
                    them are booked. It stays visible even when there are no
                    pills to show, so it renders here rather than folding into
                    the pill list below.
                  */}
                  {row && row.slot_count > 0 && (
                    <span className="text-2xs text-muted-foreground">
                      {row.slot_count} time{row.slot_count === 1 ? '' : 's'}
                    </span>
                  )}
                  <div className="flex w-full flex-col gap-0.5">
                    {pills.map((a) => (
                      <span
                        key={a.id}
                        className={cn(
                          'flex w-full items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium text-foreground',
                          STATUS_PILL_BG[a.status],
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            STATUS_DOTS[a.status],
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {a.customer_name?.split(' ')[0] ?? 'Customer'}
                        </span>
                        <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                          {formatTime(a.starts_at, timezone)}
                        </span>
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="text-2xs text-muted-foreground">
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
