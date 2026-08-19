import { supabase } from '@/lib/supabase';
import type { EmailMessage, EmailTemplateRow, EmailTemplateUpdate } from '@/types';

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
  return data as string;
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
      usage.set(row.template, { count: 1, lastSentAt: row.sent_at ?? row.created_at, example: row });
    } else {
      existing.count += 1;
    }
  }
  return usage;
}

/**
 * The owner's editable draft of a template (`email_templates`, migration
 * 0032) — a real saved row, not a mock. Editing and saving here does not
 * yet change what `send-emails` actually sends (still the hard-coded
 * renderer in `supabase/functions/_shared/templates.ts`); this is the
 * draft/preview layer the Template Editor screen writes to.
 */
export async function getEmailTemplate(key: string): Promise<EmailTemplateRow | null> {
  const { data, error } = await supabase.from('email_templates').select('*').eq('key', key).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listEmailTemplates(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase.from('email_templates').select('*').order('key');
  if (error) throw error;
  return data ?? [];
}

export async function updateEmailTemplate(key: string, patch: EmailTemplateUpdate): Promise<EmailTemplateRow> {
  const { data, error } = await supabase
    .from('email_templates')
    .update(patch)
    .eq('key', key)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export interface ListEmailsOptions {
  status?: EmailMessage['status'];
  search?: string;
  limit?: number;
}

/** The full outbox — Communications › Email's dataset. */
export async function listEmailMessages(options: ListEmailsOptions = {}): Promise<EmailMessage[]> {
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
