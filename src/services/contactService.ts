import { supabase } from '@/lib/supabase';

/**
 * The Contact page's message form. Validation happens in
 * `submit_contact_message()` (migration `0047`) — this is a thin wrapper,
 * not a second copy of the rules.
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
