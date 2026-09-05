import { supabase } from '@/lib/supabase';

/**
 * The Contact page's message form. Validation and rate limiting both happen in
 * `submit_contact_message()` (migrations `0047` and `0049`) — this is a thin
 * wrapper, not a second copy of the rules.
 *
 * The error is thrown raw, as every other service does — the caller runs it
 * through `errorMessage()`. That is what turns a `TOO_MANY_MESSAGES` refusal
 * into copy that does not tell the visitor to try again, which is the one
 * thing they must not be told when trying again is what is being refused.
 */
export async function submitContactMessage(input: {
  fullName: string;
  email: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_contact_message', {
    p_full_name: input.fullName,
    p_email: input.email,
    p_message: input.message,
  });

  if (error) throw error;
}

/** A Contact-page enquiry as stored by `submit_contact_message()` (migration 0080). */
export interface ContactMessage {
  id: string;
  full_name: string;
  email: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
}

/**
 * The owner's side of the Contact form.
 *
 * Until `0080` there was no owner side: `submit_contact_message()` queued one
 * email and stored nothing, so a bounced notification lost the enquiry and a
 * fresh install (no `staff` row, so no address to send to) destroyed every
 * message silently while still reporting success to the sender. The table is
 * now the record and the email is only the nudge.
 *
 * Archived messages are excluded by default: the queue is for what still needs
 * answering, and `purge_expired_personal_data()` drops archived ones at two
 * years.
 */
export async function listContactMessages(
  includeArchived = false,
): Promise<ContactMessage[]> {
  let query = supabase
    .from('contact_messages')
    .select('id, full_name, email, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!includeArchived) query = query.neq('status', 'archived');

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContactMessage[];
}

/** Count of enquiries the owner has not opened yet, for the Inbox badge. */
export async function countNewContactMessages(): Promise<number> {
  const { count, error } = await supabase
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) throw error;
  return count ?? 0;
}

export async function setContactMessageStatus(
  id: string,
  status: ContactMessage['status'],
): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
