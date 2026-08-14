import type { AvailabilityRequestStatus } from '@/types';
import type { Tone } from '@/lib/tone';

/**
 * Human labels for a request's status, grouped the way `docs/design/
 * availability-request.png`'s tabs do. `awaiting_response`/`offer_sent` and
 * `declined`/`expired` are collapsed to one label each — the reference has
 * no separate lane for either pair, and nothing in the current booking
 * policy ever produces `awaiting_response`/`offer_sent` yet (answering a
 * request goes straight `new` → `converted`/`declined`), so they exist for
 * forward compatibility rather than live traffic today.
 */
export const REQUEST_STATUS_LABELS: Record<AvailabilityRequestStatus, string> = {
  new: 'New',
  awaiting_response: 'Awaiting response',
  offer_sent: 'Awaiting response',
  converted: 'Converted',
  declined: 'Declined',
  expired: 'Declined',
};

export const REQUEST_STATUS_TONE: Record<AvailabilityRequestStatus, Tone> = {
  new: 'primary',
  awaiting_response: 'in_service',
  offer_sent: 'in_service',
  converted: 'completed',
  declined: 'cancelled',
  expired: 'cancelled',
};

/** The four filter lanes the screen groups requests into. */
export type RequestLane = 'new' | 'awaiting_response' | 'converted' | 'declined';

export const REQUEST_LANE_LABELS: Record<RequestLane, string> = {
  new: 'New',
  awaiting_response: 'Awaiting response',
  converted: 'Converted',
  declined: 'Declined',
};

export function laneForStatus(status: AvailabilityRequestStatus): RequestLane {
  if (status === 'new') return 'new';
  if (status === 'awaiting_response' || status === 'offer_sent') return 'awaiting_response';
  if (status === 'converted') return 'converted';
  return 'declined';
}

export type RequestPriority = 'high' | 'medium' | 'low';

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

export const PRIORITY_TONE: Record<RequestPriority, Tone> = {
  high: 'urgent',
  medium: 'pending',
  low: 'completed',
};

/**
 * No priority field exists on `availability_requests` — this derives one
 * from how long the request has actually waited, the same real signal the
 * card already shows as "waiting Xh". Long-waiting requests read as urgent
 * because they are, not because anyone tagged them that way.
 */
export function priorityFromWaitingHours(waitingHours: number): RequestPriority {
  if (waitingHours >= 24) return 'high';
  if (waitingHours >= 8) return 'medium';
  return 'low';
}
