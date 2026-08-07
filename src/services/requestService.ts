import { supabase } from '@/lib/supabase';
import type { AvailabilityRequestStatus } from '@/types';

/**
 * Availability requests — the approval path under the current policy.
 *
 * Published hours book instantly. A request only exists because nothing was
 * open, so answering one is how a cancellation reaches somebody. Order is the
 * whole point: the queue is served oldest first, and the database refuses to
 * let a later request jump an earlier one for the same date unless the owner
 * says why.
 */

export interface QueuedRequest {
  id: string;
  queue_position: number;
  full_name: string;
  email: string;
  mobile: string | null;
  service_id: string | null;
  service_name: string | null;
  preferred_dates: string[];
  preferred_times: string | null;
  flexibility: string;
  notes: string | null;
  status: AvailabilityRequestStatus;
  owner_response: string | null;
  created_at: string;
  waiting_hours: number;
}

export async function listQueuedRequests(): Promise<QueuedRequest[]> {
  const { data, error } = await supabase.rpc('open_requests_in_order');
  if (error) throw error;
  return data ?? [];
}

/** Everything, including answered ones, for the history view. */
export async function listAllRequests(): Promise<
  {
    id: string;
    full_name: string;
    email: string;
    status: AvailabilityRequestStatus;
    created_at: string;
    owner_response: string | null;
  }[]
> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select('id, full_name, email, status, created_at, owner_response')
    .not('status', 'in', '("new","awaiting_response")')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export interface OfferResult {
  appointment_id: string;
  reference: string;
}

/**
 * Book a requester into a slot.
 *
 * Throws `EARLIER_REQUEST_WAITING` when someone ahead in the queue could also
 * have taken this date. `overrideReason` skips that check deliberately and is
 * recorded against the request, so the decision is auditable rather than
 * invisible.
 */
export async function offerSlotToRequest(
  requestId: string,
  startsAt: string,
  overrideReason?: string,
): Promise<OfferResult> {
  const { data, error } = await supabase.rpc('offer_slot_to_request', {
    p_request_id: requestId,
    p_starts_at: startsAt,
    p_override_reason: overrideReason,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

export async function declineRequest(requestId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('decline_request', {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw error;
}

/** Who is ahead of this request, parsed out of the refusal detail. */
export function whoIsAhead(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const detail = (error as { details?: string }).details;
  return typeof detail === 'string' && detail.length > 0 ? detail : null;
}
