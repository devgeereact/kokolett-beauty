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

/* ------------------------------------------------------------- weekly --- */

export interface WeeklyTemplateStatus {
  template_slot_count: number;
  /** Furthest future date the generator has already ruled on, or null. */
  filled_to: string | null;
  horizon_days: number;
  granularity_min: number;
}

export interface TemplateDay {
  day_of_week: number;
  times: string[];
}

/**
 * The repeating week.
 *
 * It is a **generator, not a source**: applying it writes real rows into
 * `availability_slots`, and nothing consults it when a booking is made. That is
 * deliberate — the whole point of the 0011 rebuild was that availability has
 * exactly one source, and a pattern read at booking time would be a second.
 */
export async function listWeeklyTemplate(): Promise<TemplateDay[]> {
  const { data, error } = await supabase
    .from('weekly_template')
    .select('day_of_week, starts_at')
    .order('day_of_week', { ascending: true })
    .order('starts_at', { ascending: true });

  if (error) throw error;

  const byDay = new Map<number, string[]>();
  for (const row of data ?? []) {
    const list = byDay.get(row.day_of_week) ?? [];
    list.push(row.starts_at.slice(0, 5));
    byDay.set(row.day_of_week, list);
  }
  return [...Array(7).keys()].map((day_of_week) => ({
    day_of_week,
    times: byDay.get(day_of_week) ?? [],
  }));
}

export async function setWeeklyTemplateDay(
  dayOfWeek: number,
  times: string[],
): Promise<void> {
  const { error } = await supabase.rpc('set_weekly_template', {
    p_day_of_week: dayOfWeek,
    p_times: times,
  });
  if (error) throw error;
}

/**
 * Write the pattern into real days.
 *
 * `replace: false` only fills days nobody has ruled on yet, so a day the owner
 * cleared stays cleared. `replace: true` is the deliberate "lay my week over
 * the top" action — and still cannot remove a time that has a booking.
 */
export async function applyWeeklyTemplate(
  fromDate: string,
  toDate: string,
  replace = false,
): Promise<{ days_filled: number; slots_written: number }> {
  const { data, error } = await supabase.rpc('apply_weekly_template', {
    p_from: fromDate,
    p_to: toDate,
    p_replace: replace,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { days_filled: 0, slots_written: 0 };
}

export async function getWeeklyTemplateStatus(): Promise<WeeklyTemplateStatus> {
  const { data, error } = await supabase.rpc('weekly_template_status');
  if (error) throw error;
  return data as unknown as WeeklyTemplateStatus;
}
