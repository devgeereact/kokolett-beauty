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

/**
 * KNOWN DEFECT — the plain-text part can lose a full stop in a long URL.
 *
 * denomailer 1.6.0 encodes every body as quoted-printable, which soft-wraps at
 * ~74 columns. When a wrap puts a `.` at the start of a continuation line the
 * character is silently lost, because RFC 5321 §4.5.2 requires an SMTP client
 * to double a leading `.` and denomailer does not — the receiving MTA then
 * strips it as the transparency mechanism.
 *
 * Confirmed on delivered mail: every other soft break kept its character
 * (`wo`+`rks`, `Kok`+`olett`, `reset-pass`+`word`) and only the one before
 * `.co` lost anything, so `...supabase.co/auth/v1/verify...` arrived as
 * `...supabaseco/auth/v1/verify...` in the text part while the HTML part was
 * intact.
 *
 * Impact: the HTML part is correct, and that is what essentially every mail
 * client renders, so the visible link works. A recipient reading plain text
 * gets a dead link. It affects any long URL — customer magic links included.
 *
 * NOT worked around here on purpose. Four attempts were made to shift the wrap
 * off the offending character by padding the line, and all four failed because
 * the library's real column budget is not a constant (74, 74, 73, 148 observed
 * on one message) and does not match any simple model of it. Folding the body
 * to pure ASCII did not help either: denomailer chooses quoted-printable
 * unconditionally, not because of the content. Shipping a guess that only
 * appears to work would be worse than a documented defect, and each attempt
 * added complexity to the one code path that carries every customer email.
 *
 * The real fix is to stop using denomailer — either a maintained Deno SMTP
 * client that dot-stuffs correctly, or an HTTP mail API. Tracked as such.
 */

/**
 * Whether the relay has told us this will never work.
 *
 * SMTP 5xx is a permanent refusal; 4xx is "try later". Retrying a 5xx five
 * times over six hours achieves nothing except repeatedly asking a mail server
 * to reject the same message, which is exactly the behaviour that gets a
 * sending IP throttled — the opposite of what this domain needs while it is
 * building reputation.
 *
 * Found the hard way: a reset addressed to `dev@koko.gakinz.com` came back
 * `550: No Such User Here` and was queued for four more attempts.
 */
function isPermanentFailure(message: string): boolean {
  // Leading 5xx, or the phrasings relays use for an address that does not exist.
  return (
    /(^|\s)5\d\d(\s|:|-)/.test(message) ||
    /no such user|user unknown|does not exist|mailbox unavailable|recipient rejected|address rejected/i.test(
      message,
    )
  );
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

  const fromEmail = env('SMTP_FROM_EMAIL', 'booking@kokolettbeauty.com');
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
        headers: {
          /**
           * denomailer 1.6.0 emits no Message-ID at all, and 1.6.0 is the
           * latest release, so this has to be supplied here.
           *
           * A missing Message-ID is one of the strongest spam signals there is:
           * every legitimate mail agent sets one, so its absence marks a message
           * as machine-generated by something that is not a real mail client.
           * Gmail and Outlook both weight it heavily. Inspecting a delivered
           * message on the server confirmed the header was simply not present.
           *
           * The domain part must be the sending domain for the id to look
           * legitimate to a receiver correlating it with the envelope.
           */
          'Message-ID': `<${crypto.randomUUID()}@${fromEmail.split('@')[1]}>`,

          /**
           * No `Date` here, deliberately, even though denomailer's own is
           * poorly formed (`11 Aug 2026 07:04:08 GMT` — no day-of-week, and the
           * obsolete zone name rather than a numeric offset).
           *
           * Setting one does not replace denomailer's, it *appends* a second,
           * and two Date headers is a plain RFC 5322 violation — worse for
           * deliverability than the imperfect single header it was meant to
           * improve. Verified by inspecting a delivered message. Fixing the
           * format properly needs a change in the library.
           */

          /**
           * These are confirmations and reminders, not correspondence. Marking
           * them auto-generated stops out-of-office responders replying to the
           * salon's inbox, which is both noise and a reputation drag.
           */
          'Auto-Submitted': 'auto-generated',
        },
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
      const message = e instanceof Error ? e.message : String(e);
      // A permanent refusal is not worth another five attempts, and the retries
      // cost sending reputation rather than buying a delivery.
      const giveUp = attempts >= MAX_ATTEMPTS || isPermanentFailure(message);
      await supabase
        .from('email_messages')
        .update({
          // Not exhausted yet? Back to the queue with a later schedule.
          status: giveUp ? 'failed' : 'queued',
          scheduled_for: giveUp ? undefined : nextAttemptAt(attempts),
          last_error: message.slice(0, 500),
        })
        .eq('id', row.id);
      failed += 1;
    }
  }

  return Response.json({ sent, failed, considered: rows.length });
});
