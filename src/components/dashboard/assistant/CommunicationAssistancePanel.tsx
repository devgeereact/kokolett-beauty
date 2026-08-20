import { type JSX, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { getRecentMessages, type RecentMessage } from '@/services/assistantService';
import { suggestReply, type ReplyTone } from '@/lib/emailDrafts';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONES: ReplyTone[] = ['friendly', 'formal', 'brief'];
const TONE_LABELS: Record<ReplyTone, string> = {
  friendly: 'Friendly',
  formal: 'Formal',
  brief: 'Brief',
};

/**
 * The closest thing this app has to an inbox: recent free-text notes left
 * on a booking or a waitlist request. No reply-tracking exists, so this is
 * "what customers have said lately", not a threaded conversation.
 *
 * `customerEmail`, when given, scopes this to one customer's messages —
 * used embedded in `CustomerDetailPanel` so replying is a click away from
 * their profile instead of hunting for them in the salon-wide list.
 */
export function CommunicationAssistancePanel({
  timezone,
  customerEmail,
}: {
  timezone: string;
  customerEmail?: string;
}): JSX.Element {
  const [allMessages, setAllMessages] = useState<RecentMessage[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tone, setTone] = useState<ReplyTone>('friendly');
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);

  const load = (): void => {
    setError(null);
    getRecentMessages(timezone)
      .then(setAllMessages)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  const messages = useMemo(() => {
    if (!allMessages) return null;
    if (!customerEmail) return allMessages;
    const email = customerEmail.trim().toLowerCase();
    return allMessages.filter((m) => m.customerEmail.trim().toLowerCase() === email);
  }, [allMessages, customerEmail]);

  // Scoped to one customer, there's rarely more than one message to pick
  // from — skip the "choose a message" step and go straight to a draft.
  useEffect(() => {
    if (customerEmail && messages && messages.length > 0 && selectedId === null) {
      setSelectedId(messages[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerEmail, messages]);

  const selected = useMemo(
    () => messages?.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setReply('');
      return;
    }
    setReply(suggestReply(selected.text, tone, selected.customerName));
    setCopied(false);
  }, [selected, tone]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!messages) return <LoadingState label="Gathering recent messages…" />;
  if (messages.length === 0) {
    return (
      <EmptyState
        title="Nothing recent"
        description={
          customerEmail
            ? 'Nothing from them yet — notes left when booking, or on a waitlist request, show up here.'
            : 'Notes customers leave when booking, or on a waitlist request, show up here.'
        }
      />
    );
  }

  const mailHref = selected
    ? `mailto:${selected.customerEmail}?subject=${encodeURIComponent('Re: your message')}&body=${encodeURIComponent(reply)}`
    : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        {messages.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className={cn(
              'w-full rounded-md border p-4 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selectedId === m.id
                ? 'border-primary bg-card'
                : 'border-border bg-card hover:bg-muted',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">{m.customerName}</p>
              <span className="text-xs text-muted-foreground">
                {formatRelative(m.createdAt)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              &ldquo;{m.text}&rdquo;
            </p>
          </button>
        ))}
      </div>

      <Card className="h-fit p-5">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Choose a message on the left to draft a reply.
          </p>
        ) : (
          <>
            <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              &ldquo;{selected.text}&rdquo;
            </p>

            <fieldset className="mb-4">
              <legend className="mb-1.5 block text-sm font-medium text-foreground">
                Tone
              </legend>
              <div className="flex gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      tone === t
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground hover:bg-muted',
                    )}
                  >
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </fieldset>

            <Textarea
              aria-label="Suggested reply"
              rows={5}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <a
                href={mailHref}
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-95"
              >
                Send reply
              </a>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(reply);
                  setCopied(true);
                }}
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
