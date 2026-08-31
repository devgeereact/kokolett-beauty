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

  useEffect(() => {
    listSubscribers()
      .then((rows) => setRecipientCount(rows.filter((r) => r.confirmed).length))
      .catch(() => setRecipientCount(null));
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

  const canSend =
    !sending && recipientCount !== null && subject.trim() !== '' && body.trim() !== '';

  return (
    <DashboardLayout
      title="Broadcasts"
      subtitle="A newsletter or ad to your mailing list, drafted with AI, reviewed by you, sent to no one else."
    >
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
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

        <Card className="p-5">
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
            {recipientCount === null
              ? 'Loading recipient count…'
              : `Will send to ${recipientCount} subscriber(s).`}
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
