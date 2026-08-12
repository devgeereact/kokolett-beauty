import { listAppointments } from '@/services/appointmentService';
import { listCustomers } from '@/services/customerService';
import { listWeeklyTemplate } from '@/services/availabilityService';
import { addDays, salonDayRange, toSalonDate } from '@/lib/format';
import {
  analyzeDayOfWeekTrend,
  analyzeHourOfDayTrend,
  rankRepeatCustomers,
  type DayOfWeekTrend,
  type HourOfDayTrend,
  type RepeatCustomerInsight,
} from '@/lib/insights';

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
