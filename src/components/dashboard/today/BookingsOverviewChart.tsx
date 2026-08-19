import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { listAppointments } from '@/services/appointmentService';
import { analyzeWeekBookings, percentChange, summarizeBusiness } from '@/lib/insights';
import { addDays, dayName, salonDayRange, toSalonDate } from '@/lib/format';
import { dayOfWeek, weekDates } from '@/lib/calendar';
import type { AppointmentDetailed } from '@/types';

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, matching weekDates.

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
  return `${delta >= 0 ? '▲' : '▼'} ${rounded}% vs last week`;
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
 * New-vs-returning bookings for the current salon week, plus the same
 * week-over-week deltas Reports shows — computed from two `listAppointments`
 * windows, same classification `summarizeBusiness` already uses elsewhere.
 */
export function BookingsOverviewChart({ timezone }: { timezone: string }): JSX.Element {
  const [metrics, setMetrics] = useState<WeekMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = toSalonDate(new Date(), timezone);
    const dates = weekDates(today);
    const monday = dates[0]!;
    const sunday = dates[6]!;
    const lastMonday = addDays(monday, -7);
    const lastSunday = addDays(sunday, -7);

    Promise.all([
      listAppointments({
        from: salonDayRange(monday, timezone).start,
        to: salonDayRange(sunday, timezone).end,
      }),
      listAppointments({
        from: salonDayRange(lastMonday, timezone).start,
        to: salonDayRange(lastSunday, timezone).end,
      }),
    ])
      .then(([thisWeekRaw, lastWeekRaw]) => {
        if (cancelled) return;
        const thisWeek = liveOnly(thisWeekRaw);
        const lastWeek = liveOnly(lastWeekRaw);
        const current = summarizeBusiness(thisWeek, []);
        const previous = summarizeBusiness(lastWeek, []);
        setMetrics({
          thisWeek,
          todayDow: dayOfWeek(today),
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
  }, [timezone]);

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
    <Card className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground">
          Bookings overview
        </h2>
        <span className="text-xs text-muted-foreground">This week</span>
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

          {/* A fixed, compact chart centred in whatever leftover height the
              card has, rather than the bars themselves stretching taller to
              fill it — a bar chart that grows to match a neighbour's height
              stops reading as "this week at a glance". The card only
              stretches to match Availability requests beside it now (row2
              has no other card), so that leftover is a few px, not a dead
              zone. */}
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
