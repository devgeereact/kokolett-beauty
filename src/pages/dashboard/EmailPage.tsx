import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Download,
  Inbox,
  Mail,
  PenSquare,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ComposeEmailModal } from '@/components/dashboard/email/ComposeEmailModal';
import { EmailStatusBadge } from '@/components/dashboard/email/EmailStatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import {
  deleteEmailMessage,
  listEmailMessages,
  previewEmailMessage,
  type EmailPreview,
} from '@/services/emailService';
import { downloadCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { templateLabel } from '@/lib/templateCatalog';
import { routes } from '@/lib/routes';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/utils';
import type { EmailMessage } from '@/types';

type Lane = 'inbox' | 'all' | EmailMessage['status'];

const LANES: { key: Lane; label: string; icon: typeof Inbox }[] = [
  { key: 'inbox', label: 'To me', icon: Inbox },
  { key: 'all', label: 'All mail', icon: Mail },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'queued', label: 'Queued', icon: Clock },
  { key: 'failed', label: 'Failed', icon: XCircle },
];

/**
 * Templates that notify the owner herself, as opposed to going out to a
 * customer or the mailing list — the closest thing this one-way outbox log
 * has to a real inbox. Labelled "To me" rather than "Inbox" (2026-08-31):
 * every row here still carries its own delivery-status badge (Sent/Queued/
 * Failed), and a "Sent" badge sitting inside a lane literally called "Inbox"
 * read as a contradiction, even though the underlying filter — "addressed to
 * the owner", independent of whether it has shipped yet — was always
 * correct. Not in `templateCatalog.ts`'s `TEMPLATE_CATALOG`: two of
 * these (`contact_message_received`, `secret_login_under_attack`) have no
 * matching `email_templates` row, and that catalog assumes every entry does
 * (TemplatesPage links straight to an editor keyed on that assumption).
 */
const OWNER_FACING_TEMPLATES = new Set([
  'owner_approval_needed',
  'owner_cancelled',
  'owner_booking_moved',
  'owner_new_booking',
  'owner_new_request',
  'contact_message_received',
  'secret_login_under_attack',
]);

/**
 * The real outbox (`docs/design/email.png`, restyled to what this system
 * actually is). `email_messages` is a one-way transactional log the
 * `send-emails` drain job works through — confirmations, reminders,
 * receipts, and now one-off messages the owner writes herself via Compose.
 * So this is mostly a *list and detail view* over that log (no folders that
 * don't exist, like Drafts or Trash; no reply/forward) plus the one write
 * this app allows: `sendCustomEmailAsOwner`, wired through `ComposeEmailModal`.
 */
