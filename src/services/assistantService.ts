import { listAppointments } from '@/services/appointmentService';
import { listCustomers } from '@/services/customerService';
import {
  listDaySlots,
  listMonthSummary,
  listWeeklyTemplate,
  type OwnerDaySlot,
} from '@/services/availabilityService';
import { listQueuedRequests } from '@/services/requestService';
import { addDays, salonDayRange, toSalonDate } from '@/lib/format';
import {
  analyzeDayOfWeekTrend,
  findScheduleConflicts,
  forecastCancellationRisk,
  rankRepeatCustomers,
  summarizeBusiness,
  type BusinessAnalyticsSummary,
  type CancellationRisk,
  type DayOfWeekTrend,
  type RepeatCustomerInsight,
  type ScheduleConflict,
} from '@/lib/insights';
import { LIVE_STATUSES } from '@/types';

/**
 * The AI Assistant's data layer — each function fetches what one module
 * needs and hands it to the matching pure computation in `@/lib/insights`.
 * Everything here reads existing tables through existing RPCs/views; none
 * of it writes anything. A module's real action (reschedule, send, mark
 * complete) goes through the same service functions the rest of the
 * dashboard already uses.
 */

export async function getScheduleConflicts(
  timezone: string,
  windowDays = 14,
): Promise<ScheduleConflict[]> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(today, timezone).start;
  const to = salonDayRange(addDays(today, windowDays - 1), timezone).end;
  const appointments = await listAppointments({ from, to, statuses: [...LIVE_STATUSES] });
  return findScheduleConflicts(appointments);
}

export interface OpenSlotSuggestion {
  date: string;
  slot: OwnerDaySlot;
}

/**
 * How many candidate days' slots to fetch per round trip. A busy period can
 * put most of the 60-day horizon into `candidateDates`; fetching one date at
 * a time would chain that many sequential requests before the panel resolves.
 * Batching keeps the earliest-first ordering (each batch is still processed
 * in date order) while cutting the worst case to horizon/BATCH round trips.
 */
const DAY_SLOTS_BATCH_SIZE = 10;

/** Earliest free published times on/after `fromDate`, up to `limit`. */
export async function suggestOpenSlots(
  fromDate: string,
  limit = 5,
): Promise<OpenSlotSuggestion[]> {
  const horizonEnd = addDays(fromDate, 60);
  const summary = await listMonthSummary(fromDate, horizonEnd);
  const candidateDates = summary
    .filter((d) => d.on_date >= fromDate && d.slot_count > d.booked_count)
    .sort((a, b) => a.on_date.localeCompare(b.on_date));

  const suggestions: OpenSlotSuggestion[] = [];
  for (
    let i = 0;
    i < candidateDates.length && suggestions.length < limit;
    i += DAY_SLOTS_BATCH_SIZE
  ) {
    const batch = candidateDates.slice(i, i + DAY_SLOTS_BATCH_SIZE);
    const batchSlots = await Promise.all(batch.map((day) => listDaySlots(day.on_date)));
    for (let b = 0; b < batch.length && suggestions.length < limit; b += 1) {
      const day = batch[b];
      const slots = batchSlots[b];
      if (!day || !slots) continue;
      for (const slot of slots) {
        if (suggestions.length >= limit) break;
        if (!slot.is_booked && !slot.is_past) {
          suggestions.push({ date: day.on_date, slot });
        }
      }
    }
  }
  return suggestions;
}

export async function getBusinessAnalytics(
  timezone: string,
): Promise<BusinessAnalyticsSummary> {
  const today = toSalonDate(new Date(), timezone);
  const windowFrom = salonDayRange(addDays(today, -90), timezone).start;
  const windowTo = salonDayRange(today, timezone).end;
  const windowAppointments = await listAppointments({ from: windowFrom, to: windowTo });

  const monthFrom = salonDayRange(`${today.slice(0, 7)}-01`, timezone).start;
  const monthAppointments = windowAppointments.filter(
    (a) => a.starts_at >= monthFrom.toISOString(),
  );

  return summarizeBusiness(windowAppointments, monthAppointments);
}

export async function getDayOfWeekTrend(timezone: string): Promise<DayOfWeekTrend[]> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(addDays(today, -90), timezone).start;
  const to = salonDayRange(today, timezone).end;
  const [appointments, template] = await Promise.all([
    listAppointments({ from, to }),
    listWeeklyTemplate(),
  ]);
  // A rescheduled row is superseded by its replacement, and a rejected one
  // never happened — neither is a real day the salon was busy.
  const counted = appointments.filter(
    (a) => a.status !== 'rescheduled' && a.status !== 'rejected',
  );
  return analyzeDayOfWeekTrend(counted, template, timezone);
}

export async function getRepeatCustomers(
  timezone: string,
): Promise<RepeatCustomerInsight[]> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(addDays(today, -730), timezone).start;
  const to = salonDayRange(today, timezone).end;
  const [customers, completed] = await Promise.all([
    listCustomers(),
    listAppointments({ from, to, statuses: ['completed'] }),
  ]);
  return rankRepeatCustomers(customers, completed);
}

export async function getCancellationForecast(
  timezone: string,
): Promise<CancellationRisk[]> {
  const today = toSalonDate(new Date(), timezone);
  const upcomingFrom = salonDayRange(today, timezone).start;
  const upcomingTo = salonDayRange(addDays(today, 30), timezone).end;
  const historyFrom = salonDayRange(addDays(today, -730), timezone).start;

  const [upcoming, history] = await Promise.all([
    listAppointments({
      from: upcomingFrom,
      to: upcomingTo,
      statuses: ['confirmed', 'pending_approval'],
    }),
    listAppointments({ from: historyFrom, to: upcomingFrom, statuses: ['no_show'] }),
  ]);

  const noShowCountByCustomer = new Map<string, number>();
  for (const a of history) {
    noShowCountByCustomer.set(
      a.customer_id,
      (noShowCountByCustomer.get(a.customer_id) ?? 0) + 1,
    );
  }

  return forecastCancellationRisk(upcoming, noShowCountByCustomer);
}

export interface RecentMessage {
  id: string;
  kind: 'appointment_note' | 'waitlist_request';
  customerName: string;
  customerEmail: string;
  text: string;
  createdAt: string;
}

/**
 * The closest thing this app has to an "inbox": recent free-text notes a
 * customer left, either on a booking (`customer_note`) or a waitlist
 * request. There is no reply-tracking or read/unread state — just what
 * was said, most recent first.
 */
export async function getRecentMessages(
  timezone: string,
  limit = 20,
): Promise<RecentMessage[]> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(addDays(today, -7), timezone).start;
  const to = salonDayRange(addDays(today, 60), timezone).end;

  const [appointments, requests] = await Promise.all([
    listAppointments({ from, to }),
    listQueuedRequests(),
  ]);

  const fromAppointments: RecentMessage[] = appointments
    .filter((a) => (a.customer_note ?? '').trim().length > 0)
    .map((a) => ({
      id: a.id,
      kind: 'appointment_note',
      customerName: a.customer_name ?? 'Customer',
      customerEmail: a.customer_email ?? '',
      text: a.customer_note ?? '',
      createdAt: a.created_at,
    }));

  const fromRequests: RecentMessage[] = requests
    .filter((r) => (r.notes ?? '').trim().length > 0)
    .map((r) => ({
      id: r.id,
      kind: 'waitlist_request',
      customerName: r.full_name,
      customerEmail: r.email,
      text: r.notes ?? '',
      createdAt: r.created_at,
    }));

  return [...fromAppointments, ...fromRequests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
