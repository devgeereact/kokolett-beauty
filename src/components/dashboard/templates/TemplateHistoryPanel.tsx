import { type JSX, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/States';
import { listTemplateRevisions, updateEmailTemplate } from '@/services/emailService';
import { useToast } from '@/context/ToastContext';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { EmailTemplateRevision, EmailTemplateRow } from '@/types';

function stripHtml(html: string): string {
  return (
    new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  ).trim();
}

/**
 * "Editing overwrites in place, no rollback to a prior version" (KOKO_GAP.md
 * P2). `email_template_revisions` (migration 0061) is written automatically
 * by a trigger whenever a template's `subject`/`html_body` actually changes
 * — this panel is purely a reader of that log, plus one write: reverting is
 * just another `updateEmailTemplate()` call with an earlier revision's
 * content, so the trigger logs the pre-revert state as a new revision too.
 */
export function TemplateHistoryPanel({
  templateKey,
  currentSubject,
  currentBodyHtml,
  onReverted,
  refreshToken,
}: {
  templateKey: string;
  /** Bump this after a save elsewhere on the page — the panel has no other way to learn one happened. */
  refreshToken?: number;
  currentSubject: string;
  currentBodyHtml: string;
  onReverted: (updated: EmailTemplateRow) => void;
}): JSX.Element {
  const { showToast } = useToast();
  const [revisions, setRevisions] = useState<EmailTemplateRevision[] | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [revertId, setRevertId] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);

  const load = (): void => {
    listTemplateRevisions(templateKey)
      .then(setRevisions)
      .catch(() => setRevisions([]));
  };

  useEffect(load, [templateKey, refreshToken]);

  const compareRevision = revisions?.find((r) => r.id === compareId) ?? null;

  const doRevert = async (revision: EmailTemplateRevision): Promise<void> => {
    setReverting(true);
    try {
      const updated = await updateEmailTemplate(templateKey, {
        subject: revision.subject,
        html_body: revision.html_body,
      });
      onReverted(updated);
      showToast({ message: 'Reverted to that version.' });
      setRevertId(null);
      setCompareId(null);
      load();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setReverting(false);
    }
  };

  return (
    <Card className="h-fit p-5">
      <h2 className="mb-3 font-serif text-base font-semibold text-foreground">History</h2>

      {revisions === null && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}

      {revisions !== null && revisions.length === 0 && (
        <EmptyState
          title="No earlier versions"
          description="Every edit to the subject or body is logged here from now on."
        />
      )}

      {revisions !== null && revisions.length > 0 && (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {revisions.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{r.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => setCompareId(r.id)}>
                  Compare
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRevertId(r.id)}>
                  Revert
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={compareRevision !== null}
        onClose={() => setCompareId(null)}
        ariaLabel="Compare template versions"
        className="max-w-modal-lg"
      >
        {compareRevision && (
          <div className="p-5">
            <h3 className="mb-1 font-serif text-lg font-semibold text-foreground">
              Compare versions
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              {formatDateTime(compareRevision.created_at)} vs current
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  That version
                </p>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {compareRevision.subject}
                </p>
                <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {stripHtml(compareRevision.html_body)}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Current
                </p>
                <p className="mb-2 text-sm font-medium text-foreground">
                  {currentSubject}
                </p>
                <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {stripHtml(currentBodyHtml)}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCompareId(null)}>
                Close
              </Button>
              <Button size="sm" onClick={() => setRevertId(compareRevision.id)}>
                Revert to that version
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revertId !== null}
        title="Revert to this version?"
        message="The subject and body go back to what they were at that point. Your current version isn't lost. It is logged here too, so you can revert again if you change your mind."
        confirmLabel={reverting ? 'Reverting…' : 'Revert'}
        cancelLabel="Cancel"
        onConfirm={() => {
          const revision = revisions?.find((r) => r.id === revertId);
          if (revision) void doRevert(revision);
        }}
        onCancel={() => setRevertId(null)}
      />
    </Card>
  );
}
