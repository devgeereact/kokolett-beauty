import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { CalendarFeed } from '@/types';

/**
 * Calendar subscriptions.
 *
 * The token is returned once, by `create_calendar_feed`, and never again.
 * Nothing here caches it: the page that mints one shows it, and if the owner
 * navigates away she makes a new one. That is deliberate, because the
 * alternative is a readable copy of a credential that grants access to every
 * customer's name and number.
 */

export async function listCalendarFeeds(): Promise<CalendarFeed[]> {
  const { data, error } = await supabase
    .from('calendar_feeds')
    .select('*')
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export interface NewFeed {
  id: string;
  /** Shown once. Not stored anywhere, here or in the database. */
  url: string;
}

export async function createCalendarFeed(label: string): Promise<NewFeed> {
  const { data, error } = await supabase.rpc('create_calendar_feed', {
    p_label: label.trim() || undefined,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) throw new Error('NOT_FOUND');

  return { id: row.id, url: feedUrl(row.token) };
}

export async function revokeCalendarFeed(id: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_calendar_feed', { p_id: id });
  if (error) throw error;
}

/** The https:// form. Calendar apps also accept it pasted as webcal://. */
export function feedUrl(token: string): string {
  return `${env.supabaseUrl}/functions/v1/calendar-feed?token=${token}`;
}

/**
 * Tapping a webcal:// link opens the calendar app directly rather than
 * downloading a file, which is the difference between subscribing and getting
 * a one-off copy that never updates.
 */
export function webcalUrl(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:\/\//, 'webcal://');
}
