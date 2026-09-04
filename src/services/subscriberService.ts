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

/**
 * The people who have opted out.
 *
 * Needed since `0071`: the public `subscribe_to_updates()` no longer clears
 * `unsubscribed_at`, because clearing it let anyone who knew an address undo
 * that person's unsubscribe. The owner's own list is now the only way back on,
 * so she has to be able to see who is off it. Owner-only via the
 * `subscribers_owner_all` RLS policy (0018), like every other read here.
 */
export async function listUnsubscribed(): Promise<Subscriber[]> {
  const { data, error } = await supabase
    .from('subscribers')
    .select('*')
    .not('unsubscribed_at', 'is', null)
    .order('unsubscribed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Put somebody back on the list, deliberately, as the owner.
 *
 * The counterpart to `unsubscribeSubscriber`. This is the re-consent
 * decision `0071` moved out of the public endpoint: a person looking at a
 * name and choosing, rather than an anonymous RPC call clearing a flag.
 */
export async function resubscribeSubscriber(id: string): Promise<void> {
  const { error } = await supabase
    .from('subscribers')
    .update({ unsubscribed_at: null })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Soft-unsubscribe — sets `unsubscribed_at` rather than deleting the row, so
 * `listSubscribers()`'s existing filter is all that's needed for them to stop
 * appearing. Owner-only via the `subscribers_owner_all` RLS policy (0018).
 */
export async function unsubscribeSubscriber(id: string): Promise<void> {
  const { error } = await supabase
    .from('subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
