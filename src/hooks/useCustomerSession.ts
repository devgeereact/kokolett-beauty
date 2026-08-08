import { useCallback, useEffect, useState } from 'react';
import {
  cancelOwnAppointment,
  fetchCustomerAppointments,
  rescheduleOwnAppointment,
  readStoredSession,
  redeemToken,
  requestAccessLink,
  storeSession,
  type CustomerAppointment,
  type CustomerIdentity,
} from '@/services/customerSessionService';

interface UseCustomerSession {
  customer: CustomerIdentity | null;
  appointments: CustomerAppointment[];
  loading: boolean;
  error: Error | null;
  /** Exchange a single-use token from /access/:token. */
  exchangeToken: (token: string) => Promise<boolean>;
  /** Email a fresh link. Always resolves true — never reveal who is on file. */
  requestLink: (email: string) => Promise<boolean>;
  cancel: (appointmentId: string, reason?: string) => Promise<void>;
  /** Move a booking to another published time. Resolves to the new reference. */
  reschedule: (appointmentId: string, newStartsAt: string) => Promise<string>;
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
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    readStoredSession(),
  );
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!sessionToken) {
      setAppointments([]);
      return;
    }
    setLoading(true);
    try {
      setAppointments(await fetchCustomerAppointments(sessionToken));
      setError(null);
    } catch (e) {
      // An expired or revoked session must not leave a half-signed-in screen.
      const message = e instanceof Error ? e.message : String(e);
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
      storeSession(next);
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

  const signOut = useCallback((): void => {
    storeSession(null);
    setSessionToken(null);
    setCustomer(null);
    setAppointments([]);
  }, []);

  return {
    customer,
    appointments,
    loading,
    error,
    exchangeToken,
    requestLink: requestAccessLink,
    cancel,
    reschedule,
    refresh: load,
    signOut,
  };
}
