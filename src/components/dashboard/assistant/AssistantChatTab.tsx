import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  FileEdit,
  HelpCircle,
  Mail,
  Megaphone,
  Plus,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { sendChatMessage, type ChatMessage } from '@/services/aiChatService';
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
  { icon: FileEdit, label: 'Write social post', prompt: 'Write a social media post promoting our current availability.' },
  { icon: Mail, label: 'Create email', prompt: 'Draft an email to send to a customer following up after their appointment.' },
  { icon: TrendingUp, label: 'Summarise report', prompt: 'Summarise my revenue and bookings over the last 4 weeks.' },
  { icon: Megaphone, label: 'Plan a promotion', prompt: 'Suggest a promotion I could run to fill quiet days.' },
  { icon: Search, label: 'Find availability', prompt: "What's on my schedule today?" },
] as const;

const POPULAR_PROMPTS = [
  'Create a social media post for Instagram',
  'Write a polite reply to a customer enquiry',
  'Summarise my monthly revenue',
  'Suggest a new service for my salon',
];

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
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
 * The AI assistant chat (`docs/design/ai.png`) — a real conversation backed
 * by `supabase/functions/ai-assistant-chat`, which forwards the owner's own
 * session to Anthropic's Claude with read-only tools over the salon's real
 * data. Conversation history persists in this browser via `localStorage`
 * (no backend table for it yet — the transcript never leaves the device
 * except to the model itself).
 */
export function AssistantChatTab({ firstName }: { firstName: string }): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello ${firstName}! I'm your AI assistant. I can help you with appointments, customers, services, reports, content creation and more. What would you like to do today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const persistTurn = (nextMessages: ChatMessage[]): void => {
    const firstUser = nextMessages.find((m) => m.role === 'user');
    if (!firstUser) return;
    const id = activeConversationId ?? crypto.randomUUID();
    setActiveConversationId(id);
    const title = firstUser.content.length > 48 ? `${firstUser.content.slice(0, 48)}…` : firstUser.content;
    const updated: Conversation = { id, title, updatedAt: new Date().toISOString(), messages: nextMessages };
    setConversations((prev) => {
      const next = [updated, ...prev.filter((c) => c.id !== id)];
      saveConversations(next);
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
      const reply = await sendChatMessage(next);
      const withReply = [...next, { role: 'assistant' as const, content: reply }];
      setMessages(withReply);
      persistTurn(withReply);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = (): void => {
    setActiveConversationId(null);
    setMessages([
      {
        role: 'assistant',
        content: `Hello ${firstName}! What would you like to do next?`,
      },
    ]);
    setError(null);
  };

  const openConversation = (c: Conversation): void => {
    setActiveConversationId(c.id);
    setMessages(c.messages);
    setError(null);
  };

  return (
    <div>
      <div className="mb-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">Hi {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Your AI assistant is here to help you manage your business, create content, and get things done faster.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORY_CARDS.map((c) => (
          <Card key={c.title} className="flex items-center gap-3 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tint-primary text-primary">
              <c.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{c.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{c.description}</span>
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
                  className={cn('flex items-start gap-3', m.role === 'user' && 'flex-row-reverse')}
                >
                  {m.role === 'assistant' ? (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                    </span>
                  ) : (
                    <Avatar name={firstName} size="sm" />
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
                      m.role === 'assistant' ? 'bg-muted text-foreground' : 'bg-tint-primary text-foreground',
                    )}
                  >
                    {m.content}
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
              <Sparkles aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
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
            Kokolett AI · Advisory only — nothing here books, cancels, or edits anything on its own
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">Quick actions</h2>
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
                  <a.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                  {a.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-base font-semibold text-foreground">Popular prompts</h2>
            <ul className="space-y-1">
              {POPULAR_PROMPTS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => void send(p)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <span className="truncate">{p}</span>
                    <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-base font-semibold text-foreground">Recent conversations</h2>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet — ask something to start one.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c)}
                      className="block w-full rounded-lg px-2 py-2 text-left hover:bg-muted"
                    >
                      <span className="block truncate text-sm text-foreground">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
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
