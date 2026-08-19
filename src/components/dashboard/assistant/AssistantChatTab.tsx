import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  FileEdit,
  HelpCircle,
  Mail,
  Megaphone,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import {
  sendChatMessage,
  type ChatMessage,
  type Proposal,
} from '@/services/aiChatService';
import { createAppointmentAsOwner } from '@/services/appointmentService';
import { sendCustomEmailAsOwner } from '@/services/emailService';
import { formatDateTime } from '@/lib/format';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const CATEGORY_CARDS = [
  { icon: HelpCircle, title: 'Answer questions', description: 'Get instant answers' },
  { icon: FileEdit, title: 'Create content', description: 'Write posts, emails, etc.' },
  { icon: TrendingUp, title: 'Analyse data', description: 'Find insights and trends' },
  { icon: Clock, title: 'Save time', description: 'Automate everyday tasks' },
] as const;

const SUGGESTION_CHIPS = [
  "Summarise today's appointments",
  'Write a social media post',
  'Find my top customers',
  'Analyse my revenue',
  'Help with a customer enquiry',
];

const QUICK_ACTIONS = [
  {
    icon: FileEdit,
    label: 'Write social post',
    prompt: 'Write a social media post promoting our current availability.',
  },
  {
    icon: Mail,
    label: 'Create email',
    prompt: 'Draft an email to send to a customer following up after their appointment.',
  },
  {
    icon: TrendingUp,
    label: 'Summarise report',
    prompt: 'Summarise my revenue and bookings over the last 4 weeks.',
  },
  {
    icon: Megaphone,
    label: 'Plan a promotion',
    prompt: 'Suggest a promotion I could run to fill quiet days.',
  },
  { icon: Search, label: 'Find availability', prompt: "What's on my schedule today?" },
] as const;

type ProposalStatus = 'pending' | 'confirmed' | 'dismissed' | 'error';

/**
 * A chat message plus, for an assistant turn that proposed a real action
 * (a booking or a customer email), that proposal and where it stands. The
 * status lives on the message so it survives a reload via `localStorage` —
 * a proposal the owner hasn't acted on yet is still there, still pending,
 * next time she opens the tab.
 */
