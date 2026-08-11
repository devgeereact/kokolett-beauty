/**
 * Sends the salon owner a link to choose a new password.
 *
 * Why this exists rather than calling `supabase.auth.resetPasswordForEmail()`
 * from the browser: that path sends through Supabase's own built-in mail sender,
 * which is a shared address (`noreply@mail.app.supabase.io`), is rate limited to
 * a handful of messages an hour, and carries none of this domain's sending
 * reputation. Outlook already junks mail from this two-day-old domain even when
 * it is fully authenticated — a recovery mail from a shared sender would fare
 * worse. The salon's own outbox is DKIM-signed, sends from
 * `booking@koko.gakinz.com`, and is the path every other message already takes.
 *
 * So this function mints the recovery link with the service-role key and queues
 * it in `email_messages` like everything else. The owner gets a branded email
 * from the address she recognises, and it is subject to the same retry and
 * scrubbing rules as the rest of the outbox.
 *
 * Three properties this must hold, and the reason for each:
 *
 *   1. **It never reveals who has an account.** Same neutral answer whatever
 *      happens, same as `customer-access`. Otherwise this becomes a way to test
 *      which addresses are staff.
 *   2. **Only staff can be reset through it.** Customers are not `auth.users` at
 *      all, so there is nothing to reset — but an address that is not on the
 *      staff table must not cause a link to be minted either.
 *   3. **It is rate limited.** Minting recovery links is cheap for an attacker
 *      and expensive for the salon's sending reputation.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL, ALLOWED_ORIGIN.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE = 'https://koko.gakinz.com';
/** Supabase recovery links are valid for an hour by default. */
const LINK_TTL_MINUTES = 60;
/** Per address, per hour. Generous for a person, useless for a script. */
const MAX_PER_HOUR = 3;

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

const CORS = {
  'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN', SITE),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  // The one answer this endpoint ever gives.
  const ok = (): Response =>
    Response.json(
      {
        ok: true,
        message: 'If that address can sign in, a link to set a new password is on its way.',
      },
      { headers: CORS },
    );

  let email = '';
  try {
    const body = (await req.json()) as { email?: string };
    email = (body.email ?? '').trim().toLowerCase();
  } catch {
    return ok();
  }

  // Deliberately the same shape the rest of the app accepts. Note it rejects
  // `%` and `_` implicitly by requiring no whitespace and exactly one @ — and
  // unlike `customer-access` before it was fixed, nothing here is used as a
  // LIKE pattern.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok();

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  // Only a staff address gets a link. `profiles` holds the email for each
  // `auth.users` row; `staff` is what `is_owner()` consults, so the join is the
  // same question the dashboard asks.
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, email, staff!inner(id)')
    .eq('email', email)
    .maybeSingle();

  if (!staff) return ok();

  // Rate limit on what has already been queued to this address.
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('template', 'owner_password_reset')
    .eq('to_email', email)
    .gte('created_at', since);

  if ((count ?? 0) >= MAX_PER_HOUR) return ok();

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${env('SITE_URL', SITE)}/reset-password` },
  });

  if (linkError || !link?.properties?.action_link) {
    console.error('[owner-password-reset] generateLink failed', linkError?.message);
    return ok();
  }

  await supabase.from('email_messages').insert({
    template: 'owner_password_reset',
    to_email: email,
    subject: 'Set a new password for your dashboard',
    status: 'queued',
    scheduled_for: new Date().toISOString(),
    payload: {
      // Live credential. `send-emails` scrubs the payload once delivered, which
      // is what stops a working recovery link sitting in the database.
      reset_url: link.properties.action_link,
      reset_ttl_minutes: LINK_TTL_MINUTES,
    },
  });

  return ok();
});
