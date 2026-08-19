import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

/**
 * Customers are not `auth.users` — they are identified by email and never hold
 * a password. Only the owner reads this table; RLS gives anon nothing.
 */

export interface CustomerWithStats extends Customer {
  completed_count: number;
  upcoming_count: number;
  no_show_count: number;
  last_visit_at: string | null;
  /** Up to 4, most-frequent first — derived from completed appointments, never fabricated. */
  favourite_services: string[];
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

/**
 * The customer book, each row carrying real stats derived from their own
 * appointment history — total visits, last visit, no-shows, favourite
 * services — rather than a second per-customer round trip. Salon scale
 * (single owner, a few hundred customers at most) makes one appointments
 * query for everyone cheaper than N+1 queries.
 */
export async function listCustomersWithStats(search = ''): Promise<CustomerWithStats[]> {
  const [customers, { data: appointments, error }] = await Promise.all([
    listCustomers(search),
    supabase
      .from('appointments_detailed')
      .select('customer_id, service_name, status, starts_at')
      .order('starts_at', { ascending: false })
      .limit(5000),
  ]);
  if (error) throw error;

  const byCustomer = new Map<
    string,
    {
      completed: number;
      upcoming: number;
      noShow: number;
      lastVisit: string | null;
      services: Map<string, number>;
    }
  >();

  for (const a of appointments ?? []) {
    if (!a.customer_id) continue;
    let bucket = byCustomer.get(a.customer_id);
    if (!bucket) {
      bucket = {
        completed: 0,
        upcoming: 0,
        noShow: 0,
        lastVisit: null,
        services: new Map(),
      };
      byCustomer.set(a.customer_id, bucket);
    }
    if (a.status === 'completed') {
      bucket.completed += 1;
      if (a.starts_at && (!bucket.lastVisit || a.starts_at > bucket.lastVisit)) {
        bucket.lastVisit = a.starts_at;
      }
      if (a.service_name) {
        bucket.services.set(
          a.service_name,
          (bucket.services.get(a.service_name) ?? 0) + 1,
        );
      }
    } else if (a.status === 'no_show') {
      bucket.noShow += 1;
    } else if (
      a.status === 'confirmed' ||
      a.status === 'checked_in' ||
      a.status === 'pending_approval'
    ) {
      bucket.upcoming += 1;
    }
  }

  return customers.map((c) => {
    const bucket = byCustomer.get(c.id);
    const favourites = bucket
      ? [...bucket.services.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name]) => name)
      : [];
    return {
      ...c,
      completed_count: bucket?.completed ?? 0,
      upcoming_count: bucket?.upcoming ?? 0,
      no_show_count: bucket?.noShow ?? 0,
      last_visit_at: bucket?.lastVisit ?? null,
      favourite_services: favourites,
    };
  });
}

export async function setCustomerMarketingConsent(
  id: string,
  consent: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ marketing_consent: consent, consent_updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
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

export interface CustomerContactDraft {
  fullName: string;
  email: string;
  mobile: string;
}

/**
 * Correcting a typo'd contact detail, or updating one that changed. The
 * partial unique index on `lower(email)` (migration 0002) means an email
 * collision with another active customer surfaces as a Postgres error here —
 * the caller shows it as-is, same as every other write on this page.
 */
export async function updateCustomerDetails(
  id: string,
  { fullName, email, mobile }: CustomerContactDraft,
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({
      full_name: fullName.trim(),
      email: email.trim(),
      mobile: mobile.trim() || null,
    })
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

/**
 * A genuine hard delete — the customer row and every one of their
 * appointments removed outright, not anonymised in place. `soft_delete`
 * above is still the right tool for a real customer's GDPR erasure request
 * (keeps appointment history for accounting, per its own doc comment); this
 * is for the opposite case — a duplicate, test, or mistaken profile with no
 * history worth keeping. `delete_customer_as_owner` (migration 0035) refuses
 * outright if any of their appointments has a logged payment, so this can
 * never silently erase billing history.
 */
export async function hardDeleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_customer_as_owner', { p_customer_id: id });
  if (error) throw error;
}

/**
 * Whether an email already belongs to an existing customer — the "First
 * visit" / "Returning customer" signal on an availability request's detail
 * panel. `citext` makes the match case-insensitive without a `lower()` call.
 * An availability request's own `customer_id` is always null at insert time
 * (migration 0021 forbids the form from setting it), so this lookup is the
 * only real way to answer the question rather than trusting that column.
 */
export async function findCustomerByEmail(
  email: string,
): Promise<{ id: string; firstSeenAt: string | null } | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_seen_at')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data ? { id: data.id, firstSeenAt: data.first_seen_at } : null;
}
