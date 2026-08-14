import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * One turn with the AI assistant Edge Function (`supabase/functions/
 * ai-assistant-chat`) — sends the whole visible transcript each time (no
 * server-side conversation state) and gets the assistant's next reply back.
 * Advisory only: every tool the function can call is a read; nothing this
 * function returns has already happened.
 */
export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ reply?: string; error?: string }>(
    'ai-assistant-chat',
    { body: { messages } },
  );

  if (error) throw error;
  if (!data || data.error) throw new Error(data?.error ?? 'The assistant is unavailable right now.');
  return data.reply ?? '';
}
