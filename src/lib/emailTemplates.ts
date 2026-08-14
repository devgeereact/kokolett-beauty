/**
 * Human labels for the `email_messages.template` values, mirrored from the
 * `case` labels in `supabase/functions/_shared/templates.ts` — the actual
 * renderer. Kept as a plain lookup here rather than importing that file
 * (it's a Deno Edge Function module, not built for the browser bundle).
 */
export const TEMPLATE_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking confirmed',
  booking_approved: 'Booking approved',
  booking_rescheduled: 'Booking rescheduled',
  booking_held: 'Booking held for approval',
  booking_declined: 'Booking declined',
  booking_cancelled: 'Booking cancelled',
  reminder_24h: '24-hour reminder',
  reminder_1h: '1-hour reminder',
  reminder_2h: '2-hour reminder',
  appointment_completed: 'Appointment completed',
  review_request: 'Review request',
  request_received: 'Availability request received',
  access_link: 'Manage booking link',
  owner_password_reset: 'Owner password reset',
  owner_approval_needed: 'Owner: approval needed',
  owner_booking_moved: 'Owner: booking moved',
  owner_new_booking: 'Owner: new booking',
  owner_new_request: 'Owner: new request',
};

export function templateLabel(template: string): string {
  return TEMPLATE_LABELS[template] ?? template;
}
