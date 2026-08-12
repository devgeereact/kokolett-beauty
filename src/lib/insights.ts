/**
 * Pure computations shared by the AI Assistant's advisory modules, the
 * Reports page, and the Notifications activity feed.
 *
 * Every function here is a scan or a ranking over appointment rows the
 * caller already fetched — nothing in this file talks to Supabase, and
 * nothing here mutates data. The assistant is advisory only (docs/PRD.md):
 * each module surfaces a finding, and a person clicks a real action
 * (reschedule, send, mark complete) to do anything about it. Reports and
 * Notifications use the same functions purely for display.
 */

import { dayOfWeek } from '@/lib/calendar';
import { minutesSinceMidnight, toSalonDate } from '@/lib/format';
import type { TemplateDay } from '@/services/availabilityService';
import type { AppointmentDetailed, Customer } from '@/types';

/* ------------------------------------------------------- conflicts --- */

export interface ScheduleConflict {
  date: string;
  a: AppointmentDetailed;
  b: AppointmentDetailed;
}

/**
 * Same-day overlapping live appointments.
 *
 * `appointments_no_overlap` forbids two web/owner-portal bookings from ever
 * overlapping, so this only ever fires on a manual walk-in (`source:
 * 'owner'`) — `create_appointment_as_owner` deliberately skips that
 * constraint (migration 0019) because the owner is looking at the customer
 * and knows better than the database does.
 */
export function findScheduleConflicts(
  appointments: AppointmentDetailed[],
): ScheduleConflict[] {
  const sorted = [...appointments].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i];
    if (!a) continue;
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j];
      if (!b) continue;
      // Sorted by start, so once b starts at or after a ends, no later b can
      // overlap a either — safe to stop scanning forward from here.
      if (b.starts_at >= a.ends_at) break;
      conflicts.push({ date: a.starts_at.slice(0, 10), a, b });
    }
  }
  return conflicts;
}

/* ------------------------------------------------------- analytics --- */

export interface BusinessAnalyticsSummary {
  bookingsThisMonth: number;
  totalInWindow: number;
  returningRate: number;
  noShowRate: number;
  cancellationRate: number;
}

/**
 * A plain-English performance summary.
 *
 * `windowAppointments` is the recent window the rates are computed over
 * (this page uses the last 90 days); `monthAppointments` is just this
 * calendar month, for the one absolute count rather than a rate.
 */
export function summarizeBusiness(
  windowAppointments: AppointmentDetailed[],
  monthAppointments: AppointmentDetailed[],
): BusinessAnalyticsSummary {
  const total = windowAppointments.length;
  const returning = windowAppointments.filter(
    (a) => (a.customer_completed_count ?? 0) > 0,
  ).length;
  const noShows = windowAppointments.filter((a) => a.status === 'no_show').length;
  const cancelled = windowAppointments.filter((a) => a.status === 'cancelled').length;

  return {
    bookingsThisMonth: monthAppointments.length,
    totalInWindow: total,
    returningRate: total > 0 ? returning / total : 0,
    noShowRate: total > 0 ? noShows / total : 0,
    cancellationRate: total > 0 ? cancelled / total : 0,
  };
}

/* ---------------------------------------------------------- trends --- */

export interface DayOfWeekTrend {
  /** 0 = Sunday .. 6 = Saturday, matching `weekly_template.day_of_week`. */
  dayOfWeek: number;
  count: number;
  /** Whether the weekly template currently publishes anything on this day. */
  templateOpen: boolean;
}

/**
 * Bookings grouped by day-of-week, called out against the weekly template —
 * so "Sundays are quiet" reads correctly as "Sundays are closed" rather than
 * as a demand signal.
 */
export function analyzeDayOfWeekTrend(
  appointments: AppointmentDetailed[],
  template: TemplateDay[],
  timezone: string,
): DayOfWeekTrend[] {
  const openByDay = new Map(template.map((t) => [t.day_of_week, t.times.length > 0]));
  const counts = new Map<number, number>();

  for (const a of appointments) {
    const dow = dayOfWeek(toSalonDate(a.starts_at, timezone));
    counts.set(dow, (counts.get(dow) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, dayOfWeekIndex) => ({
    dayOfWeek: dayOfWeekIndex,
    count: counts.get(dayOfWeekIndex) ?? 0,
    templateOpen: openByDay.get(dayOfWeekIndex) ?? false,
  }));
}

export interface HourOfDayTrend {
  /** 0–23, salon-local. */
  hour: number;
  count: number;
}

/** Bookings grouped by salon-local start hour — where in the day demand actually falls. */
export function analyzeHourOfDayTrend(
  appointments: AppointmentDetailed[],
  timezone: string,
): HourOfDayTrend[] {
  const counts = new Map<number, number>();
  for (const a of appointments) {
    const hour = Math.floor(minutesSinceMidnight(a.starts_at, timezone) / 60);
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: counts.get(hour) ?? 0,
  }));
}

/* ------------------------------------------------ repeat customers --- */

export interface RepeatCustomerInsight {
  customer: Customer;
  completedCount: number;
  lastVisitAt: string | null;
}

