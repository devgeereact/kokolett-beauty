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

export type TemplateCategory =
  | 'Booking'
  | 'Reminders'
  | 'Reviews'
  | 'Availability requests'
  | 'Account access'
  | 'Owner notifications';

export interface TemplateMeta {
  key: string;
  label: string;
  description: string;
  category: TemplateCategory;
  icon: LucideIcon;
  /** `{{token}}` names this template's payload actually carries — see `buildTokens` in `supabase/functions/_shared/templates.ts`. */
  variables: string[];
}

const BOOKING_VARS = [
  'customer_name',
  'appointment_date',
  'appointment_time',
  'service_name',
  'reference',
  'manage_url',
];
const OWNER_BOOKING_VARS = [
  'customer_name',
  'customer_email',
  'customer_mobile',
  'appointment_date',
  'appointment_time',
  'service_name',
  'customer_note',
];
const REQUEST_VARS = [
  'full_name',
  'email',
  'mobile',
  'preferred_dates',
  'flexibility',
  'notes',
];

/**
 * The fixed set of transactional templates the outbox sends from. Each has a
 * matching row in `email_templates` (migration 0032): when the owner switches
 * that row on and opts it into automation, `send-emails` renders her edited
 * `subject`/`html_body` — with the `variables` below substituted — in place
 * of the hard-coded copy in `supabase/functions/_shared/templates.ts`.
 */
export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    key: 'booking_confirmed',
    label: 'Booking confirmed',
    description: 'Sent to a customer the moment their appointment is confirmed.',
    category: 'Booking',
    icon: Calendar,
    variables: BOOKING_VARS,
  },
  {
    key: 'booking_approved',
    label: 'Booking approved',
    description: "Sent when a first-time customer's held booking is approved.",
    category: 'Booking',
    icon: CheckCircle2,
    variables: BOOKING_VARS,
  },
  {
    key: 'booking_rescheduled',
    label: 'Booking rescheduled',
    description: 'Sent when an appointment moves to a new time.',
    category: 'Booking',
    icon: CalendarClock,
    variables: [
      ...BOOKING_VARS,
      'previous_appointment_date',
      'previous_appointment_time',
    ],
  },
  {
    key: 'booking_held',
    label: 'Booking held for approval',
    description: 'Sent to a first-time customer while their booking awaits approval.',
    category: 'Booking',
    icon: Calendar,
    variables: [...BOOKING_VARS, 'approval_window_h'],
  },
  {
    key: 'booking_declined',
    label: 'Booking declined',
    description: 'Sent when the salon is unable to offer a held booking.',
    category: 'Booking',
    icon: CalendarX,
    variables: [...BOOKING_VARS, 'reason'],
  },
  {
    key: 'booking_cancelled',
    label: 'Booking cancelled',
    description: 'Sent when an appointment is cancelled, by either side.',
    category: 'Booking',
    icon: CalendarX,
    variables: [...BOOKING_VARS, 'reason'],
  },
  {
    key: 'reminder_24h',
    label: '24-hour reminder',
    description: 'Sent a day ahead of an upcoming appointment.',
    category: 'Reminders',
    icon: Bell,
    variables: BOOKING_VARS,
  },
  {
    key: 'reminder_2h',
    label: '2-hour reminder',
    description: 'Sent two hours ahead of an upcoming appointment.',
    category: 'Reminders',
    icon: Bell,
    variables: BOOKING_VARS,
  },
  {
    key: 'reminder_1h',
    label: '1-hour reminder',
    description: 'Sent an hour ahead of an upcoming appointment.',
    category: 'Reminders',
    icon: Bell,
    variables: BOOKING_VARS,
  },
  {
    key: 'appointment_completed',
    label: 'Appointment completed',
    description: 'Sent once an appointment is marked complete.',
    category: 'Reviews',
    icon: CheckCircle2,
    variables: ['customer_name', 'appointment_date', 'service_name', 'google_review_url'],
  },
  {
    key: 'review_request',
    label: 'Review request',
    description: 'Sent a couple of hours after completion, asking for a Google review.',
    category: 'Reviews',
    icon: Star,
    variables: ['customer_name', 'appointment_date', 'service_name', 'google_review_url'],
  },
  {
    key: 'request_received',
    label: 'Availability request received',
    description: "Sent to confirm a customer's waitlist request has been logged.",
    category: 'Availability requests',
    icon: CalendarClock,
    variables: REQUEST_VARS,
  },
  {
    key: 'access_link',
    label: 'Manage booking link',
    description: 'A magic link so a customer can view or change their booking.',
    category: 'Account access',
    icon: Key,
    variables: ['manage_url'],
  },
  {
    key: 'owner_password_reset',
    label: 'Owner password reset',
    description: "Sent to the owner's own login email to reset the dashboard password.",
    category: 'Account access',
    icon: Key,
    variables: ['reset_url', 'reset_ttl_minutes'],
  },
  {
    key: 'owner_approval_needed',
    label: 'Owner: approval needed',
    description: 'Sent to the owner when a first-time booking needs a decision.',
    category: 'Owner notifications',
    icon: UserPlus,
    variables: OWNER_BOOKING_VARS,
  },
  {
    key: 'owner_booking_moved',
    label: 'Owner: booking moved',
    description: 'Sent to the owner when a customer reschedules themselves.',
    category: 'Owner notifications',
    icon: Bell,
    variables: [
      'customer_name',
      'customer_email',
      'customer_mobile',
      'previous_appointment_date',
      'previous_appointment_time',
    ],
  },
  {
    key: 'owner_new_booking',
    label: 'Owner: new booking',
    description: 'Sent to the owner whenever a new appointment is booked.',
    category: 'Owner notifications',
    icon: Mail,
    variables: OWNER_BOOKING_VARS,
  },
  {
    key: 'owner_new_request',
    label: 'Owner: new request',
    description: 'Sent to the owner when a new availability request comes in.',
    category: 'Owner notifications',
    icon: Bell,
    variables: REQUEST_VARS,
  },
];

export function templateMeta(key: string): TemplateMeta | undefined {
  return TEMPLATE_CATALOG.find((t) => t.key === key);
}

/**
 * Human label for an `email_messages.template` value.
 *
 * This lived in a second file (`lib/emailTemplates.ts`) as a flat
 * `Record<string, string>` holding the same eighteen keys with the same
 * eighteen labels. Two registries for one fixed set means the Email log and
 * the Template Editor could disagree about what a template is called, which is
 * exactly the sort of drift the owner would notice and nobody would explain.
 */
export function templateLabel(template: string): string {
  return templateMeta(template)?.label ?? template;
}
