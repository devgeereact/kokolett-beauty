import { supabase } from '@/lib/supabase';
import { listAppointments } from '@/services/appointmentService';
import { listQueuedRequests } from '@/services/requestService';
import { addDays, salonDayRange, toSalonDate } from '@/lib/format';
import { buildAppointmentActivity, type ActivityEvent } from '@/lib/insights';
import type { NotificationEventKind } from '@/lib/notificationCategory';

export interface NotificationEvent {
  id: string;
  kind: NotificationEventKind;
  at: string;
  title: string;
  detail: string;
}

/**
 * The same derived-from-real-timestamps feed as `getRecentActivity`, widened
 * with two more real sources (`payments`, `google_reviews`) and given the
 * shape `NotificationsPage` needs. Still not a stored notifications table —
 * there isn't one, so "read" state lives in `localStorage`
 * (`useNotificationReadState`), not here.
 */
export async function getNotifications(
  timezone: string,
  windowDays = 30,
): Promise<NotificationEvent[]> {
  const today = toSalonDate(new Date(), timezone);
  const from = salonDayRange(addDays(today, -30), timezone).start;
  const to = salonDayRange(addDays(today, 60), timezone).end;
  const cutoff = salonDayRange(addDays(today, -windowDays), timezone).start.toISOString();

  const [appointments, requests, payments, reviews] = await Promise.all([
    listAppointments({ from, to }),
    listQueuedRequests(),
    supabase
      .from('payments')
      .select('id, amount_pence, created_at, appointment_id')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false }),
    supabase
      .from('google_reviews')
      .select('id, author_name, rating, published_at')
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false }),
  ]);

  const appointmentEvents: NotificationEvent[] = buildAppointmentActivity(appointments)
    .filter((e) => e.at >= cutoff)
    .map((e) => activityToNotification(e));

  const requestEvents: NotificationEvent[] = requests
    .filter((r) => r.created_at >= cutoff)
    .map((r) => ({
      id: `request:${r.id}`,
      kind: 'request' as const,
      at: r.created_at,
      title: 'Availability request',
      detail: `${r.full_name} requested a time you haven't published.`,
    }));

  // `appointments` (already fetched above, by `starts_at`) covers most
  // payment rows since bookings and their payments usually fall in the same
  // window; a payment on an appointment outside that window just shows a
  // generic detail line rather than a second round trip to fetch it.
  const appointmentById = new Map(appointments.map((a) => [a.id, a]));
  const paymentEvents: NotificationEvent[] = (payments.data ?? []).map((p) => {
    const appt = appointmentById.get(p.appointment_id);
    return {
      id: `payment:${p.id}`,
      kind: 'payment' as const,
      at: p.created_at,
      title: 'Payment received',
      detail: appt
        ? `You received a payment for ${appt.service_name}${appt.customer_name ? `, ${appt.customer_name}` : ''}.`
        : 'You received a payment.',
    };
  });

  const reviewEvents: NotificationEvent[] = (reviews.data ?? [])
    .filter((r) => r.published_at)
    .map((r) => ({
      id: `review:${r.id}`,
      kind: 'review' as const,
      at: r.published_at as string,
      title: 'New review received',
      detail: `${r.author_name} left you a ${r.rating}-star review.`,
    }));

  return [...appointmentEvents, ...requestEvents, ...paymentEvents, ...reviewEvents].sort(
    (a, b) => b.at.localeCompare(a.at),
  );
}

function activityToNotification(e: ActivityEvent): NotificationEvent {
  const detailByKind: Record<ActivityEvent['kind'], string> = {
    created: e.detail,
    rescheduled: `${e.customerName}'s appointment (${e.reference}) moved to a new time.`,
    cancelled: `${e.customerName}'s appointment (${e.reference}) was cancelled.`,
    rejected: `${e.customerName}'s booking request (${e.reference}) was declined.`,
    completed: `${e.customerName}'s appointment (${e.reference}) has been marked as completed.`,
    no_show: `${e.customerName}'s appointment (${e.reference}) was marked as a no-show.`,
  };
  return {
    id: e.id,
    kind: e.kind,
    at: e.at,
    title: e.customerName
      ? `${e.kind === 'created' ? 'New booking received' : e.kind[0]!.toUpperCase() + e.kind.slice(1)}: ${e.customerName}`
      : e.kind,
    detail: detailByKind[e.kind],
  };
}

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
