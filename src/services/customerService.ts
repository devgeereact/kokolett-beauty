import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

/**
 * Customers are not `auth.users` — they are identified by email and never hold
 * a password. Only the owner reads this table; RLS gives anon nothing.
 */

export interface CustomerWithStats extends Customer {
  completed_count: number;
  upcoming_count: number;
  last_visit_at: string | null;
}

export async function listCustomers(search = ''): Promise<Customer[]> {
  let request = supabase
    .from('customers')
    .select('*')
    .is('deleted_at', null)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    request = request.or(
      `full_name.ilike.${term},email.ilike.${term},mobile.ilike.${term}`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** The owner's private note on a customer. Never shown to the customer. */
export async function setCustomerNote(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ notes: notes.trim() || null })
    .eq('id', id);

  if (error) throw error;
}

/**
 * UK GDPR erasure. Soft delete, because `appointments.customer_id` is
 * `on delete restrict` — a hard delete would either fail or take the salon's
 * financial history with it. The unique index on email is partial
 * (`where deleted_at is null`), so the same person can book again afterwards
 * and arrives as a new customer, which is the correct outcome after erasure.
 */
export async function softDeleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({
      deleted_at: new Date().toISOString(),
      marketing_consent: false,
      notes: null,
    })
    .eq('id', id);

  if (error) throw error;
}
