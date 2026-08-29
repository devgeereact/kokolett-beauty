import { supabase } from '@/lib/supabase';
import type { DailyCloseSummary } from '@/types';

/** Today's numbers, read-only — safe to call just to preview, never logs anything. */
export async function getDailyCloseSummary(): Promise<DailyCloseSummary> {
  const { data, error } = await supabase.rpc('daily_close_summary');
  if (error) throw error;
  return data as unknown as DailyCloseSummary;
}

/**
 * Closes today (salon timezone) and returns the same snapshot it logs —
 * one round trip, no drift between what's shown and what's recorded.
 * Re-closable: calling this again just logs another `day.closed` audit
 * row, it never blocks.
 */
export async function closeDay(): Promise<DailyCloseSummary> {
  const { data, error } = await supabase.rpc('close_day');
  if (error) throw error;
  return data as unknown as DailyCloseSummary;
}

/**
 * The most recent `day.closed` audit row, if any — used to show "already
 * closed at HH:MM" rather than hiding the button. Reads `audit_events`
 * directly; there's no dedicated RPC for this since the owner already has
 * SELECT access to that table.
 */
export async function getLastClose(): Promise<{
  createdAt: string;
  summary: DailyCloseSummary;
} | null> {
  const { data, error } = await supabase
    .from('audit_events')
    .select('created_at, new_value')
    .eq('action', 'day.closed')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  const row = data?.[0];
  if (!row || !row.new_value) return null;
  return {
    createdAt: row.created_at,
    summary: row.new_value as unknown as DailyCloseSummary,
  };
}
