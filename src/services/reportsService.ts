import { listAppointments } from '@/services/appointmentService';
import { listCustomers } from '@/services/customerService';
import { listWeeklyTemplate } from '@/services/availabilityService';
import { addDays, salonDayRange, toSalonDate } from '@/lib/format';
import {
  STATUS_CATEGORY,
  STATUS_CATEGORY_LABELS,
  STATUS_CATEGORIES,
  type StatusCategory,
} from '@/lib/status';
import {
  analyzeDayOfWeekTrend,
  analyzeHourOfDayTrend,
  rankRepeatCustomers,
  type DayOfWeekTrend,
  type HourOfDayTrend,
  type RepeatCustomerInsight,
} from '@/lib/insights';
import type { AppointmentDetailed } from '@/types';

export interface ReportsOverview {
  from: string;
  to: string;
  totals: {
    appointments: number;
    revenuePence: number;
    newCustomers: number;
    avgBookingValuePence: number;
    noShowRate: number;
  };
  /** Same shape, the equal-length period immediately before `from` — the trend comparison. */
  previous: ReportsOverview['totals'];
  seriesByDay: { date: string; appointments: number; revenuePence: number }[];
  byStatus: { category: StatusCategory; label: string; count: number }[];
  byService: { name: string; count: number }[];
  topCustomers: RepeatCustomerInsight[];
  recentBookings: AppointmentDetailed[];
  busiestDay: { name: string; count: number } | null;
}

function computeTotals(
  appointments: AppointmentDetailed[],
  newCustomerCount: number,
): ReportsOverview['totals'] {
  const counted = appointments.filter(
    (a) => a.status !== 'rescheduled' && a.status !== 'rejected',
  );
  const completed = counted.filter((a) => a.status === 'completed');
  const noShows = counted.filter((a) => a.status === 'no_show');
  const revenuePence = completed.reduce((sum, a) => sum + a.price_pence, 0);

  return {
    appointments: counted.length,
    revenuePence,
    newCustomers: newCustomerCount,
    avgBookingValuePence:
      completed.length > 0 ? Math.round(revenuePence / completed.length) : 0,
    noShowRate:
      counted.length > 0 ? Math.round((noShows.length / counted.length) * 1000) / 10 : 0,
  };
}

/**
 * The Overview tab's dataset — one window of real appointments, plus the
 * equal-length window before it for the "vs last period" trend lines the
 * reference shows on every stat tile. `fromDate`/`toDate` are salon-local
 * `yyyy-mm-dd`, inclusive.
 */
export async function getReportsOverview(
  timezone: string,
  fromDate: string,
  toDate: string,
): Promise<ReportsOverview> {
  const range = salonDayRange(fromDate, timezone);
  const rangeEnd = salonDayRange(toDate, timezone);
  const spanDays = Math.round(
    (rangeEnd.end.getTime() - range.start.getTime()) / 86_400_000,
  );
  const prevFrom = addDays(fromDate, -spanDays);
  const prevTo = addDays(fromDate, -1);
  const prevRange = salonDayRange(prevFrom, timezone);
  const prevRangeEnd = salonDayRange(prevTo, timezone);

  const [appointments, prevAppointments, customers] = await Promise.all([
    listAppointments({ from: range.start, to: rangeEnd.end }),
    listAppointments({ from: prevRange.start, to: prevRangeEnd.end }),
    listCustomers(),
  ]);

  const newCustomers = customers.filter(
    (c) =>
      c.first_seen_at &&
      c.first_seen_at >= range.start.toISOString() &&
      c.first_seen_at < rangeEnd.end.toISOString(),
  ).length;
  const prevNewCustomers = customers.filter(
    (c) =>
      c.first_seen_at &&
      c.first_seen_at >= prevRange.start.toISOString() &&
      c.first_seen_at < prevRangeEnd.end.toISOString(),
  ).length;

  const counted = appointments.filter(
    (a) => a.status !== 'rescheduled' && a.status !== 'rejected',
  );
  const completed = counted.filter((a) => a.status === 'completed');

  const byDay = new Map<string, { appointments: number; revenuePence: number }>();
  for (const a of counted) {
    const day = toSalonDate(a.starts_at, timezone);
    const bucket = byDay.get(day) ?? { appointments: 0, revenuePence: 0 };
    bucket.appointments += 1;
    if (a.status === 'completed') bucket.revenuePence += a.price_pence;
    byDay.set(day, bucket);
  }
  const seriesByDay = [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const statusCounts = new Map<StatusCategory, number>();
  for (const a of counted) {
    const cat = STATUS_CATEGORY[a.status];
    statusCounts.set(cat, (statusCounts.get(cat) ?? 0) + 1);
  }
  const byStatus = STATUS_CATEGORIES.filter((c) => (statusCounts.get(c) ?? 0) > 0).map(
    (c) => ({
      category: c,
      label: STATUS_CATEGORY_LABELS[c],
      count: statusCounts.get(c) ?? 0,
    }),
  );

  const serviceCounts = new Map<string, number>();
  for (const a of counted) {
    const name = a.service_name ?? 'Other';
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }
  const byService = [...serviceCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const dayOfWeekCounts = new Map<string, number>();
  for (const a of counted) {
    const day = toSalonDate(a.starts_at, timezone);
    const name = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'long',
    });
    dayOfWeekCounts.set(name, (dayOfWeekCounts.get(name) ?? 0) + 1);
  }
  const busiestEntry = [...dayOfWeekCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    from: fromDate,
    to: toDate,
    totals: computeTotals(appointments, newCustomers),
    previous: computeTotals(prevAppointments, prevNewCustomers),
    seriesByDay,
    byStatus,
    byService,
    topCustomers: rankRepeatCustomers(customers, completed).slice(0, 5),
    recentBookings: [...appointments]
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, 5),
    busiestDay: busiestEntry ? { name: busiestEntry[0], count: busiestEntry[1] } : null,
  };
}

/** Long enough to show a real pattern, short enough to still feel current. */
const REPORT_WINDOW_DAYS = 180;
const TOP_CUSTOMERS_LIMIT = 10;

export interface ReportsData {
  windowDays: number;
  dayOfWeek: DayOfWeekTrend[];
  hourOfDay: HourOfDayTrend[];
  topCustomers: RepeatCustomerInsight[];
}

export async function getReportsData(timezone: string): Promise<ReportsData> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(addDays(today, -REPORT_WINDOW_DAYS), timezone).start;
  const to = salonDayRange(today, timezone).end;

  const [appointments, template, customers] = await Promise.all([
    listAppointments({ from, to }),
    listWeeklyTemplate(),
    listCustomers(),
  ]);

  // A rescheduled row is superseded by its replacement, and a rejected one
  // never happened — neither is a real day/hour the salon was busy.
  const counted = appointments.filter(
    (a) => a.status !== 'rescheduled' && a.status !== 'rejected',
  );
  const completed = appointments.filter((a) => a.status === 'completed');

  return {
    windowDays: REPORT_WINDOW_DAYS,
    dayOfWeek: analyzeDayOfWeekTrend(counted, template, timezone),
    hourOfDay: analyzeHourOfDayTrend(counted, timezone),
    topCustomers: rankRepeatCustomers(customers, completed).slice(0, TOP_CUSTOMERS_LIMIT),
  };
}
