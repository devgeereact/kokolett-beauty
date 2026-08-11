/**
 * Mints a customer magic link.
 *
 * This is an Edge Function rather than an RPC for one reason: the raw token
 * must exist only in the email. A SQL function that had to hand the token to
 * the mailer would have to persist it somewhere first, and the whole point of
 * storing only a SHA-256 hash is that a database dump does not contain working
 * links. Here the raw token is generated, put straight into the queued email
 * payload, and the hash alone is written to `customer_access_tokens`.
 *
 * The response never reveals whether the address is on file. Anything else
 * turns this endpoint into a way of testing who is a customer of the salon.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOKEN_TTL_MINUTES = 30;
const SITE = 'https://koko.gakinz.com';

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

const CORS = {
  'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN', SITE),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  // Always the same answer, whatever happens below.
  const ok = (): Response =>
    Response.json(
      { ok: true, message: 'If that address is on file, a link is on its way.' },
      { headers: CORS },
    );

  let email = '';
  try {
    const body = (await req.json()) as { email?: string };
    email = (body.email ?? '').trim().toLowerCase();
  } catch {
    return ok();
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok();

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // `.eq`, never `.ilike`. The regex above accepts `%` and `_`, which are LIKE
  // wildcards, so `.ilike` turned this endpoint into a search: `%@%.%` matched
  // every customer, and an attacker could narrow a pattern one character at a
  // time and read the hit count off the response latency (one match does two
  // extra writes before answering; several match and abort early). That defeats
  // the promise in this file's header. `customers.email` is `citext`
  // (0002_salon.sql:102), so equality is already case-insensitive and the
  // wildcard match bought nothing in the first place.
  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, email')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();

  if (!customer) return ok();

  const raw = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { error: tokenError } = await supabase.from('customer_access_tokens').insert({
    customer_id: customer.id,
    token_hash: await sha256Hex(raw),
    purpose: 'manage',
    expires_at: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString(),
  });

  if (tokenError) return ok();

  await supabase.from('email_messages').insert({
    template: 'access_link',
    to_email: customer.email,
    subject: 'Your bookings at Kokolett Beauty',
    customer_id: customer.id,
    status: 'queued',
    scheduled_for: new Date().toISOString(),
    payload: {
      customer_name: customer.full_name,
      // The raw token is in this row only until the message goes out —
      // send-emails scrubs the payload on success, so a working link never
      // persists in the database. It is still briefly present for a queued or
      // failed message, which is why the queue is owner-only under RLS.
      manage_url: `${env('SITE_URL', SITE)}/access/${raw}`,
    },
  });

  return ok();
});
