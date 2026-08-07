import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';
import type {
  AvailabilityException,
  AvailabilityExceptionInsert,
  AvailabilityRule,
  AvailabilityRuleInsert,
} from '@/types';

/**
 * Opening hours: standing weekly rules, plus dated exceptions that override them.
 *
 * "Closed" is the absence of a rule, not a row with `is_open = false` —
 * `book_appointment()` requires a matching open rule for the slot, so a day with
 * no rule rejects every booking. `is_open` exists so the owner can suspend a
 * day's hours without losing the times she had set.
 */

export async function listRules(): Promise<AvailabilityRule[]> {
  const { data, error } = await supabase
    .from('availability_rules')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('opens_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createRule(
  input: AvailabilityRuleInsert,
): Promise<AvailabilityRule> {
  const { data, error } = await supabase
    .from('availability_rules')
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateRule(
  id: string,
  patch: Partial<AvailabilityRuleInsert>,
): Promise<AvailabilityRule> {
  const { data, error } = await supabase
    .from('availability_rules')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('availability_rules').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Exceptions from today onward. Past ones are dead weight on every page load,
 * and nothing in the app can act on them.
 */
export async function listUpcomingExceptions(
  fromDate: string,
): Promise<AvailabilityException[]> {
  const { data, error } = await supabase
    .from('availability_exceptions')
    .select('*')
    .gte('on_date', fromDate)
    .order('on_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface DayWindow {
  starts_at: string;
  ends_at: string;
}

/**
 * Publish one date's hours, replacing whatever governed it.
 *
 * `null` reverts to the standing weekly hours; `[]` closes the day; a list
 * publishes exactly those windows and ignores the weekly rule. Breaks are left
 * untouched — "I am out between 12 and 1" should survive a change of hours.
 */
export async function setDayAvailability(
  date: string,
  windows: DayWindow[] | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_day_availability', {
    p_date: date,
    // The generated arg type is `Json`; a struct array is valid JSON but the
    // structural check cannot see that through the interface.
    p_windows: windows as unknown as Json,
  });
  if (error) throw error;
}

export interface OwnerDaySlot {
  starts_at: string;
  local_time: string;
  /** `window` came from opening hours; `explicit` was published on its own. */
  source: string;
  is_booked: boolean;
  is_past: boolean;
  reference: string | null;
  customer_name: string | null;
}

/**
 * Every start time a day offers, annotated.
 *
 * Unlike the customer-facing engine this hides nothing — booked and past slots
 * are included, because "why can nobody book 2pm?" is the question this screen
 * exists to answer.
 *
 * Slot length depends on the service, so the grid is always relative to one:
 * a 14:00 slot is free for a trim and busy for a colour.
 */
export async function listOwnerDaySlots(
  date: string,
  serviceId: string,
): Promise<OwnerDaySlot[]> {
  const { data, error } = await supabase.rpc('owner_day_slots', {
    p_date: date,
    p_service_id: serviceId,
  });
  if (error) throw error;
  return data ?? [];
}

/** Publish a single start time. Must sit on the granularity grid. */
export async function addDaySlot(date: string, time: string): Promise<void> {
  const { error } = await supabase.rpc('add_day_slot', {
    p_date: date,
    p_time: time,
  });
  if (error) throw error;
}

/**
 * Delete a published start time.
 *
 * Resolves `false` when the slot came from opening hours rather than being
 * published on its own — there is nothing to delete, and the caller should
 * offer to switch the day to exact times instead.
 */
export async function removeDaySlot(date: string, time: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('remove_day_slot', {
    p_date: date,
    p_time: time,
  });
  if (error) throw error;
  return data === true;
}

/** Freeze the day's current slots into an editable list and close the windows. */
export async function materialiseDaySlots(
  date: string,
  serviceId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('materialise_day_slots', {
    p_date: date,
    p_service_id: serviceId,
  });
  if (error) throw error;
  return data ?? 0;
}

/** Drop every published slot for a date, handing the day back to its hours. */
export async function clearDaySlots(date: string): Promise<number> {
  const { data, error } = await supabase.rpc('clear_day_slots', { p_date: date });
  if (error) throw error;
  return data ?? 0;
}

/** Published start times across a range, for the month grid. */
export async function listSlotsBetween(
  fromDate: string,
  toDate: string,
): Promise<{ on_date: string; starts_at: string }[]> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('on_date, starts_at')
    .gte('on_date', fromDate)
    .lte('on_date', toDate)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Exceptions inside a date range — one query per rendered calendar month. */
export async function listExceptionsBetween(
  fromDate: string,
  toDate: string,
): Promise<AvailabilityException[]> {
  const { data, error } = await supabase
    .from('availability_exceptions')
    .select('*')
    .gte('on_date', fromDate)
    .lte('on_date', toDate)
    .order('on_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createException(
  input: AvailabilityExceptionInsert,
): Promise<AvailabilityException> {
  const { data, error } = await supabase
    .from('availability_exceptions')
    .insert(input)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteException(id: string): Promise<void> {
  const { error } = await supabase.from('availability_exceptions').delete().eq('id', id);
  if (error) throw error;
}
