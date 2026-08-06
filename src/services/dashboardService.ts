import { supabase } from '@/lib/supabase';
import type { AvailabilityRequest, OwnerSummary } from '@/types';

/**
 * The dashboard's opening query. One RPC rather than eight counts, because the
 * first screen the owner sees on a busy morning should not be a waterfall.
 *
 * `owner_dashboard_summary()` is security definer with an explicit `is_owner()`
 * guard inside it, so a signed-in non-staff user gets a permission error rather
 * than a count of someone else's business.
 */
export async function getOwnerSummary(): Promise<OwnerSummary> {
  const { data, error } = await supabase.rpc('owner_dashboard_summary');
  if (error) throw error;
  return data as unknown as OwnerSummary;
}

export async function listAvailabilityRequests(): Promise<AvailabilityRequest[]> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

export async function respondToRequest(
  id: string,
  message: string,
  status: 'awaiting_response' | 'offer_sent' | 'declined',
): Promise<void> {
  const { error } = await supabase
    .from('availability_requests')
    .update({
      owner_response: message.trim() || null,
      responded_at: new Date().toISOString(),
      status,
    })
    .eq('id', id);

  if (error) throw error;
}
