import { useCallback, useSyncExternalStore } from 'react';
import {
  analyticsAllowed,
  getConsent,
  resetConsent,
  setConsent,
  subscribe,
  type ConsentState,
} from '@/lib/consent';

export interface UseConsent {
  /** `null` until the visitor has actually chosen. Undecided grants nothing. */
  consent: ConsentState;
  decided: boolean;
  analytics: boolean;
  /** Accept the optional category. */
  accept: () => void;
  /** Refuse it. A recorded refusal, not silence, so the banner stays away. */
  reject: () => void;
  /** Back to undecided, which brings the banner back. */
  reopen: () => void;
}

/**
 * React view over the module-level consent store in `src/lib/consent.ts`.
 *
 * The store is deliberately outside React because `trackEvent` has to read it
 * from a plain event handler. This hook is the same `useSyncExternalStore`
 * shape as `useBusinessSettings`, so every consumer re-renders on a change no
 * matter which component made it.
 */
export function useConsent(): UseConsent {
  const consent = useSyncExternalStore(subscribe, getConsent, getConsent);

  const accept = useCallback((): void => setConsent(true), []);
  const reject = useCallback((): void => setConsent(false), []);
  const reopen = useCallback((): void => resetConsent(), []);

  return {
    consent,
    decided: consent !== null,
    analytics: analyticsAllowed(),
    accept,
    reject,
    reopen,
  };
}
