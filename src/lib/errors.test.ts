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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toAppError', () => {
  it('maps a coded database exception to its copy', () => {
    const e = { message: 'SLOT_TAKEN: someone else got there', code: 'P0001' };
    expect(toAppError(e).code).toBe('SLOT_TAKEN');
  });

  it('never leaks raw Postgres text for an unrecognised failure', () => {
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
  ])('recognises %s as an offline failure', (message) => {
    setOnline(true); // the flag can lag reality, so the text has to carry it
    expect(toAppError(new Error(message)).code).toBe('OFFLINE');
  });

  it('recognises a supabase-js network error, which arrives as a PostgrestError', () => {
    setOnline(true);
    const e = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' };
    const result = toAppError(e);
    expect(result.code).toBe('OFFLINE');
    expect(result.message).toContain('offline');
  });

  it('treats any failure as offline while the browser reports no connection', () => {
    setOnline(false);
    expect(toAppError(new Error('anything at all')).code).toBe('OFFLINE');
  });

  it('keeps the original error for Sentry without rendering it', () => {
    setOnline(true);
    const cause = new Error('Failed to fetch');
    expect(toAppError(cause).cause).toBe(cause);
  });

  it('does not misread a coded exception as a network failure', () => {
    setOnline(true);
    expect(toAppError(new Error('DAILY_CAPACITY_REACHED')).code).toBe(
      'DAILY_CAPACITY_REACHED',
    );
  });
});

describe('isOffline / offlineError', () => {
  it('reports the browser connectivity flag', () => {
    setOnline(false);
    expect(isOffline()).toBe(true);
    setOnline(true);
    expect(isOffline()).toBe(false);
  });

  it('offlineError carries no cause, because nothing was thrown', () => {
    expect(offlineError()).toEqual({
      code: 'OFFLINE',
      message: 'You appear to be offline. Please check your connection and try again.',
    });
  });
});
