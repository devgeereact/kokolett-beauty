import { type JSX, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { draftCopy } from '@/services/draftCopyService';
import { sendBroadcast } from '@/services/broadcastService';
import { listSubscribers } from '@/services/subscriberService';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/context/ToastContext';

/**
 * The owner's own words, drafted from a rough idea and reviewed before it
 * sends to every confirmed, not-unsubscribed mailing-list subscriber
 * (migration 0058) — same "AI proposes, owner confirms" principle as
 * every other AI-assisted write in this app.
 */
export function BroadcastsPage(): JSX.Element {
  const { showToast } = useToast();
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
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
  const [countError, setCountError] = useState(false);
  useEffect(() => {
    listSubscribers()
      .then((rows) => {
        setRecipientCount(rows.filter((r) => r.confirmed).length);
        setCountError(false);
      })
      .catch(() => {
        setRecipientCount(null);
        setCountError(true);
      });
  }, []);

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
      })
      .catch((e: unknown) => showToast({ message: errorMessage(e) }))
      .finally(() => setSending(false));
  };

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
      <div className="max-w-2xl space-y-6">
        <Card pad="standard">
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
            {drafting ? 'Drafting…' : '✨ Polish with AI'}
          </Button>
          {draftError && <p className="mt-2 text-sm text-status-no-show">{draftError}</p>}
        </Card>

        <Card pad="standard">
          <Field label="Subject">
            {({ id }) => (
              <Input
                id={id}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            )}
          </Field>
          <Field label="Body">
            {({ id }) => (
              <Textarea
                id={id}
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            )}
          </Field>
          <p className="mb-3 text-sm text-muted-foreground">
            {countError
              ? 'The subscriber list could not be read, so this cannot be sent yet.'
              : recipientCount === null
                ? 'Loading recipient count…'
                : recipientCount === 0
                  ? 'Nobody has confirmed their subscription yet, so there is no one to send to.'
                  : `Will send to ${recipientCount} subscriber${recipientCount === 1 ? '' : 's'}.`}
          </p>
          <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
            Send broadcast
          </Button>
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