interface DisplayMessage extends ChatMessage {
  proposal?: Proposal;
  proposalStatus?: ProposalStatus;
  proposalError?: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: DisplayMessage[];
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

/**
 * A proposed booking or email, shown as a reviewable card the owner must
 * explicitly act on — this is the one boundary in the whole chat where a
 * click turns into a real write (`createAppointmentAsOwner` /
 * `sendCustomEmailAsOwner`, called from here under her own session, never
 * from the edge function itself).
 */
function ProposalCard({
  proposal,
  status,
  error,
  timezone,
  onConfirm,
  onDismiss,
}: {
  proposal: Proposal;
  status: ProposalStatus;
  error?: string;
  timezone: string;
  onConfirm: () => void;
  onDismiss: () => void;
}): JSX.Element {
  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-status-completed bg-tint-completed px-3 py-2 text-xs font-medium text-status-completed">
        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {proposal.type === 'booking' ? 'Booked.' : 'Sent.'}
      </div>
    );
  }

  if (status === 'dismissed') {
    return (
      <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        Dismissed.
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {proposal.type === 'booking' ? (
          <Calendar aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Mail aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {proposal.type === 'booking' ? 'Proposed booking' : 'Proposed email'}
      </div>

      {proposal.type === 'booking' ? (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="text-right font-medium text-foreground">
              {proposal.full_name}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">When</dt>
            <dd className="text-right font-medium text-foreground">
              {formatDateTime(proposal.starts_at, timezone)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">Contact</dt>
            <dd className="truncate text-right text-foreground">
              {proposal.email}
              {proposal.mobile ? ` · ${proposal.mobile}` : ''}
            </dd>
          </div>
          {proposal.note && (
            <div className="pt-1 text-xs text-muted-foreground">
              Note: {proposal.note}
            </div>
          )}
        </dl>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className="truncate text-foreground">
            <span className="text-muted-foreground">To </span>
            {proposal.customer_name} &lt;{proposal.customer_email}&gt;
          </p>
          <p className="font-medium text-foreground">{proposal.subject}</p>
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {proposal.body}
          </p>
        </div>
      )}

      {status === 'error' && error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:brightness-110"
        >
          <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          {proposal.type === 'booking' ? 'Confirm booking' : 'Confirm & send'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          Dismiss
        </button>
      </div>
    </div>
  );
}

const greeting = (firstName: string): DisplayMessage => ({
  role: 'assistant',
  content: `Hello ${firstName}! I'm your AI assistant. I can help you with appointments, customers, services, reports, content creation and more. What would you like to do today?`,
});

/**
 * The AI assistant chat (`docs/design/ai.png`) — a real conversation backed
 * by `supabase/functions/ai-assistant-chat`, which forwards the owner's own
 * session to Anthropic's Claude with read-only tools over the salon's real
 * data. Conversation history persists in this browser via `localStorage`
 * (no backend table for it yet — the transcript never leaves the device
 * except to the model itself).
 *
 * Resumes the most recent conversation on mount rather than always starting
 * fresh — a follow-up question a few minutes (or a page reload) later should
 * still land in the same thread, with the same context and tone, until the
 * owner explicitly starts a new one.
 */
export function AssistantChatTab({ firstName }: { firstName: string }): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations(),
  );
  const [messages, setMessages] = useState<DisplayMessage[]>(
    () => conversations[0]?.messages ?? [greeting(firstName)],
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    () => conversations[0]?.id ?? null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

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
    setInput('');
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

  return (
    <div>
      <div className="mb-2">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          Hi {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Your AI assistant is here to help you manage your business, create content, and
          get things done faster.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {CATEGORY_CARDS.map((c) => (
          <Card key={c.title} className="flex items-center gap-3 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-brand text-primary">
              <c.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {c.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.description}
              </span>
            </span>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="flex h-[640px] flex-col p-0">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-3',
                    m.role === 'user' && 'flex-row-reverse',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                    </span>
                  ) : (
                    <Avatar name={firstName} size="sm" />
                  )}
                  <div className="flex max-w-[80%] flex-col gap-2">
                    <div
                      className={cn(
                        'rounded-lg px-4 py-3 text-sm whitespace-pre-wrap',
                        m.role === 'assistant'
                          ? 'bg-muted text-foreground'
                          : 'bg-tint-brand text-foreground',
                      )}
                    >
                      {m.content}
                    </div>
                    {m.proposal && (
                      <ProposalCard
                        proposal={m.proposal}
                        status={m.proposalStatus ?? 'pending'}
                        error={m.proposalError}
                        timezone={timezone}
                        onConfirm={() => void confirmProposal(i, m.proposal!)}
                        onDismiss={() => dismissProposal(i)}
                      />
                    )}
                  </div>
                </div>
              ))}

              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2 pl-11">
                  {SUGGESTION_CHIPS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {sending && (
                <div className="flex items-center gap-3 pl-11">
                  <Spinner />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              )}

              {error && (
                <p role="alert" className="pl-11 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <Sparkles
                aria-hidden="true"
                className="ml-2 h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything… (e.g. 'Create a social media post' or 'Show me tomorrow's schedule')"
                className="h-11 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:pointer-events-none disabled:opacity-50"
              >
                <Send aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </button>
            </form>
          </Card>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Kokolett AI · Advisory only — nothing here books, cancels, or edits anything
            on its own
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-base font-semibold text-foreground">
                Quick actions
              </h2>
              <button
                type="button"
                onClick={startNewConversation}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                New chat
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => void send(a.prompt)}
                  className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-left text-xs font-medium text-foreground hover:bg-muted"
                >
                  <a.icon
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-primary"
                    strokeWidth={2}
                  />
                  {a.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-serif text-base font-semibold text-foreground">
              Recent conversations
            </h2>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet — ask something to start one.
              </p>
            ) : (
              <ul className="space-y-1">
                {conversations.slice(0, 5).map((c) => (
                  <li
                    key={c.id}
                    className="group flex items-center gap-1 rounded-lg hover:bg-muted"
                  >
                    <button
                      type="button"
                      onClick={() => openConversation(c)}
                      className={cn(
                        'min-w-0 flex-1 rounded-lg px-2 py-2 text-left',
                        c.id === activeConversationId && 'bg-tint-brand',
                      )}
                    >
                      <span className="block truncate text-sm text-foreground">
                        {c.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(c.id)}
                      aria-label={`Delete conversation "${c.title}"`}
                      className="mr-1 shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-card hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        strokeWidth={2}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
