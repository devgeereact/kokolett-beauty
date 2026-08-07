import { supabase } from '@/lib/supabase';

/**
 * Availability, in full.
 *
 * A day is a list of start times. If a time is on the list it can be booked; if
 * it is not, it cannot. There is no weekly pattern underneath, no windows to
 * intersect and no exceptions to subtract — those four overlapping ideas were
 * removed in migration 0011 because together they produced screens that
 * contradicted each other.
 *
 * "Blocking out time" is therefore not a feature: you simply do not publish a
 * time, or you delete one you already published.
 */

export interface OwnerDaySlot {
  starts_at: string;
  /** `HH:MM` in salon time. */
  local_time: string;
  is_booked: boolean;
  is_past: boolean;
  reference: string | null;
  customer_name: string | null;
}

export interface DaySummary {
  on_date: string;
  slot_count: number;
  booked_count: number;
}

/** Every time published for one day, booked and past ones included. */
export async function listDaySlots(date: string): Promise<OwnerDaySlot[]> {
  const { data, error } = await supabase.rpc('owner_day_slots', { p_date: date });
  if (error) throw error;
  return data ?? [];
}

/** Slot and booking counts per day — one query for a whole calendar month. */
export async function listMonthSummary(
  fromDate: string,
  toDate: string,
): Promise<DaySummary[]> {
  const { data, error } = await supabase.rpc('month_slot_summary', {
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Replace a day's times wholesale.
 *
 * Wholesale rather than add/remove because the editor holds the day as a list:
 * one call, one outcome, and no chance of the screen and the database
 * disagreeing about a half-applied edit. An empty array clears the day.
 */
export async function setDaySlots(date: string, times: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('set_day_slots', {
    p_date: date,
    p_times: times,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Copy one day's times onto another, replacing whatever the target had. */
export async function copyDaySlots(fromDate: string, toDate: string): Promise<number> {
  const { data, error } = await supabase.rpc('copy_day_slots', {
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) throw error;
  return data ?? 0;
}
