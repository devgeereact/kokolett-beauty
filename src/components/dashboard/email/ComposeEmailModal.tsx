import { type JSX, useEffect, useState } from 'react';
import { ComposeContentStep } from '@/components/dashboard/email/ComposeContentStep';
import { ComposeTemplateStep } from '@/components/dashboard/email/ComposeTemplateStep';
import { Modal } from '@/components/ui/Modal';
import {
  getEmailTemplate,
  getTemplateUsage,
  previewEmailMessage,
  sendCustomEmailAsOwner,
  type TemplateUsage,
} from '@/services/emailService';
import { templateMeta } from '@/lib/templateCatalog';
import { errorMessage } from '@/lib/errors';
import type { Customer } from '@/types';

type Step = 'template' | 'compose';

/** Plain-text reading of an HTML fragment — used only to turn a template's
 * raw `html_body` into something editable in a plain-text compose field,
 * the same DOMParser approach `TemplateEditorPage` already uses to count
 * characters (never re-rendered as HTML, so there's nothing to sanitise
 * beyond what `textContent` already strips). */
function htmlToText(html: string): string {
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').trim();
}

/**
 * The real Compose workflow: pick a starting template (or blank), edit the
 * subject and body, choose a recipient, send. One integrated flow inside a
 * single modal rather than a separate page — closing or finishing always
 * returns to the same Communications › Email screen.
 *
 * Sending goes through `sendCustomEmailAsOwner` exactly as the AI
 * assistant's own confirm step does (`AssistantChatTab.confirmProposal`) —
 * the only write path this app has for a one-off customer email. It still
 * only enqueues into `email_messages`; nothing sends until the drain job
 * picks the row up.
 */
export function ComposeEmailModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful send so the caller can refresh its list. */
  onSent: () => void;
}): JSX.Element {
  const [step, setStep] = useState<Step>('template');
  const [usage, setUsage] = useState<Map<string, TemplateUsage> | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipient, setRecipient] = useState<Customer | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const reset = (): void => {
    setStep('template');
    setContentLoading(false);
    setContentError(null);
    setSubject('');
    setBody('');
    setRecipient(null);
    setSending(false);
    setSendError(null);
  };

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setUsage(null);
    setUsageError(null);
    getTemplateUsage()
      .then(setUsage)
      .catch((e: unknown) => setUsageError(errorMessage(e)));
  }, [open]);

  /**
   * Loads a starting subject/body for the chosen template, in order of how
   * real the content is: a genuine past send (rendered via the same
   * `render-email-preview` function the Email detail pane uses, so tokens
   * are already substituted), then the owner's saved template row (tokens
   * still literal — the owner edits them out), then just the template's
   * name as a bare subject to write from scratch.
   */
  const loadTemplateContent = async (key: string): Promise<void> => {
    const meta = templateMeta(key);
    const example = usage?.get(key)?.example;

    if (example) {
      try {
        const preview = await previewEmailMessage(example.id);
        if (preview.available) {
          setSubject(preview.subject ?? meta?.label ?? '');
          setBody((preview.text ?? '').trim());
          setContentError(null);
          return;
        }
      } catch (e) {
        setContentError(
          `Couldn't load a past example of this template — starting from its saved wording instead. ${errorMessage(e)}`,
        );
      }
    }

    try {
      const row = await getEmailTemplate(key);
      if (row) {
        setSubject(row.subject);
        setBody(htmlToText(row.html_body));
        return;
      }
    } catch (e) {
      setContentError(errorMessage(e));
    }

    setSubject(meta?.label ?? '');
    setBody('');
  };

  const selectTemplate = (key: string | null): void => {
    setContentError(null);
    setStep('compose');
    if (key === null) {
      setSubject('');
      setBody('');
      return;
    }
    setContentLoading(true);
    void loadTemplateContent(key).finally(() => setContentLoading(false));
  };

  const send = async (): Promise<void> => {
    if (!recipient) return;
    setSending(true);
    setSendError(null);
    try {
      await sendCustomEmailAsOwner(recipient.email, recipient.full_name, subject, body);
      onSent();
      onClose();
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Compose email" className="max-w-modal-lg">
      <div className="rounded-xl border border-border bg-popover p-5 text-popover-foreground">
        {step === 'template' ? (
          <ComposeTemplateStep
            usage={usage}
            usageError={usageError}
            onSelect={selectTemplate}
            onClose={onClose}
          />
        ) : (
          <ComposeContentStep
            contentLoading={contentLoading}
            contentError={contentError}
            recipient={recipient}
            onRecipientChange={setRecipient}
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
            sending={sending}
            sendError={sendError}
            onSend={() => void send()}
            onBack={() => setStep('template')}
            onClose={onClose}
          />
        )}
      </div>
    </Modal>
  );
}
