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
  SLOT_TAKEN: 'Sorry, that slot was taken while you were booking. Please pick another.',
  NOT_AUTHORISED: 'You do not have permission to do that.',
  NOT_PENDING: 'That booking is no longer awaiting approval. It may already be decided.',
  NOT_FOUND: 'That booking could not be found.',
  ILLEGAL_TRANSITION: 'That status change is not allowed from where this booking is now.',
  NAME_INCOMPLETE: 'Please give your full name, first name and surname.',
  MOBILE_REQUIRED: 'Please give a mobile number the salon can reach you on.',
  NOT_RESCHEDULABLE: 'That booking can no longer be moved.',
  ALREADY_PASSED: 'That appointment has already passed.',
  SAME_TIME: 'That is the time you are already booked in for.',
  INVALID_AMOUNT: 'Enter an amount greater than £0.',
  HAS_PAYMENT:
    'This has a logged payment, so it cannot be deleted. That would erase a financial record.',
  // The contact form's rate limit (migration 0049). "Try again" is the one
  // thing this caller must not be told, because trying again is what is
  // blocked, so it names the channels that still work.
  TOO_MANY_MESSAGES:
    'You have sent us a few messages already. Please give us a little time to reply, or call or WhatsApp us if it is urgent.',
  SLUG_INVALID:
    'That link must be 4-40 characters, using only lowercase letters, numbers and hyphens.',
  SLUG_RESERVED:
    'That link is already used elsewhere on the site. Please choose another.',
};

const CODES = Object.keys(MESSAGES) as BookingErrorCode[];

export interface AppError {
  code: BookingErrorCode | 'UNKNOWN' | 'OFFLINE';
  message: string;
  /** Original error, for Sentry — never rendered. */
  cause?: unknown;
}

/**
 * Copy for a request that never reached the server.
 *
 * Deliberately says nothing about what did or did not happen at the salon's
 * end, because a lost response is indistinguishable from a lost request. It is
 * safe to invite a retry: a booking that did land is protected by the
 * `appointments_no_overlap` exclusion constraint, so a duplicate attempt comes
 * back as SLOT_TAKEN rather than booking the same slot twice.
 */
const OFFLINE_MESSAGE =
  'You appear to be offline. Please check your connection and try again.';

/**
 * A failure of the network itself, not of the request.
 *
 * `fetch` rejects with a `TypeError` whose text differs per engine, and
 * supabase-js hands that text on inside a PostgrestError with an empty `code`,
 * so there is nothing structured to match on. The browser's own connectivity
 * flag is checked first because it is the one signal that is not a string.
 */
function isNetworkFailure(error: unknown, raw: string): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return (
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(
      raw,
    ) ||
    (error instanceof DOMException && error.name === 'AbortError')
  );
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === 'object' && e !== null && 'message' in e && 'code' in e;
}

/** True while the browser reports no connectivity. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** The offline error, for a caller that wants to refuse before it tries. */
export function offlineError(): AppError {
  return { code: 'OFFLINE', message: OFFLINE_MESSAGE };
}

/** Map any thrown value to a coded, displayable error. */
export function toAppError(error: unknown): AppError {
  const raw = isPostgrestError(error)
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error);

  // Before the coded matches: a dropped connection used to fall all the way
  // through to "Something went wrong. Please try again.", which tells a
  // customer on a train nothing about why, or that waiting would fix it.
  if (isNetworkFailure(error, raw)) {
    return { code: 'OFFLINE', message: OFFLINE_MESSAGE, cause: error };
  }

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
