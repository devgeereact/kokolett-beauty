import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DayPanel } from '@/components/dashboard/DayPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { ErrorState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useServices } from '@/hooks/useServices';
import { listMonthSummary, type DaySummary } from '@/services/availabilityService';
import { listAppointments } from '@/services/appointmentService';
import { formatMoney, formatTime, salonDayRange, toSalonDate } from '@/lib/format';
import {
  dayNumber,
  gridRange,
  isSameMonth,
  monthGrid,
  monthLabel,
  shiftMonth,
  WEEKDAY_HEADINGS,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { LIVE_STATUSES } from '@/types';
import type { AppointmentDetailed } from '@/types';

/**
 * The calendar.
 *
 * Rebuilt in 0011 around one idea: a day is a list of start times. The month
 * grid shows how many times each day has and how many are taken; clicking a day
 * opens the list. There is nothing else to learn — no weekly pattern behind it,
 * no windows, no closures, no blocked time.
 *
 * The month grid deliberately shows counts rather than opening hours. Under the
 * old model a cell had to summarise four interacting sources and frequently got
 * it wrong; "4 times · 1 booked" is a fact, and it is the fact the owner is
 * actually looking for.
 */
export function CalendarPage(): JSX.Element {
  const { timezone, settings } = useBusinessSettings();
  const { services } = useServices(true);
  const today = toSalonDate(new Date(), timezone);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [selected, setSelected] = useState<string>(today);

  const [summary, setSummary] = useState<Map<string, DaySummary>>(new Map());
  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const range = useMemo(() => gridRange(cursor.year, cursor.month), [cursor]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [rows, appts] = await Promise.all([
        listMonthSummary(range.from, range.to),
        listAppointments({
          from: salonDayRange(range.from, timezone).start,
          to: salonDayRange(range.to, timezone).end,
          statuses: [...LIVE_STATUSES],
        }),
      ]);
      setSummary(new Map(rows.map((r) => [r.on_date, r])));
      setAppointments(appts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [range.from, range.to, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  const appointmentMinutes = services[0]?.duration_min ?? 60;
  const dayBookings = appointments.filter(
    (a) => toSalonDate(a.starts_at, timezone) === selected,
  );

  const monthTotals = useMemo(() => {
    let slotsTotal = 0;
    let bookedTotal = 0;
    for (const date of weeks.flat()) {
      if (!isSameMonth(date, cursor.year, cursor.month)) continue;
      const row = summary.get(date);
      slotsTotal += row?.slot_count ?? 0;
      bookedTotal += row?.booked_count ?? 0;
    }
    return { slotsTotal, bookedTotal };
  }, [weeks, summary, cursor]);

  return (
    <DashboardLayout
      title="Calendar"
      subtitle="Publish the times you are free. Anything you publish can be booked."
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
              setSelected(today);
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next month"
            onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}
          >
            ›
          </Button>
        </div>
      }
    >
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      <div className="grid gap-6 xl:grid-cols-[1fr_23rem]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {monthLabel(cursor.year, cursor.month)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {monthTotals.slotsTotal} times published · {monthTotals.bookedTotal} booked
              · {timezone}
            </p>
          </div>

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
              const slotCount = row?.slot_count ?? 0;
              const bookedCount = row?.booked_count ?? 0;
              const inMonth = isSameMonth(date, cursor.year, cursor.month);
              const isToday = date === today;
              const isSelected = date === selected;
              const isPast = date < today;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  aria-current={isToday ? 'date' : undefined}
                  aria-pressed={isSelected}
                  aria-label={`${date}: ${slotCount} times, ${bookedCount} booked`}
                  className={cn(
                    'flex min-h-20 flex-col items-start gap-1 border-b border-r border-border p-2 text-left',
                    'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    inMonth ? 'bg-card hover:bg-muted' : 'bg-muted',
                    isSelected && 'ring-2 ring-inset ring-primary',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm',
                      isToday
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : inMonth && !isPast
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {dayNumber(date)}
                  </span>

                  {inMonth && slotCount > 0 && (
                    <>
                      <span className="text-xs font-medium text-foreground">
                        {slotCount} time{slotCount === 1 ? '' : 's'}
                      </span>
                      {bookedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-status-confirmed"
                            aria-hidden="true"
                          />
                          {bookedCount} booked
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <DayPanel
            date={selected}
            timezone={timezone}
            appointmentMinutes={appointmentMinutes}
            onChanged={() => void load()}
          />

          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-foreground">
              Booked this day ({dayBookings.length})
            </h3>
            {dayBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
            ) : (
              <ul className="space-y-2">
                {dayBookings.map((a) => (
                  <li
                    key={a.id}
                    className="border-b border-border pb-2 text-sm last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium text-foreground">
                        {formatTime(a.starts_at, timezone)}
                      </span>
                      <StatusChip status={a.status} />
                    </div>
                    <p className="text-muted-foreground">
                      {a.customer_name}
                      {settings && a.price_pence > 0
                        ? ` · ${formatMoney(a.price_pence)}`
                        : ''}
                    </p>
                    {a.customer_note && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        &ldquo;{a.customer_note}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
