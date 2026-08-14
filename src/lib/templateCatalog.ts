import {
  Bell,
  Calendar,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Key,
  Mail,
  Star,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export type TemplateCategory = 'Booking' | 'Reminders' | 'Reviews' | 'Availability requests' | 'Account access' | 'Owner notifications';

export interface TemplateMeta {
  key: string;
  label: string;
  description: string;
  category: TemplateCategory;
  icon: LucideIcon;
}

/**
 * The fixed set of transactional templates the outbox actually sends from —
 * hard-coded in `supabase/functions/_shared/templates.ts`, not a database
 * table. Nothing here is user-editable or creatable; this is a catalogue of
 * what exists, not a template builder.
 */
export const TEMPLATE_CATALOG: TemplateMeta[] = [
  { key: 'booking_confirmed', label: 'Booking confirmed', description: 'Sent to a customer the moment their appointment is confirmed.', category: 'Booking', icon: Calendar },
  { key: 'booking_approved', label: 'Booking approved', description: "Sent when a first-time customer's held booking is approved.", category: 'Booking', icon: CheckCircle2 },
  { key: 'booking_rescheduled', label: 'Booking rescheduled', description: 'Sent when an appointment moves to a new time.', category: 'Booking', icon: CalendarClock },
  { key: 'booking_held', label: 'Booking held for approval', description: 'Sent to a first-time customer while their booking awaits approval.', category: 'Booking', icon: Calendar },
  { key: 'booking_declined', label: 'Booking declined', description: 'Sent when the salon is unable to offer a held booking.', category: 'Booking', icon: CalendarX },
  { key: 'booking_cancelled', label: 'Booking cancelled', description: 'Sent when an appointment is cancelled, by either side.', category: 'Booking', icon: CalendarX },
  { key: 'reminder_24h', label: '24-hour reminder', description: 'Sent a day ahead of an upcoming appointment.', category: 'Reminders', icon: Bell },
  { key: 'reminder_2h', label: '2-hour reminder', description: 'Sent two hours ahead of an upcoming appointment.', category: 'Reminders', icon: Bell },
  { key: 'reminder_1h', label: '1-hour reminder', description: 'Sent an hour ahead of an upcoming appointment.', category: 'Reminders', icon: Bell },
  { key: 'appointment_completed', label: 'Appointment completed', description: 'Sent once an appointment is marked complete.', category: 'Reviews', icon: CheckCircle2 },
  { key: 'review_request', label: 'Review request', description: 'Sent a couple of hours after completion, asking for a Google review.', category: 'Reviews', icon: Star },
  { key: 'request_received', label: 'Availability request received', description: "Sent to confirm a customer's waitlist request has been logged.", category: 'Availability requests', icon: CalendarClock },
  { key: 'access_link', label: 'Manage booking link', description: 'A magic link so a customer can view or change their booking.', category: 'Account access', icon: Key },
  { key: 'owner_password_reset', label: 'Owner password reset', description: "Sent to the owner's own login email to reset the dashboard password.", category: 'Account access', icon: Key },
  { key: 'owner_approval_needed', label: 'Owner: approval needed', description: 'Sent to the owner when a first-time booking needs a decision.', category: 'Owner notifications', icon: UserPlus },
  { key: 'owner_booking_moved', label: 'Owner: booking moved', description: 'Sent to the owner when a customer reschedules themselves.', category: 'Owner notifications', icon: Bell },
  { key: 'owner_new_booking', label: 'Owner: new booking', description: 'Sent to the owner whenever a new appointment is booked.', category: 'Owner notifications', icon: Mail },
  { key: 'owner_new_request', label: 'Owner: new request', description: 'Sent to the owner when a new availability request comes in.', category: 'Owner notifications', icon: Bell },
];

export function templateMeta(key: string): TemplateMeta | undefined {
  return TEMPLATE_CATALOG.find((t) => t.key === key);
}
