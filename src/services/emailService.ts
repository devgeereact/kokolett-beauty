import { invokeFunction, supabase } from '@/lib/supabase';
import type {
  EmailMessage,
  EmailTemplateRevision,
  EmailTemplateRow,
  EmailTemplateUpdate,
} from '@/types';

/**
 * `email_messages` — the delivery log and retry queue an Inngest worker
 * drains (`docs/SCHEMA.md` §10). Mostly read-only here: nothing on the
 * dashboard composes or resends a *transactional* email directly, it only
 * shows what the automated sender already queued and its outcome.
 * `sendCustomEmailAsOwner` (migration 0036) is the one write — a one-off
 * message to an existing customer, owner-gated, still going through the
 * same outbox rather than sending directly.
 */
export type { EmailMessage };

/** Enqueues a one-off email to a customer. Never sends directly — same outbox, retry and audit trail as every other email. */
export async function sendCustomEmailAsOwner(
  customerEmail: string,
  customerName: string,
  subject: string,
  body: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('send_custom_email_as_owner', {
    p_customer_email: customerEmail,
    p_customer_name: customerName,
    p_subject: subject,
    p_body: body,
  });
  if (error) throw error;
  return data;
}

/**
 * Deletes one outbox row outright. RLS (`email_messages_owner_all`) is the
 * only guard — same direct-delete shape as `serviceMenuService.deleteMenuItem`,
 * no RPC needed because this is an owner-session write, not a public one.
 * No undo: the row is gone from the database, so it is gone everywhere this
 * app reads it from, including the dashboard list it disappears from.
 */
export async function deleteEmailMessage(id: string): Promise<void> {
  const { error } = await supabase.from('email_messages').delete().eq('id', id);
  if (error) throw error;
}

export async function listEmailsForCustomer(customerId: string): Promise<EmailMessage[]> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export interface TemplateUsage {
  count: number;
  lastSentAt: string | null;
  example: EmailMessage | null;
}

/**
 * Real usage per template — how many times the outbox has actually sent
 * each one, and a genuine most-recent example to preview, rather than a
 * fabricated mockup subject/body. Scans up to 2000 recent rows client-side;
 * fine at this salon's mail volume, and avoids adding a template_id column
 * or a grouped RPC for what's a read-only admin page.
 */
export async function getTemplateUsage(): Promise<Map<string, TemplateUsage>> {
  const { data, error } = await supabase
    .from('email_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;

  const usage = new Map<string, TemplateUsage>();
  for (const row of data ?? []) {
    const existing = usage.get(row.template);
    if (!existing) {
      usage.set(row.template, {
        count: 1,
        lastSentAt: row.sent_at ?? row.created_at,
        example: row,
      });
    } else {
      existing.count += 1;
    }
  }
  return usage;
}

/**
 * The owner's editable overlay on a template (`email_templates`, migration
 * 0032) — a real saved row, not a mock. When `active` and
 * `include_in_automation` are both on, `send-emails` renders this row's
 * `subject`/`html_body` (with `{{token}}` substitution) instead of the
 * hard-coded copy in `supabase/functions/_shared/templates.ts`; turning
 * either off reverts that template to the tested default.
 */
export async function getEmailTemplate(key: string): Promise<EmailTemplateRow | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase.from('email_templates').select('*').order('key');
  if (error) throw error;
  return data ?? [];
}

export async function updateEmailTemplate(
  key: string,
  patch: EmailTemplateUpdate,
): Promise<EmailTemplateRow> {
  const { data, error } = await supabase
    .from('email_templates')
    .update(patch)
    .eq('key', key)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Prior versions of a template, newest first (`email_template_revisions`,
 * migration 0061) — logged automatically by a trigger whenever `subject` or
 * `html_body` actually changes. A revert is just `updateEmailTemplate()`
 * with an earlier revision's content: no separate revert RPC, and the
 * trigger snapshots the pre-revert state as a new revision the same way.
 */
export async function listTemplateRevisions(
  key: string,
): Promise<EmailTemplateRevision[]> {
  const { data, error } = await supabase
    .from('email_template_revisions')
    .select('*')
    .eq('template_key', key)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface EmailPreview {
  available: boolean;
  reason?: string;
  subject?: string;
  html?: string;
  text?: string;
}

/**
 * Renders a real, previously-sent (or still-queued) email for the
 * Communications › Email detail pane — via the `render-email-preview` Edge
 * Function, which shares `_shared/templates.ts` with `send-emails` so this
 * is exactly what went out, override included. `available: false` means the
 * payload was scrubbed after sending (see `send-emails`'s own comment) and
 * there is nothing left to render.
 */
export async function previewEmailMessage(id: string): Promise<EmailPreview> {
  return invokeFunction<EmailPreview>('render-email-preview', { id });
}

export interface ListEmailsOptions {
  status?: EmailMessage['status'];
  search?: string;
  limit?: number;
}

/** The full outbox — Communications › Email's dataset. */
export async function listEmailMessages(
  options: ListEmailsOptions = {},
): Promise<EmailMessage[]> {
  let request = supabase
    .from('email_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status) request = request.eq('status', options.status);
  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    request = request.or(`subject.ilike.${term},to_email.ilike.${term}`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}
