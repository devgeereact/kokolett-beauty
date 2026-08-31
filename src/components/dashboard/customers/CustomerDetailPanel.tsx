import { type JSX, useEffect, useState } from 'react';
import { Mail, MoreHorizontal, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CommunicationAssistancePanel } from '@/components/dashboard/assistant/CommunicationAssistancePanel';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { Switch } from '@/components/ui/Switch';
import { formatDateShort, formatDateTime, formatMoney } from '@/lib/format';
import {
  setCustomerMarketingConsent,
  type CustomerContactDraft,
  type CustomerWithStats,
} from '@/services/customerService';
import { listEmailsForCustomer } from '@/services/emailService';
import type { AppointmentDetailed, EmailMessage } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'history' | 'notes' | 'message' | 'email';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
  { key: 'notes', label: 'Notes' },
  { key: 'message', label: 'Message' },
  { key: 'email', label: 'Email history' },
];

/** A customer is "New" until their second visit or their fourteenth day, whichever is real, not fabricated. */
function isNew(customer: CustomerWithStats): boolean {
  if (customer.completed_count > 1) return false;
  const ageMs =
    Date.now() - new Date(customer.first_seen_at ?? customer.created_at).getTime();
  return ageMs < 14 * 24 * 60 * 60 * 1000;
}

/** Inactive once there has been at least one visit and none in the last 180 days. */
function isInactive(customer: CustomerWithStats): boolean {
  if (!customer.last_visit_at) return false;
  const idleMs = Date.now() - new Date(customer.last_visit_at).getTime();
  return idleMs > 180 * 24 * 60 * 60 * 1000;
}

