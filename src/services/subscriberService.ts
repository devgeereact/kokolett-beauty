import { supabase } from '@/lib/supabase';
import type { Subscriber } from '@/types';

/**
 * The mailing list.
 *
 * `subscribe_to_updates` is security definer and returns nothing at all, on
 * purpose: an anonymous caller must not be able to learn whether an address is
 * already on the list. Reading the list requires the owner's session.
 */
export async function subscribeToUpdates(
  email: string,
  fullName?: string,
  source = 'website',
): Promise<void> {
  const { error } = await supabase.rpc('subscribe_to_updates', {
    p_email: email.trim(),
    p_full_name: fullName?.trim() || undefined,
    p_source: source,
  });

  if (error) throw error;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .is('unsubscribed_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
