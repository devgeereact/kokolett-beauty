/**
 * Drains the `email_messages` outbox over SMTP.
 *
 * Invoked on a schedule (pg_cron → pg_net, or any external pinger). It is
 * deliberately a drain rather than a send-on-write: the booking transaction
 * enqueues a row and commits, so a customer never fails to book because the
 * mail server was slow, and a mail server outage delays confirmations rather
 * than losing them.
 *
 * Requires these secrets:
 *   SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM_EMAIL SMTP_FROM_NAME
 *   EMAIL_CRON_SECRET   — shared secret so only the scheduler can trigger it
 *
 * Set them with:
 *   supabase secrets set SMTP_PASSWORD=... --project-ref <ref>
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { render, type TemplatePayload } from '../_shared/templates.ts';
import { requireCronSecret } from '../_shared/auth.ts';

const MAX_ATTEMPTS = 5;
const BATCH = 25;

interface EmailRow {
  id: string;
  template: string;
  to_email: string;
  subject: string;
  attempts: number;
  payload: TemplatePayload;
  customer_id: string | null;
}

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

/** Exponential backoff, so a bad address does not hammer the relay. */
function nextAttemptAt(attempts: number): string {
  const minutes = Math.min(60 * 6, 2 ** attempts);
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

Deno.serve(async (req: Request): Promise<Response> => {
  const refusal = await requireCronSecret(req, env('EMAIL_CRON_SECRET'), 'EMAIL_CRON_SECRET');
  if (refusal) return refusal;

  const supabase = createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const { data: rows, error } = await supabase
    .from('email_messages')
    .select('id, template, to_email, subject, attempts, payload, customer_id')
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return Response.json({ sent: 0, failed: 0, message: 'nothing due' });
  }

  const host = env('SMTP_HOST');
  const password = env('SMTP_PASSWORD');
  if (!host || !password) {
    // Loud, and without consuming an attempt: the messages stay queued so they
    // go out intact once the credentials are configured.
    return Response.json(
      { error: 'SMTP is not configured; leaving the queue untouched', due: rows.length },
      { status: 503 },
    );
  }

  const fromEmail = env('SMTP_FROM_EMAIL', 'booking@koko.gakinz.com');
  const fromName = env('SMTP_FROM_NAME', 'Kokolett Beauty UK');

  let sent = 0;
  let failed = 0;

  for (const row of rows as EmailRow[]) {
    // Claim it first. Two overlapping runs would otherwise both send.
    const { data: claimed } = await supabase
      .from('email_messages')
      .update({ status: 'sending', attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'queued')
      .select('id');

    if (!claimed || claimed.length === 0) continue;

    try {
      const client = new SMTPClient({
        connection: {
          hostname: host,
          port: Number(env('SMTP_PORT', '465')),
          tls: env('SMTP_PORT', '465') === '465',
          auth: { username: env('SMTP_USER', fromEmail), password },
        },
      });

      const body = render(row.template, row.payload ?? {});

      await client.send({
        from: `${fromName} <${fromEmail}>`,
        to: row.to_email,
        subject: row.subject,
        content: body.text,
        html: body.html,
        replyTo: fromEmail,
      });
      await client.close();

      await supabase
        .from('email_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: null,
          // Scrub the variables once delivered. `access_link` payloads carry a
          // working magic link, and the point of storing only a token hash is
          // that a database dump contains no usable links — a sent row that
          // kept its payload would quietly undo that. Nothing reads it again.
          payload: {},
        })
        .eq('id', row.id);
      sent += 1;
    } catch (e) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      await supabase
        .from('email_messages')
        .update({
          // Not exhausted yet? Back to the queue with a later schedule.
          status: exhausted ? 'failed' : 'queued',
          scheduled_for: exhausted ? undefined : nextAttemptAt(attempts),
          last_error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
        })
        .eq('id', row.id);
      failed += 1;
    }
  }

  return Response.json({ sent, failed, considered: rows.length });
});
