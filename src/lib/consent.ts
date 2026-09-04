/**
 * Cookie and storage consent.
 *
 * PECR regulation 6 governs storing information on a visitor's device, not just
 * cookies: `sessionStorage` counts, and the analytics session id in
 * `src/lib/analytics.ts` is the only thing this site stores that is not
 * strictly necessary. So there is exactly one optional category here, and the
 * whole store exists to answer one question before that key is written.
 *
 * Deliberately not a React module. `analytics.ts` is plain TypeScript called
 * from event handlers, and it has to be able to read the answer without a hook.
 * `ConsentContext` wraps this with `useSyncExternalStore`, the same shape as
 * `useBusinessSettings`.
 *
 * The consent record itself is strictly necessary: it exists only to honour the
 * choice, and without it the banner would ask again on every page.
 */

const STORAGE_KEY = 'kokolett-consent';

/**
 * Bumped when the categories change meaning. A stored record from an older
 * version reads as undecided, so the visitor is asked again rather than being
 * held to a choice they made about something else.
 */
export const CONSENT_VERSION = 1;

export interface ConsentRecord {
  version: number;
  /** First-party booking funnel counts. The only optional category. */
  analytics: boolean;
  decidedAt: string;
}

/** `null` means undecided, which always means nothing optional may run. */
export type ConsentState = ConsentRecord | null;

let state: ConsentState = null;
let loaded = false;
const listeners = new Set<() => void>();

function read(): ConsentState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Partial<ConsentRecord>;
    if (record.version !== CONSENT_VERSION) return null;
    if (typeof record.analytics !== 'boolean') return null;
    return {
      version: CONSENT_VERSION,
      analytics: record.analytics,
      decidedAt: typeof record.decidedAt === 'string' ? record.decidedAt : '',
    };
  } catch {
    /* Private browsing, storage disabled, or corrupt JSON. Undecided is the
       safe read: it grants nothing and the banner simply asks again. */
    return null;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * The current choice, or `null` if none has been made.
 *
 * Reads through to storage once and then serves the cached value, so the
 * hot path in `trackEvent` is not a `localStorage` read per event.
 */
export function getConsent(): ConsentState {
  if (!loaded) {
    state = read();
    loaded = true;
  }
  return state;
}

/** True only when the visitor actively said yes. Undecided is a no. */
export function analyticsAllowed(): boolean {
  return getConsent()?.analytics === true;
}

/** Records a decision. Both accepting and rejecting are decisions. */
export function setConsent(analytics: boolean): void {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  state = record;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* Storage refused. The choice still holds for this visit, which is the
       part that matters: nothing optional runs against the visitor's wishes.
       They will be asked again next time, which is the honest failure. */
  }
  if (!analytics) clearOptionalStorage();
  emit();
}

/**
 * Sends the visitor back to undecided so the banner returns. Used by the
 * "change your choice" control on the cookies page.
 */
export function resetConsent(): void {
  state = null;
  loaded = true;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to do. The in-memory reset already stops optional storage. */
  }
  clearOptionalStorage();
  emit();
}

/**
 * Removes what the optional category put on the device. Withdrawing consent
 * has to actually take the key away, otherwise the identifier outlives the
 * permission it was written under.
 */
export function clearOptionalStorage(): void {
  try {
    window.sessionStorage.removeItem('kokolett-analytics-session');
  } catch {
    /* Storage unavailable, so there is nothing there to remove. */
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only. The store is module state, so it outlives a single test and the
 * second test in a file would otherwise see the first one's decision.
 */
export function resetConsentStore(): void {
  state = null;
  loaded = false;
  listeners.clear();
}
