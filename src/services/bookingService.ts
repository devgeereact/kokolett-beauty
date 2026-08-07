import { supabase } from '@/lib/supabase';
import { toSalonDate } from '@/lib/format';
import type { BookingResult, TimeSlot } from '@/types';

/**
 * The public booking path.
 *
 * Two rules, both enforced server-side rather than here:
 *   - Slots come from `available_slots()`, which subtracts live appointments
 *     under `security definer`. The browser never sees what is taken.
 *   - Bookings go through `book_appointment()`. There is no client insert on
 *     `appointments`, and no RLS policy that would allow one.
 */

export interface SlotsByDate {
  /** `yyyy-mm-dd` in salon time → slots open that day. */
  slotsByDate: Record<string, TimeSlot[]>;
  openDates: string[];
}

export async function fetchAvailableSlots(
  serviceId: string,
  fromDate: string,
  toDate: string,
  durationMin: number,
  timezone: string,
): Promise<SlotsByDate> {
  const { data, error } = await supabase.rpc('available_slots', {
    p_service_id: serviceId,
    p_from: fromDate,
    p_to: toDate,
  });

  if (error) throw error;

  const slotsByDate: Record<string, TimeSlot[]> = {};

  for (const row of data ?? []) {
    const startsAt = row.slot_start;
    if (!startsAt) continue;

    const date = toSalonDate(startsAt, timezone);
    const endsAt = new Date(
      new Date(startsAt).getTime() + durationMin * 60_000,
    ).toISOString();

    const label = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(startsAt));

    (slotsByDate[date] ??= []).push({ startsAt, endsAt, label });
  }

  return { slotsByDate, openDates: Object.keys(slotsByDate).sort() };
}

export interface BookingInput {
  serviceId: string;
  startsAt: string;
  fullName: string;
  email: string;
  mobile: string;
  note: string;
  marketingConsent: boolean;
}

export async function submitBooking(input: BookingInput): Promise<BookingResult> {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_service_id: input.serviceId,
    p_starts_at: input.startsAt,
    p_full_name: input.fullName.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_mobile: input.mobile.trim() || undefined,
    p_note: input.note.trim() || undefined,
    p_consent: input.marketingConsent,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('NOT_FOUND');
  return row as BookingResult;
}

export interface AvailabilityRequestInput {
  fullName: string;
  email: string;
  mobile: string;
  serviceId: string | null;
  preferredDates: string[];
  preferredTimes: string;
  flexibility: 'any' | 'morning' | 'afternoon' | 'evening';
  notes: string;
}

/**
 * The no-availability path. Anon may insert only with `status = 'new'` and no
 * linked appointment — the RLS policy enforces both, so a caller cannot forge
 * a request that looks already-converted.
 */
export async function submitAvailabilityRequest(
  input: AvailabilityRequestInput,
): Promise<void> {
  const { error } = await supabase.from('availability_requests').insert({
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile.trim() || null,
    service_id: input.serviceId,
    preferred_dates: input.preferredDates,
    preferred_times: input.preferredTimes.trim() || null,
    flexibility: input.flexibility,
    notes: input.notes.trim() || null,
    status: 'new',
  });

  if (error) throw error;
}
