import { type JSX, useCallback, useEffect, useState } from 'react';
import { Megaphone, Sparkles, UserCheck, UserX, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardHeading } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/States';
import { draftCopy } from '@/services/draftCopyService';
import { getBroadcastAudience, sendBroadcast } from '@/services/broadcastService';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/context/ToastContext';
import type { BroadcastAudience } from '@/types';

/**
 * The owner's own words, drafted from a rough idea and reviewed before it
 * sends to every confirmed, not-unsubscribed mailing-list subscriber
 * (migration 0058) — same "AI proposes, owner confirms" principle as
 * every other AI-assisted write in this app.
 *
 * The audience comes from `broadcast_audience()` (migration 0081), not from
 * filtering the subscriber list in the browser. Two reasons. It is the same
 * count the send itself uses, so the confirm dialog cannot promise a number
 * the send then exceeds. And since 0081 the list is fed by consent as well as
 * by the /subscribe form, so a customer who ticked the marketing box while
 * booking — or had it ticked for her on the Customers page — is a recipient.
 * Before that the two systems never spoke, and this screen read "nobody has
 * confirmed their subscription yet" while the Customers page was full of
 * ticked consent boxes.
 */
export function BroadcastsPage(): JSX.Element {
  const { showToast } = useToast();
  const [audience, setAudience] = useState<BroadcastAudience | null>(null);
  const [audienceError, setAudienceError] = useState(false);
  const [roughIdea, setRoughIdea] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  /* `null` means "not known", and it has to stay distinguishable from zero.
     The catch used to set it back to null, which is the same value the initial
     state uses, so a failed fetch left "Loading recipient count..." on screen
     for good with no error and no retry. */
  const loadAudience = useCallback((): void => {
    getBroadcastAudience()
      .then((next) => {
        setAudience(next);
        setAudienceError(false);
      })
      .catch(() => {
        setAudience(null);
        setAudienceError(true);
      });
  }, []);

  useEffect(loadAudience, [loadAudience]);

  const polish = (): void => {
    if (!roughIdea.trim()) return;
    setDrafting(true);
    setDraftError(null);
    draftCopy({ kind: 'broadcast', roughIdea })
      .then((result) => {
        setSubject(result.subject ?? subject);
        setBody(result.body);
      })
      .catch((e: unknown) => setDraftError(errorMessage(e)))
      .finally(() => setDrafting(false));
  };

  const send = (): void => {
    setSending(true);
    sendBroadcast(subject.trim(), body.trim())
      .then(({ recipient_count }) => {
        showToast({ message: `Sent to ${recipient_count} subscriber(s).` });
        setSubject('');
        setBody('');
        setRoughIdea('');
        /* Re-read rather than assume. An unsubscribe that landed while the
           page was open changes the audience, and a stale count here is the
           number the next confirm dialog would quote. */
        loadAudience();
      })
      .catch((e: unknown) => showToast({ message: errorMessage(e) }))
      .finally(() => setSending(false));
  };

  const recipientCount = audience?.recipient_count ?? null;

  /* `> 0`, not `!== null`. Zero passed the old check, so Send was enabled while
     the page itself read "Will send to 0 subscriber(s)" and the confirm dialog
     offered an irreversible action with no recipients. */
  const canSend =
    !sending &&
    recipientCount !== null &&
    recipientCount > 0 &&
    subject.trim() !== '' &&
    body.trim() !== '';

  return (
    <DashboardLayout
      title="Broadcasts"
      subtitle="A newsletter or ad to your mailing list, drafted with AI, reviewed by you, sent to no one else."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card pad="standard">
            <CardHeading
              size="compact"
              title="Start with a rough idea"
              description="Type it however it comes out. Polishing turns it into a subject and a finished message you can still edit."
            />

            <Field label="What do you want to say?">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={roughIdea}
                  onChange={(e) => setRoughIdea(e.target.value)}
                  placeholder="e.g. we have new availability this week for braids and twists"
                />
              )}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              onClick={polish}
              disabled={drafting || !roughIdea.trim()}
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              {drafting ? 'Drafting…' : 'Polish with AI'}
            </Button>
            {draftError && (
              <p className="mt-2 text-sm text-status-no-show">{draftError}</p>
            )}
          </Card>

          <Card pad="standard">
            <CardHeading
              size="compact"
              title="The message"
              description="This is what goes out, in your salon's email design, with an unsubscribe link in the footer."
            />

            <Field label="Subject">
              {({ id }) => (
                <Input
                  id={id}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="New availability this week"
                />
              )}
            </Field>
            <Field label="Body">
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write it as you would say it. Blank lines become paragraphs."
                />
              )}
            </Field>
          </Card>
        </div>

        <Card pad="standard" className="flex h-full flex-col lg:sticky lg:top-6">
          <CardHeading
            size="compact"
            title="Who this reaches"
            description="Everyone who has agreed to hear from you, and nobody else."
          />

          {audienceError ? (
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-sm font-medium text-foreground">
                The mailing list could not be read
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nothing can be sent until it loads. Try again in a moment.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 self-start"
                onClick={loadAudience}
              >
                Try again
              </Button>
            </div>
          ) : audience === null ? (
            <div className="flex flex-1 items-center">
              <LoadingState label="Counting recipients…" />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-4xl text-foreground">
                  {audience.recipient_count}
                </span>
                <span className="text-sm text-muted-foreground">
                  {audience.recipient_count === 1 ? 'recipient' : 'recipients'}
                </span>
              </div>

              {audience.recipient_count === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nobody is on the list yet. Anyone who ticks marketing consent when
                  booking, or who you tick it for on the Customers page, is added
                  automatically.
                </p>
              )}

              <ul className="mt-5 space-y-3 border-t border-border pt-4">
                <li className="flex items-start gap-2.5">
                  <UserCheck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink"
                    strokeWidth={2}
                  />
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {audience.from_consent}
                    </span>{' '}
                    from marketing consent on a customer record
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Users
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink"
                    strokeWidth={2}
                  />
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {audience.from_website}
                    </span>{' '}
                    signed up through your mailing-list link
                  </span>
                </li>
                {audience.opted_out > 0 && (
                  <li className="flex items-start gap-2.5">
                    <UserX
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <span className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {audience.opted_out}
                      </span>{' '}
                      opted out and will not be emailed, even if consent is ticked again
                    </span>
                  </li>
                )}
              </ul>

              <div className="mt-auto pt-6">
                <Button
                  className="w-full"
                  disabled={!canSend}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Megaphone aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  {sending ? 'Sending…' : 'Send broadcast'}
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  You will be asked to confirm. There is no undo.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Send this broadcast?"
        message={`This sends "${subject}" to ${recipientCount ?? 0} subscriber(s) right now. There is no undo.`}
        confirmLabel={sending ? 'Sending…' : 'Send'}
        onConfirm={() => {
          setConfirmOpen(false);
          send();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </DashboardLayout>
  );
}
