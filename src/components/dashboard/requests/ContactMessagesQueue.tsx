import { type JSX, useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import {
  listContactMessages,
  setContactMessageStatus,
  type ContactMessage,
} from '@/services/contactService';
import { useToast } from '@/context/ToastContext';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';

/**
 * The owner's side of the Contact page.
 *
 * There was none until migration `0080`. `submit_contact_message()` queued a
 * single email to the owner and stored nothing, so a bounced or failed send
 * lost the enquiry outright, clearing the Email page destroyed the history,
 * and on an installation with no `staff` row yet every message was discarded
 * while the sender was shown a thank-you. The table is the record now; this is
 * where it is read.
 *
 * Replying happens in a mail client, not here. The salon answers enquiries from
 * `booking@`, and building a second sending surface for free-text replies would
 * mean a second place for that conversation to live. `mailto:` opens the thread
 * where the rest of it already is.
 */
export function ContactMessagesQueue({
  onCountChange,
}: {
  onCountChange?: (unread: number) => void;
}): JSX.Element {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const messages = await listContactMessages(showArchived);
      setRows(messages);
      setError(null);
      onCountChange?.(messages.filter((m) => m.status === 'new').length);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [showArchived, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (
    id: string,
    status: ContactMessage['status'],
  ): Promise<void> => {
    setBusyId(id);
    try {
      await setContactMessageStatus(id, status);
      await load();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading messages…" />;
  if (error) return <ErrorState error={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Enquiries from the Contact page. Replies go from your own mail app, so the
          conversation stays in one place.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={showArchived ? 'No messages at all yet' : 'No messages waiting'}
          description="When somebody writes in from the Contact page, it appears here and you get an email about it."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-base font-semibold text-foreground">
                    {m.full_name}
                  </p>
                  {m.status === 'new' && <Badge tone="primary">New</Badge>}
                  {m.status === 'archived' && <Badge tone="cancelled">Archived</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(m.created_at)}
                </span>
              </div>

              {/* `whitespace-pre-wrap`: the sender's line breaks are part of
                  what they wrote, and collapsing them turns a list of
                  questions into one run-on sentence. */}
              <p className="whitespace-pre-wrap text-sm text-foreground">{m.message}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Kokolett Beauty')}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline"
                >
                  <Mail aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  Reply to {m.email}
                </a>
                {m.status === 'new' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === m.id}
                    onClick={() => void setStatus(m.id, 'read')}
                  >
                    Mark as read
                  </Button>
                )}
                {m.status !== 'archived' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === m.id}
                    onClick={() => void setStatus(m.id, 'archived')}
                  >
                    Archive
                  </Button>
                )}
                {m.status === 'archived' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === m.id}
                    onClick={() => void setStatus(m.id, 'read')}
                  >
                    Unarchive
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
