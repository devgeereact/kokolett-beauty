import { type JSX, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { listAppointments } from '@/services/appointmentService';
import { analyzeWeekBookings, percentChange, summarizeBusiness } from '@/lib/insights';
import { addDays, dayName, salonDayRange, toSalonDate } from '@/lib/format';
import { dayOfWeek, weekDates } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, matching weekDates.

type WeekPeriod = 'current' | 'previous';

/** Bottom (Returning) segment stays one dark navy tone; the top (New)
 * segment is the accent colour only on today's bar, light blue otherwise —
 * a "you are here" callout rather than a third legend colour. */
const RETURNING_COLOR = 'bg-chart-5';
const NEW_COLOR = 'bg-chart-1';
const NEW_COLOR_TODAY = 'bg-chart-2';

function liveOnly(appointments: AppointmentDetailed[]): AppointmentDetailed[] {
  return appointments.filter(
    (a) => a.status !== 'rescheduled' && a.status !== 'rejected',
  );
}

function trendLabel(delta: number | null): string {
  if (delta === null) return '';
  const rounded = Math.round(Math.abs(delta));
  return `${delta >= 0 ? '▲' : '▼'} ${rounded}% vs previous week`;
}

interface WeekMetrics {
  thisWeek: AppointmentDetailed[];
  todayDow: number;
  bookings: number;
  bookingsDelta: number | null;
  returningRate: number;
  returningDelta: number | null;
  noShowRate: number;
  noShowDelta: number | null;
}

/**
 * New-vs-returning bookings for the selected salon week ("This week" or
 * "Last week", via the header dropdown), plus the same week-over-week deltas
 * Reports shows — computed from two `listAppointments` windows, same
 * classification `summarizeBusiness` already uses elsewhere. The dropdown
 * used to be a plain `<span>` that looked like a filter but did nothing;
 * it's real state now, mirroring the working date-range `<select>` pattern
 * on AppointmentsPage.
 */
export function BookingsOverviewChart({
  timezone,
  className,
}: {
  timezone: string;
  className?: string;
}): JSX.Element {
  const [period, setPeriod] = useState<WeekPeriod>('current');
  const [metrics, setMetrics] = useState<WeekMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMetrics(null);
    const today = toSalonDate(new Date(), timezone);
    const anchor = period === 'current' ? today : addDays(today, -7);
    const dates = weekDates(anchor);
    const monday = dates[0]!;
    const sunday = dates[6]!;
    const priorMonday = addDays(monday, -7);
    const priorSunday = addDays(sunday, -7);

    Promise.all([
      listAppointments({
        from: salonDayRange(monday, timezone).start,
        to: salonDayRange(sunday, timezone).end,
      }),
      listAppointments({
        from: salonDayRange(priorMonday, timezone).start,
        to: salonDayRange(priorSunday, timezone).end,
      }),
    ])
      .then(([selectedWeekRaw, priorWeekRaw]) => {
        if (cancelled) return;
        const selectedWeek = liveOnly(selectedWeekRaw);
        const priorWeek = liveOnly(priorWeekRaw);
        const current = summarizeBusiness(selectedWeek, []);
        const previous = summarizeBusiness(priorWeek, []);
        setMetrics({
          thisWeek: selectedWeek,
          // Only today's own week highlights a "you are here" bar — the
          // previous week has no "today" in it.
          todayDow: period === 'current' ? dayOfWeek(today) : -1,
          bookings: current.totalInWindow,
          bookingsDelta: percentChange(current.totalInWindow, previous.totalInWindow),
          returningRate: current.returningRate,
          returningDelta: percentChange(current.returningRate, previous.returningRate),
          noShowRate: current.noShowRate,
          noShowDelta: percentChange(current.noShowRate, previous.noShowRate),
        });
      })
      .catch(() => {
        if (!cancelled) setMetrics(null);
      });

    return () => {
      cancelled = true;
    };
  }, [timezone, period]);

  const week = metrics ? analyzeWeekBookings(metrics.thisWeek, timezone) : null;
  const byDay = new Map(week?.map((d) => [d.dayOfWeek, d]));
  const maxCount = Math.max(
    1,
    ...(week?.map((d) => d.newCount + d.returningCount) ?? [0]),
  );
  // A round axis top in 4 equal steps (0/¼/½/¾/max), same idea as the
  // reference's 0-10-20-30-40 ticks, scaled to whatever this week's data is.
  const axisMax = Math.max(4, Math.ceil(maxCount / 4) * 4);
  const axisTicks = [0, axisMax / 4, axisMax / 2, (axisMax * 3) / 4, axisMax];

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          Bookings overview
        </h2>
        <select
          aria-label="Week"
          value={period}
          onChange={(e) => setPeriod(e.target.value as WeekPeriod)}
          className="rounded-sm border border-transparent bg-transparent text-xs text-muted-foreground hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="current">This week</option>
          <option value="previous">Last week</option>
        </select>
      </div>

      {!metrics && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {metrics && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="font-serif text-2xl font-semibold tabular-nums text-foreground">
                {metrics.bookings}
              </p>
              <p className="text-xs text-status-completed">
                {trendLabel(metrics.bookingsDelta)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Returning rate</p>
              <p className="font-serif text-2xl font-semibold tabular-nums text-foreground">
                {Math.round(metrics.returningRate * 100)}%
              </p>
              <p className="text-xs text-status-completed">
                {trendLabel(metrics.returningDelta)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">No-show rate</p>
              <p className="font-serif text-2xl font-semibold tabular-nums text-foreground">
                {Math.round(metrics.noShowRate * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {trendLabel(metrics.noShowDelta)}
              </p>
            </div>
          </div>

          <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${NEW_COLOR}`} aria-hidden="true" />
              New
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${RETURNING_COLOR}`}
                aria-hidden="true"
              />
              Returning
            </span>
          </div>

          {/* The chart itself has an explicit height (160px below); this
              flex-1 + justify-center only centres that fixed-height block
              within whatever the card's own `h-full` stretch (from the
              grid's `items-stretch`) adds beyond it — a bar chart that grows
              taller to fill a neighbour's height stops reading as "this
              week at a glance". */}
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex gap-3" style={{ height: 160 }}>
              <div className="flex h-full shrink-0 flex-col-reverse justify-between text-right text-xs text-muted-foreground">
                {axisTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
              <div
                className="flex h-full flex-1 items-end gap-3"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(to top, var(--border) 0, var(--border) 1px, transparent 1px, transparent 25%)',
                }}
              >
                {DISPLAY_ORDER.map((dow) => {
                  const day = byDay.get(dow) ?? { newCount: 0, returningCount: 0 };
                  const isToday = dow === metrics.todayDow;
                  return (
                    <div
                      key={dow}
                      className="flex h-full flex-1 flex-col items-center gap-1.5"
                    >
                      <div className="flex h-full w-8 min-h-0 flex-col-reverse justify-start overflow-hidden rounded-t-md">
                        <div
                          className={`w-full ${isToday ? NEW_COLOR_TODAY : NEW_COLOR}`}
                          style={{ height: `${(day.newCount / axisMax) * 100}%` }}
                        />
                        <div
                          className={`w-full ${RETURNING_COLOR}`}
                          style={{ height: `${(day.returningCount / axisMax) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {dayName(dow).slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
