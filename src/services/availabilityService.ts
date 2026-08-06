import { supabase } from '@/lib/supabase';
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
