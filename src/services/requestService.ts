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
  /** Position within the *open* queue only — `null` for an already-answered row. */
  queue_position: number | null;
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
  /** Private, never emailed to the customer — migration 0030. */
  owner_note: string | null;
  /** Set when the owner answers (offers a slot or declines) — the reference's "Offered"/"Requested" timestamp for a resolved row. */
  responded_at: string | null;
  /** The resulting booking's start time — the reference's "Booked" timestamp. `null` until `converted`. */
  converted_starts_at: string | null;
  created_at: string;
  updated_at: string;
  waiting_hours: number;
}

const REQUEST_COLUMNS =
  'id, full_name, email, mobile, service_id, preferred_dates, preferred_times, ' +
  'flexibility, notes, status, owner_response, owner_note, responded_at, created_at, updated_at, ' +
  'services(name), appointments(starts_at)';

type RequestRow = {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
  service_id: string | null;
  preferred_dates: string[] | null;
  preferred_times: string | null;
  flexibility: string;
  notes: string | null;
  status: AvailabilityRequestStatus;
  owner_response: string | null;
  owner_note: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  services: { name: string } | { name: string }[] | null;
  appointments: { starts_at: string } | { starts_at: string }[] | null;
};

function toQueuedRequest(row: RequestRow, queuePosition: number | null): QueuedRequest {
  const service = Array.isArray(row.services) ? row.services[0] : row.services;
  const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
  return {
    id: row.id,
    queue_position: queuePosition,
    full_name: row.full_name,
    email: row.email,
    mobile: row.mobile,
    service_id: row.service_id,
    service_name: service?.name ?? null,
    preferred_dates: row.preferred_dates ?? [],
    preferred_times: row.preferred_times,
    flexibility: row.flexibility,
    notes: row.notes,
    status: row.status,
    owner_response: row.owner_response,
    owner_note: row.owner_note,
    responded_at: row.responded_at,
    converted_starts_at: appointment?.starts_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    waiting_hours: Math.round(((Date.now() - new Date(row.created_at).getTime()) / 3_600_000) * 10) / 10,
  };
}

const OPEN_STATUSES: AvailabilityRequestStatus[] = ['new', 'awaiting_response', 'offer_sent'];

/** Open requests only, oldest first — whoever asked first is served first. */
export async function listQueuedRequests(): Promise<QueuedRequest[]> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select(REQUEST_COLUMNS)
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row, i) => toQueuedRequest(row as unknown as RequestRow, i + 1));
}

/**
 * Every request, open and answered — the "All" tab's dataset. Open rows
 * carry their real queue position (computed the same way as
 * `listQueuedRequests`, just not re-fetched separately); answered rows
 * carry `queue_position: null` since a resolved request no longer holds a
 * place in line.
 */
export async function listAllRequests(): Promise<QueuedRequest[]> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select(REQUEST_COLUMNS)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;

  let nextPosition = 1;
  return (data ?? []).map((row) => {
    const typed = row as unknown as RequestRow;
    const isOpen = OPEN_STATUSES.includes(typed.status);
    return toQueuedRequest(typed, isOpen ? nextPosition++ : null);
  });
}

/** Private note, visible only to the owner — never emailed (migration 0030). */
export async function setRequestOwnerNote(requestId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('set_request_owner_note', {
    p_request_id: requestId,
    p_note: note,
  });
  if (error) throw error;
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
