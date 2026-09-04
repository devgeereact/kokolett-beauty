import { useState } from 'react';
import type { ChatMessage, Proposal } from '@/services/aiChatService';
import { sendChatMessage } from '@/services/aiChatService';
import { createAppointmentAsOwner } from '@/services/appointmentService';
import { sendCustomEmailAsOwner } from '@/services/emailService';
import { errorMessage } from '@/lib/errors';

export type ProposalStatus = 'pending' | 'confirmed' | 'dismissed' | 'error';

/**
 * A chat message plus, for an assistant turn that proposed a real action
 * (a booking or a customer email), that proposal and where it stands. The
 * status lives on the message so it survives a reload via `localStorage` —
 * a proposal the owner hasn't acted on yet is still there, still pending,
 * next time she opens the tab.
 */
export interface DisplayMessage extends ChatMessage {
  proposal?: Proposal;
  proposalStatus?: ProposalStatus;
  proposalError?: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: DisplayMessage[];
}

interface UseAssistantConversations {
  conversations: Conversation[];
  messages: DisplayMessage[];
  activeConversationId: string | null;
  sending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  confirmProposal: (index: number, proposal: Proposal) => Promise<void>;
  dismissProposal: (index: number) => void;
  startNewConversation: () => void;
  openConversation: (c: Conversation) => void;
  deleteConversation: (id: string) => void;
}

const STORAGE_KEY = 'kokolett-ai-conversations';

function loadConversations(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 20)));
  } catch {
    // Storage full or unavailable — the chat still works, it just won't remember past sessions.
  }
}

const greeting = (firstName: string): DisplayMessage => ({
  role: 'assistant',
  content: `Hello ${firstName}! I'm your AI assistant. I can help you with appointments, customers, services, reports, content creation and more. What would you like to do today?`,
});

/**
 * Conversation state and persistence for the AI assistant chat tab: sending
 * a message, tracking the one action a reply can propose (a booking or a
 * customer email), and a `localStorage`-backed conversation list so a thread
 * survives a reload. There is no backend table for it yet — the transcript
 * never leaves the device except to the model itself.
 */
export function useAssistantConversations(firstName: string): UseAssistantConversations {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations(),
  );
  const [messages, setMessages] = useState<DisplayMessage[]>(
    () => conversations[0]?.messages ?? [greeting(firstName)],
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    () => conversations[0]?.id ?? null,
  );

  const persistTurn = (nextMessages: DisplayMessage[]): void => {
    const firstUser = nextMessages.find((m) => m.role === 'user');
    if (!firstUser) return;
    const id = activeConversationId ?? crypto.randomUUID();
    setActiveConversationId(id);
    const title =
      firstUser.content.length > 48
        ? `${firstUser.content.slice(0, 48)}…`
        : firstUser.content;
    const updated: Conversation = {
      id,
      title,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    };
    setConversations((prev) => {
      const next = [updated, ...prev.filter((c) => c.id !== id)];
      saveConversations(next);
      return next;
    });
  };

  // Updates one message in place (used when a proposal's status changes)
  // and re-persists the conversation, so a confirmed/dismissed proposal
  // stays that way after a reload instead of asking again.
  const updateMessage = (index: number, patch: Partial<DisplayMessage>): void => {
    setMessages((prev) => {
      const next = prev.map((m, i) => (i === index ? { ...m, ...patch } : m));
      persistTurn(next);
      return next;
    });
  };

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setSending(true);
    try {
      const { reply, proposal } = await sendChatMessage(next);
      const withReply: DisplayMessage[] = [
        ...next,
        {
          role: 'assistant' as const,
          content: reply,
          proposal: proposal ?? undefined,
          proposalStatus: proposal ? ('pending' as const) : undefined,
        },
      ];
      setMessages(withReply);
      persistTurn(withReply);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const confirmProposal = async (index: number, proposal: Proposal): Promise<void> => {
    try {
      if (proposal.type === 'booking') {
        await createAppointmentAsOwner({
          startsAt: new Date(proposal.starts_at),
          fullName: proposal.full_name,
          email: proposal.email,
          mobile: proposal.mobile,
          note: proposal.note,
          durationMin: proposal.duration_min,
        });
      } else {
        await sendCustomEmailAsOwner(
          proposal.customer_email,
          proposal.customer_name,
          proposal.subject,
          proposal.body,
        );
      }
      updateMessage(index, { proposalStatus: 'confirmed' });
    } catch (e) {
      updateMessage(index, { proposalStatus: 'error', proposalError: errorMessage(e) });
    }
  };

  const dismissProposal = (index: number): void => {
    updateMessage(index, { proposalStatus: 'dismissed' });
  };

  const startNewConversation = (): void => {
    setActiveConversationId(null);
    setMessages([greeting(firstName)]);
    setError(null);
  };

  const openConversation = (c: Conversation): void => {
    setActiveConversationId(c.id);
    setMessages(c.messages);
    setError(null);
  };

  const deleteConversation = (id: string): void => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConversations(next);
      return next;
    });
    if (id === activeConversationId) {
      startNewConversation();
    }
  };

  return {
    conversations,
    messages,
    activeConversationId,
    sending,
    error,
    send,
    confirmProposal,
    dismissProposal,
    startNewConversation,
    openConversation,
    deleteConversation,
  };
}
