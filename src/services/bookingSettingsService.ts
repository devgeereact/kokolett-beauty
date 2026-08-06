import { supabase } from '@/lib/supabase';
import type { BookingSettings, BookingSettingsUpdate } from '@/types';

/**
 * The single `booking_settings` row (`id` is a boolean primary key checked to
 * `true`, so a second row is impossible by construction).
 *
 * Publicly readable on purpose: the booking UI needs lead time, horizon and
 * granularity before anyone has identified themselves. Nothing sensitive lives
 * here — it is policy, not data.
 */

export async function getBookingSettings(): Promise<BookingSettings | null> {
  const { data, error } = await supabase
    .from('booking_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateBookingSettings(
  patch: BookingSettingsUpdate,
): Promise<BookingSettings> {
  const { data, error } = await supabase
    .from('booking_settings')
    .update(patch)
    .eq('id', true)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
