import { useCallback, useEffect, useState } from 'react';
import { purgeApiCache } from '@/lib/apiCache';
import {
  cancelOwnAppointment,
  fetchCustomerAppointments,
  fetchMarketingConsent,
  rescheduleOwnAppointment,
  readStoredSession,
  redeemToken,
  requestAccessLink,
  setOwnMarketingConsent,
  storeSession,
  type CustomerAppointment,
  type CustomerIdentity,
} from '@/services/customerSessionService';

interface UseCustomerSession {
  customer: CustomerIdentity | null;
  appointments: CustomerAppointment[];
  /**
   * Whether a session token is held — the only honest test of "signed in".
   *
   * Callers used to infer it from `appointments.length > 0 || customer !== null`,
   * which quietly signed out any customer whose bookings were all cancelled or
   * completed.
   */
  hasSession: boolean;
  loading: boolean;
  error: Error | null;
  /** Exchange a single-use token from /access/:token. */
  exchangeToken: (token: string) => Promise<boolean>;
  /** Email a fresh link. Always resolves true — never reveal who is on file. */
  requestLink: (email: string) => Promise<boolean>;
  cancel: (appointmentId: string, reason?: string) => Promise<void>;
  /** Move a booking to another published time. Resolves to the new reference. */
  reschedule: (appointmentId: string, newStartsAt: string) => Promise<string>;
  /** `null` until loaded — distinct from "no", which is `false`. */
  marketingConsent: boolean | null;
  setMarketingConsent: (consent: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => void;
}

/**
 * The customer's own view of their bookings.
 *
 * Distinct from `useSupabaseAuth`: this identity has no Supabase session, no
 * JWT and no password. The session token is opaque to the client — it means
 * nothing until a `security definer` function hashes it and finds a match.
 */
export function useCustomerSession(): UseCustomerSession {
  const [stored] = useState(() => readStoredSession());
  const [sessionToken, setSessionToken] = useState<string | null>(stored?.token ?? null);
  const [customer, setCustomer] = useState<CustomerIdentity | null>(
    stored?.customer ?? null,
  );
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [marketingConsent, setMarketingConsentState] = useState<boolean | null>(null);
  // Start loading when a session is being restored. Initialising to `false`
  // meant the first committed render of /my had no session data and was not
  // loading either, so the "email me a link" card painted for a frame before
  // the effect ran — a signed-in customer saw a sign-in screen flash past.
  const [loading, setLoading] = useState(stored !== null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!sessionToken) {
      setAppointments([]);
      setMarketingConsentState(null);
      return;
    }
    setLoading(true);
    try {
      const [appts, consent] = await Promise.all([
        fetchCustomerAppointments(sessionToken),
        fetchMarketingConsent(sessionToken),
      ]);
      setAppointments(appts);
      setMarketingConsentState(consent);
      setError(null);
    } catch (e) {
      // An expired or revoked session must not leave a half-signed-in screen.
      //
      // `supabase.rpc()` never throws a real `Error` for an RPC-level failure
      // (e.g. a raised Postgres exception) unless `.throwOnError()` is
      // called, which this app doesn't — the `{ data, error }` result's
      // `error` is a plain `{ message, code, ... }` object that the service
      // layer re-throws as-is. `e instanceof Error` is therefore false here,
      // and reading `.message` off any object with one (not just real
      // `Error`s) is what actually detects INVALID_SESSION.
      const message =
        e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
          ? e.message
          : String(e);
      if (message.includes('INVALID_SESSION')) {
        storeSession(null);
        setSessionToken(null);
        setCustomer(null);
      }
      setError(e instanceof Error ? e : new Error(message));
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const exchangeToken = useCallback(async (token: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { sessionToken: next, customer: identity } = await redeemToken(token);
      storeSession(next, identity);
      setSessionToken(next);
      setCustomer(identity);
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(
    async (appointmentId: string, reason?: string): Promise<void> => {
      if (!sessionToken) return;
      await cancelOwnAppointment(sessionToken, appointmentId, reason);
      await load();
    },
    [sessionToken, load],
  );

  const reschedule = useCallback(
    async (appointmentId: string, newStartsAt: string): Promise<string> => {
      if (!sessionToken) throw new Error('INVALID_SESSION');
      const result = await rescheduleOwnAppointment(
        sessionToken,
        appointmentId,
        newStartsAt,
      );
      await load();
      return result.reference;
    },
    [sessionToken, load],
  );

  const setMarketingConsent = useCallback(
    async (consent: boolean): Promise<void> => {
      if (!sessionToken) return;
      // Optimistic: a toggle should feel instant, and a failure below reverts it.
      const previous = marketingConsent;
      setMarketingConsentState(consent);
      try {
        await setOwnMarketingConsent(sessionToken, consent);
      } catch (e) {
        setMarketingConsentState(previous);
        throw e;
      }
    },
    [sessionToken, marketingConsent],
  );

  const signOut = useCallback((): void => {
    storeSession(null);
    setSessionToken(null);
    setCustomer(null);
    setAppointments([]);
    setMarketingConsentState(null);
    // Her bookings were read through the same API the service worker caches.
    // Signing out on a borrowed phone has to leave nothing behind.
    void purgeApiCache();
  }, []);

  return {
    customer,
    appointments,
    hasSession: sessionToken !== null,
    loading,
    error,
    exchangeToken,
    requestLink: requestAccessLink,
    cancel,
    reschedule,
    marketingConsent,
    setMarketingConsent,
    refresh: load,
    signOut,
  };
}
