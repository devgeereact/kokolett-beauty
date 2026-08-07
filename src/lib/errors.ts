import type { PostgrestError } from '@supabase/supabase-js';
import type { BookingErrorCode } from '@/types';

/**
 * Turns database failures into something a person can act on.
 *
 * The booking and owner RPCs raise named exceptions (`SLOT_TAKEN`,
 * `ILLEGAL_TRANSITION`, …) rather than returning error codes, so the name
 * arrives inside the Postgres error message. Anything unrecognised gets a
 * generic message — a raw Postgres string in the UI is both unhelpful and a
 * small information leak.
 */

const MESSAGES: Record<BookingErrorCode, string> = {
  SERVICE_UNAVAILABLE: 'That service is no longer available. Please choose another.',
  SLOT_MISALIGNED:
    'That start time is not a valid slot. Please pick a time from the list.',
  LEAD_TIME_VIOLATION:
    'That slot is too soon to book online. Please choose a later time.',
  BEYOND_BOOKING_HORIZON: 'That date is further ahead than bookings are open.',
  OUTSIDE_AVAILABILITY: 'The salon is not open at that time.',
  DAILY_CAPACITY_REACHED: 'That day is fully booked. Please try another date.',
  SLOT_TAKEN: 'Sorry — that slot was taken while you were booking. Please pick another.',
  NOT_AUTHORISED: 'You do not have permission to do that.',
  NOT_PENDING: 'That booking is no longer awaiting approval — it may already be decided.',
  NOT_FOUND: 'That booking could not be found.',
  ILLEGAL_TRANSITION: 'That status change is not allowed from where this booking is now.',
  NAME_INCOMPLETE: 'Please give your full name — first name and surname.',
  MOBILE_REQUIRED: 'Please give a mobile number the salon can reach you on.',
};

const CODES = Object.keys(MESSAGES) as BookingErrorCode[];

export interface AppError {
  code: BookingErrorCode | 'UNKNOWN';
  message: string;
  /** Original error, for Sentry — never rendered. */
  cause?: unknown;
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === 'object' && e !== null && 'message' in e && 'code' in e;
}

/** Map any thrown value to a coded, displayable error. */
export function toAppError(error: unknown): AppError {
  const raw = isPostgrestError(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error);

  const matched = CODES.find((code) => raw.includes(code));
  if (matched) return { code: matched, message: MESSAGES[matched], cause: error };

  // Postgres 23505 is a unique violation — the only one reachable from owner
  // forms, where it always means a duplicate slug.
  if (isPostgrestError(error) && error.code === '23505') {
    return {
      code: 'UNKNOWN',
      message: 'Something with that name or web address already exists.',
      cause: error,
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Something went wrong. Please try again.',
    cause: error,
  };
}

/** Convenience for `catch` blocks that only need the copy. */
export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}
