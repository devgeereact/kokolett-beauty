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
