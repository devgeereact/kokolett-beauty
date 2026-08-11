import {
  WEEKDAY_HEADINGS,
  dayNumber,
  isSameMonth,
  monthGrid,
} from '@/lib/calendar';
import { formatTime } from '@/lib/format';
import { STATUS_DOTS } from '@/lib/status';
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted">
        {WEEKDAY_HEADINGS.map((heading) => (
          <div
            key={heading}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {heading}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
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
                'flex min-h-[6.5rem] flex-col items-start gap-0.5 border-b border-r border-border p-2 text-left',
                'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                <>
                  {/*
                    The published-times count is a fact of its own — how many
                    slots are open that day — independent of whether any of
                    them are booked. It stays visible even when there are no
                    pills to show (docs/superpowers/specs/2026-08-11-calendar-
                    rebuild-design.md §6), so it renders here rather than
                    folding into the pill list below.
                  */}
                  {row && row.slot_count > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {row.slot_count} time{row.slot_count === 1 ? '' : 's'}
                    </span>
                  )}
                  {pills.map((a) => (
                    <span
                      key={a.id}
                      className="flex w-full items-center gap-1 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOTS[a.status])}
                      />
                      <span className="truncate">
                        {formatTime(a.starts_at, timezone)} {a.customer_name?.split(' ')[0] ?? 'Customer'}
                      </span>
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span className="text-[10px] text-muted-foreground">+{overflow} more</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
