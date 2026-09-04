import { beforeEach, describe, expect, it, vi } from 'vitest';

/* `createClient` runs at module scope in `@/lib/supabase` and needs a URL and
   a key, which CI deliberately does not have. Mocking the module keeps this
   file about the consent gate rather than about the environment.
   `vi.hoisted` because the factory is lifted above the imports, so a plain
   `const rpc` above it is still in its temporal dead zone when it runs. */
const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(() => Promise.resolve({ error: null })),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('@/lib/sentry', () => ({ reportError: vi.fn() }));

import { trackEvent } from '@/lib/analytics';
import { resetConsentStore, setConsent } from '@/lib/consent';

const SESSION_KEY = 'kokolett-analytics-session';

describe('trackEvent', () => {
  beforeEach(() => {
    rpc.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetConsentStore();
  });

  it('does nothing at all while the visitor has not chosen', () => {
    trackEvent('book_page_viewed');
    expect(rpc).not.toHaveBeenCalled();
    // The point of the gate: no identifier is written before a choice.
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('does nothing once the visitor has said no', () => {
    setConsent(false);
    trackEvent('slot_selected');
    expect(rpc).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('sends the event and creates one session id once consent is given', () => {
    setConsent(true);
    trackEvent('booking_submitted');
    trackEvent('booking_confirmed');

    expect(rpc).toHaveBeenCalledTimes(2);
    const id = window.sessionStorage.getItem(SESSION_KEY);
    expect(id).toBeTruthy();

    const [name, args] = rpc.mock.calls[0] as unknown as [
      string,
      { p_event_name: string; p_session_id: string; p_metadata: unknown },
    ];
    expect(name).toBe('track_product_event');
    expect(args.p_event_name).toBe('booking_submitted');
    // Same id across the visit, which is the whole reason it is stored.
    expect(args.p_session_id).toBe(id);
  });

  it('stops sending, and drops the id, when consent is withdrawn', () => {
    setConsent(true);
    trackEvent('book_page_viewed');
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeTruthy();

    setConsent(false);
    rpc.mockClear();
    trackEvent('book_page_viewed');
    expect(rpc).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