export function EmailPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<EmailMessage[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('inbox');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EmailMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback((): void => {
    setError(null);
    listEmailMessages()
      .then((rows) => {
        setMessages(rows);
        setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const c: Record<Lane, number> = {
      inbox: 0,
      all: 0,
      queued: 0,
      sending: 0,
      sent: 0,
      cancelled: 0,
      failed: 0,
      bounced: 0,
    };
    for (const m of messages ?? []) {
      c.all += 1;
      c[m.status] += 1;
      if (OWNER_FACING_TEMPLATES.has(m.template)) c.inbox += 1;
    }
    return c;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (messages ?? []).filter((m) => {
      if (lane === 'inbox') {
        if (!OWNER_FACING_TEMPLATES.has(m.template)) return false;
      } else if (lane !== 'all' && m.status !== lane) {
        return false;
      }
      if (!q) return true;
      return (
        m.subject.toLowerCase().includes(q) ||
        m.to_email.toLowerCase().includes(q) ||
        templateLabel(m.template).toLowerCase().includes(q)
      );
    });
  }, [messages, lane, search]);

  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    previewEmailMessage(selected.id)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the selected message changes, not on every re-render `selected` is recomputed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const confirmDelete = (): void => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeleting(true);
    deleteEmailMessage(target.id)
      .then(() => {
        setMessages((prev) => (prev ?? []).filter((m) => m.id !== target.id));
        setSelectedId((prev) => (prev === target.id ? null : prev));
        setPendingDelete(null);
        showToast({ message: 'Email deleted.' });
      })
      .catch((e: unknown) => showToast({ message: errorMessage(e) }))
      .finally(() => setDeleting(false));
  };

  const exportCsv = (): void => {
    const header = [
      'To',
      'Subject',
      'Template',
      'Status',
      'Created',
      'Sent',
      'Attempts',
      'Last error',
    ];
    const rows = filtered.map((m) => [
      m.to_email,
      m.subject,
      templateLabel(m.template),
      m.status,
      formatDateTime(m.created_at, timezone),
      m.sent_at ? formatDateTime(m.sent_at, timezone) : '',
      String(m.attempts),
      m.last_error ?? '',
    ]);
    downloadCsv(`email-outbox-${new Date().toISOString().slice(0, 10)}.csv`, [
      header,
      ...rows,
    ]);
  };

  if (error) {
    return (
      <DashboardLayout title="Email">
        <ErrorState error={error} onRetry={load} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Email"
      subtitle="Every message the salon's outbox has sent: confirmations, reminders and receipts."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={exportCsv}>
            <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            Export
          </Button>
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <PenSquare aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            Compose
          </Button>
        </>
      }
    >
      {!messages ? (
        <LoadingState label="Loading the outbox…" />
      ) : messages.length === 0 ? (
        <EmptyState
          title="Nothing sent yet"
          description="Booking confirmations, reminders and receipts will appear here as they go out."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[12rem_20rem_1fr]">
          <div className="space-y-1">
            {LANES.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLane(l.key)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium',
                  lane === l.key
                    ? 'bg-tint-brand text-primary'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-2">
                  <l.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  {l.label}
                </span>
                <span className="text-xs text-muted-foreground">{counts[l.key]}</span>
              </button>
            ))}
          </div>

          <Card className="flex flex-col p-0">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search emails…"
                  className="h-10 w-full rounded-sm border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="max-h-[640px] flex-1 divide-y divide-border overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No emails match.</p>
              ) : (
                filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      'flex w-full items-start gap-3 p-3 text-left hover:bg-muted',
                      selected?.id === m.id && 'bg-tint-brand',
                    )}
                  >
                    <Avatar name={m.to_email} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {m.to_email}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(m.sent_at ?? m.created_at, timezone)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-foreground">{m.subject}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <EmailStatusBadge status={m.status} />
                        <span className="truncate text-xs text-muted-foreground">
                          {templateLabel(m.template)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {selected ? (
            <Card className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="min-w-0">
                  <h2 className="mb-1 truncate font-serif text-lg font-semibold text-foreground">
                    {selected.subject}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    To <span className="text-foreground">{selected.to_email}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {selected.customer_id && (
                    <Link
                      to={`${routes.owner.customers}?customer=${selected.customer_id}`}
                      className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      View customer
                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        strokeWidth={2}
                      />
                    </Link>
                  )}
                  <EmailStatusBadge status={selected.status} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingDelete(selected)}
                    aria-label="Delete this email"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                    Delete
                  </Button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Template</dt>
                <dd className="text-foreground">{templateLabel(selected.template)}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">
                  {formatDateTime(selected.created_at, timezone)}
                </dd>
                {selected.scheduled_for && (
                  <>
                    <dt className="text-muted-foreground">Scheduled for</dt>
                    <dd className="text-foreground">
                      {formatDateTime(selected.scheduled_for, timezone)}
                    </dd>
                  </>
                )}
                {selected.sent_at && (
                  <>
                    <dt className="text-muted-foreground">Sent</dt>
                    <dd className="text-foreground">
                      {formatDateTime(selected.sent_at, timezone)}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Attempts</dt>
                <dd className="text-foreground">{selected.attempts}</dd>
              </dl>

              {selected.last_error && (
                <div className="mt-4 rounded-lg bg-tint-no-show p-3 text-sm text-status-no-show">
                  <p className="font-medium">Last error</p>
                  <p className="mt-0.5">{selected.last_error}</p>
                </div>
              )}

              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Message
                </p>
                {previewLoading ? (
                  <p className="text-sm text-muted-foreground">Rendering…</p>
                ) : previewError ? (
                  <p className="text-sm text-status-no-show">{previewError}</p>
                ) : preview && preview.available ? (
                  <iframe
                    title="Email preview"
                    srcDoc={preview.html}
                    sandbox=""
                    className="h-[480px] w-full rounded-lg border border-border bg-card"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {preview?.reason ??
                      'This message was sent before the outbox started keeping its contents, so there is nothing left to render.'}
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">
                Select an email to see its details.
              </p>
            </Card>
          )}
        </div>
      )}

      <ComposeEmailModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={load}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this email?"
        message={
          pendingDelete
            ? `This removes the record of "${pendingDelete.subject}" to ${pendingDelete.to_email} from the outbox. It does not unsend a message that already reached them. This only deletes the log entry. There is no undo.`
            : ''
        }
        tone="destructive"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </DashboardLayout>
  );
}
