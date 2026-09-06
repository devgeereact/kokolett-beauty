import { supabase } from '@/lib/supabase';
import type { BroadcastAudience, BroadcastResult } from '@/types';

/**
 * Sends a broadcast to every confirmed, not-unsubscribed mailing-list
 * subscriber — queues into the existing email_messages outbox, one row
 * per recipient (migration 0058). No preview/dry-run.
 *
 * The count shown before sending comes from `getBroadcastAudience()` below,
 * not from filtering `listSubscribers()` in the page. Two places applying
 * "confirmed and not unsubscribed" by hand is two places to get it wrong,
 * and the screen quoting a different number from the one the send uses is
 * exactly the sort of thing nobody notices until a broadcast goes to more
 * people than the confirm dialog said.
 */
export async function sendBroadcast(
  subject: string,
  body: string,
): Promise<BroadcastResult> {
  const { data, error } = await supabase.rpc('send_broadcast_as_owner', {
    p_subject: subject,
    p_body: body,
  });
  if (error) throw error;
  return data as unknown as BroadcastResult;
}

/**
 * Who a broadcast would reach right now, counted server-side.
 *
 * Since migration 0081 the mailing list is fed by consent as well as by the
 * /subscribe form: ticking marketing consent on a customer, whether she ticks
 * it herself at booking or the owner ticks it for her on the Customers page,
 * puts her on the list. Before that the two systems never spoke, so the
 * Broadcasts screen read "nobody has confirmed their subscription yet" while
 * the Customers page was full of ticked consent boxes.
 */
export async function getBroadcastAudience(): Promise<BroadcastAudience> {
  const { data, error } = await supabase.rpc('broadcast_audience');
  if (error) throw error;
  return data as unknown as BroadcastAudience;
}
