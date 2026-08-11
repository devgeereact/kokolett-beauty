import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { reportError } from '@/lib/sentry';
import type { AppointmentStatus } from '@/types';

/**
 * The passwordless customer identity.
 *
 * A customer is not an `auth.users` row and has no password. They arrive on a
 * single-use link, exchange it for a 30-day session token, and every later call
 * passes that token to a `security definer` function that resolves it to their
 * own `customer_id` and nothing else.
 */

const STORAGE_KEY = 'kokolett-customer-session';

export interface CustomerIdentity {
  id: string;
  full_name: string;
  email: string;
  mobile: string | null;
}

export interface CustomerAppointment {
  id: string;
  reference: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_pence: number;
  service_name: string;
  customer_note: string | null;
  cancellation_reason: string | null;
  rejection_reason: string | null;
  /** Set when this booking replaced an earlier one. */
  rescheduled_from: string | null;
}

/**
 * The stored session is `{ token, customer }`, written as JSON.
 *
 * It used to be the bare token string, and the identity was held only in React
 * state set by `exchangeToken`. That meant identity survived exactly as long as
 * the tab: on any reload of /my the customer was `null`, so a customer with a
 * perfectly good 30-day session who had no *upcoming* bookings was shown the
 * "tell us the email you booked with" card forever, and her name never
 * appeared. Keeping the identity next to the token is what makes a restored
 * session a real session rather than half of one.
 *
 * Reads still accept the old bare-string form so existing sessions survive.
 */
interface StoredSession {
  token: string;
  customer: CustomerIdentity | null;
}

export function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    if (!raw.startsWith('{')) return { token: raw, customer: null };
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token !== 'string' || parsed.token.length === 0) return null;
    return { token: parsed.token, customer: parsed.customer ?? null };
  } catch {
    // Private browsing can throw on access rather than returning null, and a
    // half-written value should log the customer out rather than crash them.
    return null;
  }
}

export function storeSession(
  token: string | null,
  customer: CustomerIdentity | null = null,
): void {
  try {
    if (token === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, customer }));
  } catch {
    /* A customer with storage disabled simply gets a session for this tab. */
  }
}

/** Exchange a single-use magic-link token for a session. */
export async function redeemToken(
  token: string,
): Promise<{ sessionToken: string; customer: CustomerIdentity }> {
  const { data, error } = await supabase.rpc('redeem_access_token', { p_token: token });
  if (error) throw error;

  const result = data as unknown as {
    session_token: string;
    customer: CustomerIdentity;
  };
  return { sessionToken: result.session_token, customer: result.customer };
}

export async function fetchCustomerAppointments(
  sessionToken: string,
): Promise<CustomerAppointment[]> {
  const { data, error } = await supabase.rpc('customer_appointments', {
    p_session_token: sessionToken,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Move an appointment to a different published time.
 *
 * The old booking is retired and a new one created, linked by
 * `rescheduled_from` — the salon keeps the history rather than seeing an
 * unexplained cancellation followed by an unrelated booking. The reference
 * changes as a result, which is why the caller shows the new one.
 */
export async function rescheduleOwnAppointment(
  sessionToken: string,
  appointmentId: string,
  newStartsAt: string,
): Promise<{ appointment_id: string; reference: string }> {
  const { data, error } = await supabase.rpc('customer_reschedule_appointment', {
    p_session_token: sessionToken,
    p_appointment_id: appointmentId,
    p_new_starts_at: newStartsAt,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

export async function cancelOwnAppointment(
  sessionToken: string,
  appointmentId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('customer_cancel_appointment', {
    p_session_token: sessionToken,
    p_appointment_id: appointmentId,
    p_reason: reason,
  });
  if (error) throw error;
}

/**
 * Ask for a fresh link. Always resolves true — the endpoint deliberately does
 * not reveal whether an address is on file, and neither does this.
 */
export async function requestAccessLink(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/customer-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.supabaseAnonKey}`,
        apikey: env.supabaseAnonKey,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    // Still resolve true, so the customer sees the same neutral message either
    // way — but do not throw the failure away. Not revealing *which* address is
    // on file is the point; discarding the transport result is not. Without
    // this, an Edge Function returning 500 looked exactly like success, so
    // customers were told a link was coming, none arrived, and nothing reached
    // Sentry for the owner to notice.
    if (!res.ok) {
      reportError(new Error(`customer-access responded ${res.status}`), {
        status: res.status,
      });
    }
  } catch (e) {
    reportError(e, { where: 'requestAccessLink' });
  }
  return true;
}
