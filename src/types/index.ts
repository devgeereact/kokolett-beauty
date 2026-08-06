import type { Database } from '@/types/database.types';

/**
 * Convenience row aliases from the generated schema.
 *
 * NOTE: `database.types.ts` currently reflects 0001_init.sql only. After applying
 * `supabase/migrations/0002_salon.sql`, regenerate it:
 *
 *   supabase gen types typescript --project-id <ref> --schema public \
 *     > src/types/database.types.ts
 *
 * The domain types below are hand-written against 0002 so the app can be built
 * before the database exists. Once the file above is regenerated, prefer the
 * generated rows and delete the duplicates here.
 */
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type AppSettings = Database['public']['Tables']['app_settings']['Row'];
export type AppSettingsUpdate = Database['public']['Tables']['app_settings']['Update'];

export type ThemeMode = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/* ---------------------------------------------------------------- domain -- */

export type AppointmentStatus =
  | 'pending_approval'
  | 'confirmed'
  | 'checked_in'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'rescheduled'
  | 'no_show';

export type AvailabilityRequestStatus =
  'new' | 'awaiting_response' | 'offer_sent' | 'converted' | 'declined' | 'expired';

export type EmailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'bounced';
export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'expired';
export type ExceptionKind = 'closure' | 'extra_hours' | 'break';
export type Flexibility = 'any' | 'morning' | 'afternoon' | 'evening';

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

export interface Service {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  /** Chair time, excluding buffer. */
  duration_min: number;
  /** Clean-down time reserved after the appointment. */
  buffer_min: number;
  /** Always integer pence. Never a float — money is not a float. */
  price_pence: number;
  image_path: string | null;
  is_active: boolean;
  sort_order: number;
  archived_at: string | null;
}

export interface Customer {
  id: string;
  email: string;
  mobile: string | null;
  full_name: string;
  notes: string | null;
  marketing_consent: boolean;
  first_seen_at: string;
  last_seen_at: string | null;
  deleted_at: string | null;
}

export interface Appointment {
  id: string;
  reference: string;
  customer_id: string;
  service_id: string;
  /** UTC ISO 8601. Always convert with the salon timezone for display. */
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_pence: number;
  customer_note: string | null;
  owner_note: string | null;
  source: 'web' | 'owner' | 'availability_request';
  requires_approval: boolean;
  approval_deadline: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  review_requested_at: string | null;
}

export interface AvailabilityRule {
  id: string;
  /** 0 = Sunday, matching Postgres `extract(dow …)`. */
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
}

export interface AvailabilityException {
  id: string;
  kind: ExceptionKind;
  on_date: string;
  starts_at: string | null;
  ends_at: string | null;
  reason: string | null;
}

export interface BookingSettings {
  timezone: string;
  slot_granularity_min: number;
  default_buffer_min: number;
  lead_time_min: number;
  max_horizon_days: number;
  max_appointments_per_day: number;
  cancellation_window_h: number;
  /** Hybrid policy switch: hold first-time bookings for owner approval. */
  approve_first_time: boolean;
  approval_window_h: number;
  google_review_url: string | null;
}

export interface AvailabilityRequest {
  id: string;
  customer_id: string | null;
  full_name: string;
  email: string;
  mobile: string | null;
  service_id: string | null;
  preferred_dates: string[];
  preferred_times: string | null;
  flexibility: Flexibility;
  notes: string | null;
  status: AvailabilityRequestStatus;
  owner_response: string | null;
  responded_at: string | null;
  converted_appointment_id: string | null;
  created_at: string;
}

export interface AiRecommendation {
  id: string;
  kind: string;
  title: string;
  rationale: string | null;
  payload: Record<string, unknown>;
  confidence: number | null;
  status: RecommendationStatus;
  created_at: string;
}

/** A bookable slot produced by the availability engine. */
export interface TimeSlot {
  /** UTC ISO 8601 start. */
  startsAt: string;
  endsAt: string;
  /** Local display label, e.g. "10:15". */
  label: string;
}

/** Result of `public.book_appointment(...)`. */
export interface BookingResult {
  appointment_id: string;
  reference: string;
  status: Extract<AppointmentStatus, 'confirmed' | 'pending_approval'>;
}

/** Error codes raised by `book_appointment`. Surface these as copy, not stack traces. */
export type BookingErrorCode =
  | 'SERVICE_UNAVAILABLE'
  | 'SLOT_MISALIGNED'
  | 'LEAD_TIME_VIOLATION'
  | 'BEYOND_BOOKING_HORIZON'
  | 'OUTSIDE_AVAILABILITY'
  | 'DAILY_CAPACITY_REACHED'
  | 'SLOT_TAKEN';
