import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Inbox, Mail, Search, Send, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AdvisorySection } from '@/components/dashboard/assistant/AdvisorySection';
import { EmailDraftingPanel } from '@/components/dashboard/assistant/EmailDraftingPanel';
import { EmailStatusBadge } from '@/components/dashboard/email/EmailStatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { listEmailMessages } from '@/services/emailService';
import { downloadCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/format';
import { templateLabel } from '@/lib/emailTemplates';
import { routes } from '@/lib/routes';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { cn } from '@/lib/utils';
import type { EmailMessage } from '@/types';

type Lane = 'all' | EmailMessage['status'];

const LANES: { key: Lane; label: string; icon: typeof Inbox }[] = [
  { key: 'all', label: 'All mail', icon: Mail },
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'queued', label: 'Queued', icon: Inbox },
  { key: 'failed', label: 'Failed', icon: XCircle },
];

/**
 * The real outbox (`docs/design/email.png`, restyled to what this system
 * actually is). `email_messages` is a one-way transactional log — the
 * Inngest worker sends confirmations, reminders and receipts; nobody
 * composes, replies to, or receives mail inside the dashboard. So this is a
 * mail-client-shaped *list and detail view* over that log, not a client:
 * no Compose, no folders that don't exist (Drafts, Trash), no reply/forward.
 */
export function EmailPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [messages, setMessages] = useState<EmailMessage[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    const c: Record<Lane, number> = { all: 0, queued: 0, sending: 0, sent: 0, failed: 0, bounced: 0 };
    for (const m of messages ?? []) {
      c.all += 1;
      c[m.status] += 1;
    }
    return c;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (messages ?? []).filter((m) => {
      if (lane !== 'all' && m.status !== lane) return false;
      if (!q) return true;
      return (
        m.subject.toLowerCase().includes(q) ||
        m.to_email.toLowerCase().includes(q) ||
        templateLabel(m.template).toLowerCase().includes(q)
      );
    });
  }, [messages, lane, search]);

  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0] ?? null;

  const exportCsv = (): void => {
    const header = ['To', 'Subject', 'Template', 'Status', 'Created', 'Sent', 'Attempts', 'Last error'];
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
    downloadCsv(`email-outbox-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
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
      subtitle="Every message the salon's outbox has sent — confirmations, reminders and receipts."
      actions={
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Export
        </Button>
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
                  lane === l.key ? 'bg-tint-brand text-primary' : 'text-foreground hover:bg-muted',
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
                        <span className="truncate text-sm font-medium text-foreground">{m.to_email}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(m.sent_at ?? m.created_at, timezone)}
                        </span>
                      </div>
                      <p className="truncate text-sm text-foreground">{m.subject}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <EmailStatusBadge status={m.status} />
                        <span className="truncate text-xs text-muted-foreground">{templateLabel(m.template)}</span>
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
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  )}
                  <EmailStatusBadge status={selected.status} />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Template</dt>
                <dd className="text-foreground">{templateLabel(selected.template)}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground">{formatDateTime(selected.created_at, timezone)}</dd>
                {selected.scheduled_for && (
                  <>
                    <dt className="text-muted-foreground">Scheduled for</dt>
                    <dd className="text-foreground">{formatDateTime(selected.scheduled_for, timezone)}</dd>
                  </>
                )}
                {selected.sent_at && (
                  <>
                    <dt className="text-muted-foreground">Sent</dt>
                    <dd className="text-foreground">{formatDateTime(selected.sent_at, timezone)}</dd>
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

              {selected.payload && Object.keys(selected.payload as object).length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Message data
                  </p>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(selected.payload as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== undefined && v !== '')
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3">
                          <dt className="shrink-0 text-muted-foreground">{key.replace(/_/g, ' ')}</dt>
                          <dd className="truncate text-right text-foreground">{String(value)}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">Select an email to see its details.</p>
            </Card>
          )}
        </div>
      )}

      <AdvisorySection title="Email drafting" description="AI-drafted copy for a one-off message to a customer.">
        <EmailDraftingPanel timezone={timezone} />
      </AdvisorySection>
    </DashboardLayout>
  );
}
