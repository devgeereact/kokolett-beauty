import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOffline, offlineError, toAppError } from '@/lib/errors';

/**
 * A dropped connection used to be indistinguishable from a server fault: both
 * rendered "Something went wrong. Please try again." on the booking form, which
 * is the one message that cannot tell a customer on a train what to do.
 */
function setOnline(value: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

afterEach((): void => {
  vi.restoreAllMocks();
});

describe('toAppError', (): void => {
  it('maps a coded database exception to its copy', (): void => {
    const e = { message: 'SLOT_TAKEN: someone else got there', code: 'P0001' };
    expect(toAppError(e).code).toBe('SLOT_TAKEN');
  });

  it('never leaks raw Postgres text for an unrecognised failure', (): void => {
    setOnline(true);
    const result = toAppError(new Error('duplicate key value violates something'));
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('Something went wrong. Please try again.');
  });

  it.each([
    'TypeError: Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
    'fetch failed',
  ])('recognises %s as an offline failure', (message): void => {
    setOnline(true); // the flag can lag reality, so the text has to carry it
    expect(toAppError(new Error(message)).code).toBe('OFFLINE');
  });

  it('recognises a supabase-js network error, which arrives as a PostgrestError', (): void => {
    setOnline(true);
    const e = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' };
    const result = toAppError(e);
    expect(result.code).toBe('OFFLINE');
    expect(result.message).toContain('offline');
  });

  it('treats any failure as offline while the browser reports no connection', (): void => {
    setOnline(false);
    expect(toAppError(new Error('anything at all')).code).toBe('OFFLINE');
  });

  it('keeps the original error for Sentry without rendering it', (): void => {
    setOnline(true);
    const cause = new Error('Failed to fetch');
    expect(toAppError(cause).cause).toBe(cause);
  });

  it('does not misread a coded exception as a network failure', (): void => {
    setOnline(true);
    expect(toAppError(new Error('DAILY_CAPACITY_REACHED')).code).toBe(
      'DAILY_CAPACITY_REACHED',
    );
  });
});

describe('isOffline / offlineError', (): void => {
  it('reports the browser connectivity flag', (): void => {
    setOnline(false);
    expect(isOffline()).toBe(true);
    setOnline(true);
    expect(isOffline()).toBe(false);
  });

  it('offlineError carries no cause, because nothing was thrown', (): void => {
    expect(offlineError()).toEqual({
      code: 'OFFLINE',
      message: 'You appear to be offline. Please check your connection and try again.',
    });
  });
});

/**
 * The public funnel's codes, added 2026-09-05. Every one of these is raised by
 * an RPC an anonymous customer can reach, and every one of them used to fall
 * through to "Something went wrong. Please try again." The rate limits are the
 * ones that mattered: retrying is the action being refused.
 */
describe('toAppError: the public funnel', (): void => {
  const PUBLIC_CODES = [
    'EMAIL_INVALID',
    'INVALID_EMAIL',
    'INVALID_NAME',
    'NAME_REQUIRED',
    'NAME_TOO_LONG',
    'NOTE_TOO_LONG',
    'TOO_MANY_BOOKINGS',
    'TOO_MANY_REQUESTS',
    'TOO_MANY_SIGNUPS',
    'INVALID_SESSION',
    'INVALID_TOKEN',
    'NOT_CANCELLABLE',
    'EARLIER_REQUEST_WAITING',
    'REQUEST_CLOSED',
  ] as const;

  it.each(PUBLIC_CODES)('maps %s to its own copy, not the generic message', (code) => {
    const result = toAppError(new Error(`${code}`));
    expect(result.code).toBe(code);
    expect(result.message).not.toBe('Something went wrong. Please try again.');
    expect(result.message.length).toBeGreaterThan(10);
  });

  it('never tells a rate-limited caller to try again', (): void => {
    for (const code of ['TOO_MANY_BOOKINGS', 'TOO_MANY_REQUESTS', 'TOO_MANY_MESSAGES']) {
      expect(toAppError(new Error(code)).message.toLowerCase()).not.toContain(
        'try again',
      );
    }
  });

  it('does not confuse EMAIL_INVALID with INVALID_EMAIL', (): void => {
    expect(toAppError(new Error('EMAIL_INVALID')).code).toBe('EMAIL_INVALID');
    expect(toAppError(new Error('INVALID_EMAIL')).code).toBe('INVALID_EMAIL');
  });
});
