import { beforeEach, describe, expect, it } from 'vitest';
import { readStoredSession, storeSession } from '@/services/customerSessionService';

const STORAGE_KEY = 'kokolett-customer-session';

/**
 * The stored session used to be a bare token string, with the customer's
 * identity held only in React state. That made a restored session half a
 * session: on reload the identity was gone, so a customer whose bookings were
 * all cancelled or completed was shown the sign-in card despite holding a
 * perfectly valid 30-day token.
 *
 * The format changed to JSON to fix that, which makes the backward-compatible
 * read the load-bearing part — get it wrong and every existing customer is
 * silently signed out.
 */
describe('customer session storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a token and identity', () => {
    const identity = {
      id: 'c1',
      full_name: 'Ada Lovelace',
      email: 'ada@example.invalid',
      mobile: '07700900123',
    };
    storeSession('tok-1', identity);

    const restored = readStoredSession();
    expect(restored?.token).toBe('tok-1');
    expect(restored?.customer).toEqual(identity);
  });

  it('reads the OLD bare-string format, so live sessions survive the change', () => {
    window.localStorage.setItem(STORAGE_KEY, 'legacy-token');

    const restored = readStoredSession();
    expect(restored?.token).toBe('legacy-token');
    expect(restored?.customer).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredSession()).toBeNull();
  });

  it('treats corrupt JSON as signed out rather than throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"token":');
    expect(readStoredSession()).toBeNull();
  });

  it('treats a JSON object with no usable token as signed out', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"customer":{"id":"c1"}}');
    expect(readStoredSession()).toBeNull();
  });

  it('clears the session on sign out', () => {
    storeSession('tok-1', null);
    storeSession(null);
    expect(readStoredSession()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('stores a token with no identity when one is not supplied', () => {
    storeSession('tok-2');
    const restored = readStoredSession();
    expect(restored?.token).toBe('tok-2');
    expect(restored?.customer).toBeNull();
  });
});