export function CustomerDetailPanel({
  customer,
  history,
  timezone,
  note,
  onNoteChange,
  savingNote,
  onSaveNote,
  editingContact,
  contactDraft,
  onContactDraftChange,
  contactError,
  savingContact,
  onStartEdit,
  onSaveContact,
  onCancelEdit,
  onClose,
  onBookFollowUp,
  onExport,
  onRevokeSessions,
  onErase,
  onConsentChange,
}: {
  customer: CustomerWithStats;
  history: AppointmentDetailed[];
  timezone: string;
  note: string;
  onNoteChange: (value: string) => void;
  savingNote: boolean;
  onSaveNote: () => void;
  editingContact: boolean;
  contactDraft: CustomerContactDraft;
  onContactDraftChange: (draft: CustomerContactDraft) => void;
  contactError: string | null;
  savingContact: boolean;
  onStartEdit: () => void;
  onSaveContact: () => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onBookFollowUp: () => void;
  /** GDPR subject-access request — downloads everything held about this customer. */
  onExport: () => void;
  /** Signs the customer out of every active `/my` session immediately. */
  onRevokeSessions: () => void;
  /** UK GDPR erasure — anonymises in place, keeps appointment history. */
  /** Full erasure — the only deletion this app offers. */
  onErase: () => void;
  /** A genuine hard delete — the row and their appointments gone outright. */
  onConsentChange: (consent: boolean) => void;
}): JSX.Element {
  const [tab, setTab] = useState<Tab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [consent, setConsent] = useState(customer.marketing_consent);
  const [consentBusy, setConsentBusy] = useState(false);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailsLoaded, setEmailsLoaded] = useState(false);

  useEffect(() => {
    setTab('overview');
    setConsent(customer.marketing_consent);
    setEmailsLoaded(false);
    setEmails([]);
  }, [customer.id, customer.marketing_consent]);

  useEffect(() => {
    if (tab !== 'email' || emailsLoaded) return;
    listEmailsForCustomer(customer.id)
      .then((rows) => {
        setEmails(rows);
        setEmailsLoaded(true);
      })
      .catch(() => setEmailsLoaded(true));
  }, [tab, emailsLoaded, customer.id]);

  const toggleConsent = (next: boolean): void => {
    setConsent(next);
    setConsentBusy(true);
    setCustomerMarketingConsent(customer.id, next)
      .then(() => onConsentChange(next))
      .catch(() => setConsent(!next))
      .finally(() => setConsentBusy(false));
  };

  const upcoming = customer.upcoming_count > 0;
  const inactive = isInactive(customer);

  return (
    <Card className="flex h-fit flex-col gap-4 p-5">
      {editingContact ? (
        <div className="border-b border-border pb-4">
          <Field label="Full name">
            {({ id }) => (
              <Input
                id={id}
                value={contactDraft.fullName}
                onChange={(e) =>
                  onContactDraftChange({ ...contactDraft, fullName: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="Email">
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={contactDraft.email}
                onChange={(e) =>
                  onContactDraftChange({ ...contactDraft, email: e.target.value })
                }
              />
            )}
          </Field>
          <Field label="Mobile">
            {({ id }) => (
              <Input
                id={id}
                type="tel"
                value={contactDraft.mobile}
                onChange={(e) =>
                  onContactDraftChange({ ...contactDraft, mobile: e.target.value })
                }
              />
            )}
          </Field>
          {contactError && (
            <p role="alert" className="mb-3 text-sm font-medium text-destructive">
              {contactError}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" loading={savingContact} onClick={onSaveContact}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <Avatar name={customer.full_name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-serif text-base font-semibold text-foreground">
                  {customer.full_name}
                </p>
                <Badge tone={inactive ? 'neutral' : 'completed'}>
                  {inactive ? 'Inactive' : 'Active'}
                </Badge>
                {isNew(customer) && <Badge tone="primary">New</Badge>}
              </div>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Mail aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <a
                    href={`mailto:${customer.email}`}
                    className="truncate text-foreground hover:underline hover:underline-offset-4"
                  >
                    {customer.email}
                  </a>
                </p>
                {customer.mobile && (
                  <p className="flex items-center gap-2">
                    <Phone
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                    />
                    <a
                      href={`tel:${customer.mobile.replace(/\s/g, '')}`}
                      className="truncate text-foreground hover:underline hover:underline-offset-4"
                    >
                      {customer.mobile}
                    </a>
                  </p>
                )}
              </div>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="More options"
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-dropdown w-44 rounded-xl border border-border bg-popover p-1 shadow-popover">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onStartEdit();
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onExport();
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    Export data
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRevokeSessions();
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    Sign out everywhere
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onErase();
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                  >
                    Erase this customer
                  </button>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
              Close
            </Button>
          </div>

          {customer.first_seen_at && (
            <p className="text-xs text-muted-foreground">
              First visit: {formatDateShort(customer.first_seen_at, timezone)}
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm font-medium text-foreground">Marketing consent</span>
            <Switch
              checked={consent}
              onChange={toggleConsent}
              disabled={consentBusy}
              aria-label="Marketing consent"
            />
          </div>

          <div className="flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'border-b-2 px-3 py-2 text-sm font-medium',
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total visits', value: String(customer.completed_count) },
                  {
                    label: 'Last visit',
                    value: customer.last_visit_at
                      ? formatDateShort(customer.last_visit_at, timezone)
                      : '—',
                  },
                  { label: 'No-shows', value: String(customer.no_show_count) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border p-3">
                    <p className="font-serif text-xl font-semibold text-foreground">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              {customer.favourite_services.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Favourite services
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {customer.favourite_services.map((s) => (
                      <Badge key={s} tone="neutral">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Visit history
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('history')}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {history.slice(0, 3).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate text-foreground">
                          {formatDateShort(a.starts_at, timezone)} · {a.service_name}
                        </span>
                        <StatusChip status={a.status} className="shrink-0" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {note && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Private notes
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('notes')}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="rounded-md bg-tint-pending p-3 text-sm text-foreground">
                    {note}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
                    >
                      <span className="text-foreground">
                        {formatDateTime(a.starts_at, timezone)} · {a.service_name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {formatMoney(a.price_pence)}
                        </span>
                        <StatusChip status={a.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div>
              <Field
                label="Private note"
                hint="Only you see this. Never shown to the customer."
              >
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    value={note}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="Prefers a quiet appointment. Allergic to ammonia."
                  />
                )}
              </Field>
              <Button size="sm" loading={savingNote} onClick={onSaveNote}>
                Save note
              </Button>
            </div>
          )}

          {tab === 'message' && (
            <CommunicationAssistancePanel
              timezone={timezone}
              customerEmail={customer.email}
            />
          )}

          {tab === 'email' && (
            <div>
              {!emailsLoaded ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-muted-foreground">No emails sent yet.</p>
              ) : (
                <ul className="space-y-2">
                  {emails.map((e) => (
                    <li
                      key={e.id}
                      className="border-b border-border pb-2 text-sm last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">
                          {e.subject}
                        </span>
                        <Badge
                          tone={
                            e.status === 'sent'
                              ? 'completed'
                              : e.status === 'failed'
                                ? 'cancelled'
                                : 'pending'
                          }
                        >
                          {e.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {e.sent_at
                          ? formatDateTime(e.sent_at, timezone)
                          : formatDateTime(e.created_at, timezone)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => window.open(`mailto:${customer.email}`)}
            >
              <Mail aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              Email
            </Button>
            {customer.mobile && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => window.open(`sms:${customer.mobile?.replace(/\s/g, '')}`)}
              >
                <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                Message
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={onBookFollowUp}>
              {upcoming ? 'Book again' : 'New booking'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
