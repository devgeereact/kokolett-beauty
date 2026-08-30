import { supabase } from '@/lib/supabase';
import type { BroadcastResult } from '@/types';

/**
 * Sends a broadcast to every confirmed, not-unsubscribed mailing-list
 * subscriber — queues into the existing email_messages outbox, one row
 * per recipient (migration 0058). No preview/dry-run: the recipient count
 * shown before sending comes from `listSubscribers()` in
 * `subscriberService.ts`, filtered the same way the RPC filters server-side.
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
