import { invokeFunction } from '@/lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BookingProposal {
  type: 'booking';
  full_name: string;
  email: string;
  mobile?: string;
  starts_at: string;
  duration_min?: number;
  note?: string;
}

export interface EmailProposal {
  type: 'email';
  customer_email: string;
  customer_name: string;
  subject: string;
  body: string;
}

export type Proposal = BookingProposal | EmailProposal;

export interface ChatTurn {
  reply: string;
  proposal: Proposal | null;
}

/**
 * One turn with the AI assistant Edge Function (`supabase/functions/
 * ai-assistant-chat`) — sends the whole visible transcript each time (no
 * server-side conversation state) and gets the assistant's next reply back.
 *
 * Every *read* the function can do it just does. Booking a real appointment
 * or emailing a real customer is different: the function only ever returns
 * a `proposal` describing what it would do — `AssistantChatTab` renders that
 * as a card the owner must explicitly confirm, which is what actually calls
 * `createAppointmentAsOwner` / `sendCustomEmailAsOwner` from the browser
 * under her own session. Nothing this function returns has already happened.
 */
export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatTurn> {
  const data = await invokeFunction<{
    reply?: string;
    proposal?: Proposal;
    error?: string;
  }>('ai-assistant-chat', { messages });

  if (data.error) throw new Error(data.error);
  return { reply: data.reply ?? '', proposal: data.proposal ?? null };
}