/** Customers ranked by completed visits, most first. Never-visited customers are dropped. */
export function rankRepeatCustomers(
  customers: Customer[],
  completedAppointments: AppointmentDetailed[],
): RepeatCustomerInsight[] {
  const byCustomer = new Map<string, AppointmentDetailed[]>();
  for (const a of completedAppointments) {
    const list = byCustomer.get(a.customer_id) ?? [];
    list.push(a);
    byCustomer.set(a.customer_id, list);
  }

  return customers
    .map((customer): RepeatCustomerInsight => {
      const visits = byCustomer.get(customer.id) ?? [];
      const lastVisitAt = visits.reduce<string | null>(
        (latest, v) => (!latest || v.starts_at > latest ? v.starts_at : latest),
        null,
      );
      return { customer, completedCount: visits.length, lastVisitAt };
    })
    .filter((r) => r.completedCount > 0)
    .sort((a, b) => b.completedCount - a.completedCount);
}

/* --------------------------------------------- cancellation risk --- */

export interface CancellationRisk {
  appointment: AppointmentDetailed;
  /** 0–1. Not a probability in any calibrated sense — a ranking signal. */
  score: number;
  reasons: string[];
}

const RISK_WEIGHTS = {
  firstTime: 0.3,
  shortLeadTime: 0.25,
  priorNoShow: 0.3,
  walkIn: 0.15,
};

/** Booked with under this much notice counts as "short lead time". */
const SHORT_LEAD_TIME_HOURS = 4;

/**
 * A risk score per upcoming appointment, from signals already on the row or
 * looked up by the caller — nothing here is a trained model, just weighted
 * heuristics an owner can sanity-check at a glance from the reasons list.
 */
export function forecastCancellationRisk(
  upcoming: AppointmentDetailed[],
  noShowCountByCustomer: Map<string, number>,
): CancellationRisk[] {
  return upcoming
    .map((appointment): CancellationRisk => {
      let score = 0;
      const reasons: string[] = [];

      if ((appointment.customer_completed_count ?? 0) === 0) {
        score += RISK_WEIGHTS.firstTime;
        reasons.push('First-time customer');
      }

      const leadHours =
        (new Date(appointment.starts_at).getTime() -
          new Date(appointment.created_at).getTime()) /
        3_600_000;
      if (leadHours < SHORT_LEAD_TIME_HOURS) {
        score += RISK_WEIGHTS.shortLeadTime;
        reasons.push('Booked with very little notice');
      }

      const priorNoShows = noShowCountByCustomer.get(appointment.customer_id) ?? 0;
      if (priorNoShows > 0) {
        score += RISK_WEIGHTS.priorNoShow;
        reasons.push(
          priorNoShows === 1
            ? 'Has missed an appointment before'
            : 'Has missed appointments before',
        );
      }

      if (appointment.source === 'owner') {
        score += RISK_WEIGHTS.walkIn;
        reasons.push('Booked by phone, not online');
      }

      return { appointment, score: Math.min(1, score), reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/* -------------------------------------------------------- activity --- */

export type ActivityKind =
  'created' | 'rescheduled' | 'cancelled' | 'rejected' | 'completed' | 'no_show';

export interface ActivityEvent {
  /** `${appointment.id}:${kind}` — unique per event, stable across reloads. */
  id: string;
  kind: ActivityKind;
  /** ISO timestamp the event actually happened at. */
  at: string;
  customerName: string;
  reference: string;
  detail: string;
}

const SOURCE_LABELS: Record<string, string> = {
  web: 'New booking',
  owner: 'Phone booking taken',
  availability_request: 'Booked from the waitlist',
};

/**
 * One or more activity events per appointment, from whichever timestamp
 * columns are actually set — a booking that was both cancelled and
 * completed (impossible, but the point stands) would surface both. Sorted
 * most-recent-first; the caller decides how far back to show.
 */
export function buildAppointmentActivity(
  appointments: AppointmentDetailed[],
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const a of appointments) {
    const customerName = a.customer_name ?? 'Customer';

    if (a.rescheduled_from) {
      events.push({
        id: `${a.id}:rescheduled`,
        kind: 'rescheduled',
        at: a.created_at,
        customerName,
        reference: a.reference,
        detail: 'Moved to a new time',
      });
    } else {
      events.push({
        id: `${a.id}:created`,
        kind: 'created',
        at: a.created_at,
        customerName,
        reference: a.reference,
        detail: SOURCE_LABELS[a.source] ?? 'New booking',
      });
    }

    if (a.cancelled_at) {
      events.push({
        id: `${a.id}:cancelled`,
        kind: 'cancelled',
        at: a.cancelled_at,
        customerName,
        reference: a.reference,
        detail: a.cancellation_reason ?? 'Cancelled',
      });
    }
    if (a.rejected_at) {
      events.push({
        id: `${a.id}:rejected`,
        kind: 'rejected',
        at: a.rejected_at,
        customerName,
        reference: a.reference,
        detail: a.rejection_reason ?? 'Booking declined',
      });
    }
    if (a.completed_at) {
      events.push({
        id: `${a.id}:completed`,
        kind: 'completed',
        at: a.completed_at,
        customerName,
        reference: a.reference,
        detail: 'Completed',
      });
    }
    if (a.status === 'no_show') {
      events.push({
        id: `${a.id}:no_show`,
        kind: 'no_show',
        at: a.updated_at ?? a.created_at,
        customerName,
        reference: a.reference,
        detail: 'Marked as a no-show',
      });
    }
  }

  return events.sort((x, y) => y.at.localeCompare(x.at));
}
