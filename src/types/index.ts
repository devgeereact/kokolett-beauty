import type { Database } from '@/types/database.types';

/**
 * Row aliases over the generated schema.
 *
 * `database.types.ts` is generated from the live database (0001 → 0003) with:
 *
 *   supabase gen types typescript --project-id <ref> --schema public \
 *     > src/types/database.types.ts
 *
 * Regenerate it after every migration. Everything below derives from it, so a
 * schema change that breaks the app shows up as a type error rather than as a
 * runtime surprise.
 */
type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];
type Enums = Database['public']['Enums'];

export type Profile = Tables['profiles']['Row'];
export type ProfileUpdate = Tables['profiles']['Update'];

export type AppSettings = Tables['app_settings']['Row'];
export type AppSettingsUpdate = Tables['app_settings']['Update'];

export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/**
 * A toast's optional action button — e.g. "Undo" on a status change.
 * `onClick` fires once, then the toast dismisses itself.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** What a caller passes to `useToast().showToast(...)`. */
export interface ToastOptions {
  message: string;
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Defaults to 8000 — see `src/components/ui/Toast.tsx`. */
  duration?: number;
}

/** A queued toast, as rendered by `ToastStack`. */
export interface ToastItem extends ToastOptions {
  id: string;
}

/* ---------------------------------------------------------------- enums --- */

export type AppointmentStatus = Enums['appointment_status'];
export type AvailabilityRequestStatus = Enums['availability_request_status'];
export type EmailStatus = Enums['email_status'];
export type RecommendationStatus = Enums['recommendation_status'];
export type Flexibility = 'any' | 'morning' | 'afternoon' | 'evening';

/** The statuses that occupy the calendar — mirrors `appointments_no_overlap`. */
export const LIVE_STATUSES = [
  'pending_approval',
  'confirmed',
  'checked_in',
  'in_service',
  'completed',
] as const satisfies readonly AppointmentStatus[];

/* --------------------------------------------------------------- domain --- */

export type ServiceCategory = Tables['service_categories']['Row'];
export type ServiceCategoryInsert = Tables['service_categories']['Insert'];

export type Service = Tables['services']['Row'];
export type ServiceInsert = Tables['services']['Insert'];
export type ServiceUpdate = Tables['services']['Update'];

export type Customer = Tables['customers']['Row'];
export type CustomerUpdate = Tables['customers']['Update'];

export type Appointment = Tables['appointments']['Row'];
export type AppointmentUpdate = Tables['appointments']['Update'];

/**
 * Appointment joined to its customer and service. Every owner screen uses this
 * rather than `appointments`, because a row without the customer's name and the
 * service name is not something anyone can act on.
 *
 * The view is `security_invoker`, so RLS on the base tables still governs it.
 * Generated view columns are all nullable; the joins are inner and the columns
 * are `not null` at source, so the non-null assertions in the alias below are
 * narrowing, not wishful thinking.
 */
type DetailedRow = Views['appointments_detailed']['Row'];
export type AppointmentDetailed = Omit<DetailedRow, keyof Appointment> & Appointment;

/**
 * Availability is one table since 0011: a day is a list of start times.
 * `availability_rules` and `availability_exceptions` were dropped with the
 * weekly-pattern model they belonged to.
 */
export type AvailabilitySlot = Tables['availability_slots']['Row'];

export type BookingSettings = Tables['booking_settings']['Row'];
export type BookingSettingsUpdate = Tables['booking_settings']['Update'];

export type AvailabilityRequest = Tables['availability_requests']['Row'];
export type EmailMessage = Tables['email_messages']['Row'];
export type AiRecommendation = Tables['ai_recommendations']['Row'];
export type AuditEvent = Tables['audit_events']['Row'];

/** Shape returned by `public.owner_dashboard_summary()`. */
export interface OwnerSummary {
  today: string;
  timezone: string;
  today_count: number;
  today_collected_pence: number;
  pending_approval_count: number;
  /** Holds inside their final two hours — the ones that need answering now. */
  urgent_approval_count: number;
  new_request_count: number;
  upcoming_7d_count: number;
  active_service_count: number;
  customer_count: number;
  failed_email_count: number;
}

/** One scheduled job's most recent run, from `public.system_health_summary()`. */
export interface SystemHealthJob {
  name: string;
  active: boolean;
  schedule: string;
  last_status: string | null;
  last_start: string | null;
  last_end: string | null;
  last_message: string | null;
}

/** Shape returned by `public.system_health_summary()`. */
export interface SystemHealth {
  jobs: SystemHealthJob[];
  email: {
    queued_count: number;
    failed_count: number;
  };
  reviews: {
    last_fetched_at: string | null;
    last_error: string | null;
  };
}

/** A bookable slot produced by the availability engine. */
export interface TimeSlot {
  /** UTC ISO 8601 start. */
  startsAt: string;
  endsAt: string;
  /** Local display label, e.g. "10:15". */
  label: string;
}

/**
 * The menu of styles on the home page.
 *
 * Distinct from `Service`, which is the one bookable appointment type. A menu
 * row is descriptive only: it tells a visitor the salon does knotless braids,
 * it does not create a bookable product.
 */
export type ServiceMenuItem = Tables['service_menu']['Row'];

export type EmailTemplateRow = Tables['email_templates']['Row'];
export type EmailTemplateUpdate = Tables['email_templates']['Update'];

/** One group as `public_service_menu()` returns it. `duration_min` and
    `image_path` were added to the public shape in migration `0048` — before
    that the RPC returned only `name`/`note`. */
export interface ServiceMenuGroup {
  group_name: string;
  items: {
    name: string;
    note: string | null;
    duration_min: number;
    image_path: string | null;
  }[];
}

export type Subscriber = Tables['subscribers']['Row'];

/** A calendar subscription. The token itself is never in this row. */
export type CalendarFeed = Tables['calendar_feeds']['Row'];

/** Result of `public.book_appointment(...)`. */
export interface BookingResult {
  appointment_id: string;
  reference: string;
  status: Extract<AppointmentStatus, 'confirmed' | 'pending_approval'>;
}

/** Error codes raised by the booking and owner RPCs. Surface as copy, not stack traces. */
export type BookingErrorCode =
  | 'SERVICE_UNAVAILABLE'
  | 'SLOT_MISALIGNED'
  | 'LEAD_TIME_VIOLATION'
  | 'BEYOND_BOOKING_HORIZON'
  | 'OUTSIDE_AVAILABILITY'
  | 'DAILY_CAPACITY_REACHED'
  | 'SLOT_TAKEN'
  | 'NOT_AUTHORISED'
  | 'NOT_PENDING'
  | 'NOT_FOUND'
  | 'ILLEGAL_TRANSITION'
  | 'NAME_INCOMPLETE'
  | 'MOBILE_REQUIRED'
  | 'NOT_RESCHEDULABLE'
  | 'ALREADY_PASSED'
  | 'SAME_TIME'
  | 'INVALID_AMOUNT'
  | 'HAS_PAYMENT'
  | 'TOO_MANY_MESSAGES'
  | 'SLUG_INVALID'
  | 'SLUG_RESERVED';
