import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_VERSION,
  analyticsAllowed,
  getConsent,
  resetConsent,
  resetConsentStore,
  setConsent,
  subscribe,
} from '@/lib/consent';

const KEY = 'kokolett-consent';

describe('consent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetConsentStore();
  });

  it('starts undecided, and undecided means no', () => {
    expect(getConsent()).toBeNull();
    expect(analyticsAllowed()).toBe(false);
  });

  it('records an acceptance and a refusal, and both survive a reload', () => {
    setConsent(true);
    expect(analyticsAllowed()).toBe(true);
    resetConsentStore();
    expect(analyticsAllowed()).toBe(true);

    setConsent(false);
    expect(analyticsAllowed()).toBe(false);
    resetConsentStore();
    // A recorded "no" is still a decision, so the banner must not return.
    expect(getConsent()).not.toBeNull();
    expect(analyticsAllowed()).toBe(false);
  });

  it('treats a record from an older version as undecided', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: CONSENT_VERSION - 1,
        analytics: true,
        decidedAt: '2026-01-01T00:00:00.000Z',
      }),
    );
    expect(getConsent()).toBeNull();
    expect(analyticsAllowed()).toBe(false);
  });

  it('treats a malformed record as undecided rather than as consent', () => {
    window.localStorage.setItem(KEY, 'not json at all');
    expect(analyticsAllowed()).toBe(false);

    resetConsentStore();
    window.localStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION }));
    expect(analyticsAllowed()).toBe(false);
  });

  it('fails safe when storage throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(getConsent()).toBeNull();
    expect(analyticsAllowed()).toBe(false);
  });

  it('still honours a choice this visit when storage refuses the write', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    setConsent(true);
    expect(analyticsAllowed()).toBe(true);
  });

  it('removes the analytics id when consent is refused or withdrawn', () => {
    window.sessionStorage.setItem('kokolett-analytics-session', 'abc');
    setConsent(false);
    expect(window.sessionStorage.getItem('kokolett-analytics-session')).toBeNull();

    setConsent(true);
    window.sessionStorage.setItem('kokolett-analytics-session', 'def');
    resetConsent();
    expect(window.sessionStorage.getItem('kokolett-analytics-session')).toBeNull();
    expect(getConsent()).toBeNull();
  });

  it('notifies subscribers on every change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setConsent(true);
    setConsent(false);
    resetConsent();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    setConsent(true);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
