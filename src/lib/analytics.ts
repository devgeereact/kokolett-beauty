import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/sentry';
import type { Json } from '@/types/database.types';

/**
 * KOKO_GAP.md P3: "no PostHog/Plausible/Mixpanel/gtag anywhere... no
 * booking funnel, no conversion tracking." Deliberately not a third-party
 * vendor — that would mean provisioning a new external service and API key
 * for a single-owner product where "an owner glancing at Reports covers
 * most of what a funnel would show" (the gap's own reasoning), which is
 * exactly the kind of new-account decision that isn't mine to make
 * unilaterally overnight. This is first-party instead: a `product_events`
 * table (migration 0064) that holds no personal data at all — an event
 * name, a random per-tab session id, and optional non-identifying
 * metadata — read back on Reports as simple funnel counts.
 *
 * The session id is `sessionStorage`-backed: random, resets every new tab,
 * never sent anywhere else, and is not a cookie — nothing here can be used
 * to identify a person or link their events across visits.
 */

export type ProductEventName =
  'book_page_viewed' | 'slot_selected' | 'booking_submitted' | 'booking_confirmed';

const SESSION_KEY = 'kokolett-analytics-session';

function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing or storage disabled: a per-call random id still lets
    // the event count, it just won't dedupe against the rest of this visit.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Fire-and-forget. A tracking failure must never interrupt the booking flow
 * it's trying to measure — errors are swallowed and reported to Sentry at
 * low priority, never surfaced to the customer.
 */
export function trackEvent(
  name: ProductEventName,
  metadata?: Record<string, Json>,
): void {
  void supabase
    .rpc('track_product_event', {
      p_event_name: name,
      p_session_id: getSessionId(),
      p_metadata: metadata ?? null,
    })
    .then(
      ({ error }) => {
        if (error) reportError(error, { where: 'trackEvent', event: name });
      },
      (e: unknown) => reportError(e, { where: 'trackEvent', event: name }),
    );
}
