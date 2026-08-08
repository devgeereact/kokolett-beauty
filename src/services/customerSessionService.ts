import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
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

export function readStoredSession(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing can throw on access rather than returning null.
    return null;
  }
}

export function storeSession(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, token);
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
    await fetch(`${env.supabaseUrl}/functions/v1/customer-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.supabaseAnonKey}`,
        apikey: env.supabaseAnonKey,
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  } catch {
    /* Swallowed on purpose — see above. */
  }
  return true;
}
