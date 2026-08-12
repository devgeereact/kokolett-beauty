import { listAppointments } from '@/services/appointmentService';
import { listQueuedRequests } from '@/services/requestService';
import { addDays, salonDayRange, toSalonDate } from '@/lib/format';
import { buildAppointmentActivity, type ActivityEvent } from '@/lib/insights';

/**
 * A live activity feed, not a stored notifications table — there isn't
 * one. Events are derived from timestamp columns already on `appointments`
 * (created_at, cancelled_at, completed_at, …), so "what happened recently"
 * is always exactly what the data says happened, with nothing to mark
 * read or clear.
 *
 * Appointments are fetched by `starts_at`, not by when they were acted on
 * — there is no created-at-ranged query in this app — so a cancellation on
 * a booking scheduled far outside this window would be missed. In
 * practice nearly all activity concerns near-term bookings, so a wide
 * `starts_at` window catches the real world's worth of it.
 */
export async function getRecentActivity(
  timezone: string,
  windowDays = 14,
): Promise<ActivityEvent[]> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(addDays(today, -30), timezone).start;
  const to = salonDayRange(addDays(today, 60), timezone).end;
  const cutoff = salonDayRange(addDays(today, -windowDays), timezone).start.toISOString();

  const [appointments, requests] = await Promise.all([
    listAppointments({ from, to }),
    listQueuedRequests(),
  ]);

  const appointmentEvents = buildAppointmentActivity(appointments).filter(
    (e) => e.at >= cutoff,
  );

  const requestEvents: ActivityEvent[] = requests
    .filter((r) => r.created_at >= cutoff)
    .map((r) => ({
      id: `request:${r.id}`,
      kind: 'created' as const,
      at: r.created_at,
      customerName: r.full_name,
      reference: '',
      detail: 'New waitlist enquiry',
    }));

  return [...appointmentEvents, ...requestEvents].sort((a, b) =>
    b.at.localeCompare(a.at),
  );
}
