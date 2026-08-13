import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { NewBookingPanel } from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  listCustomers,
  setCustomerNote,
  softDeleteCustomer,
  updateCustomerDetails,
  type CustomerContactDraft,
} from '@/services/customerService';
import { listForCustomer } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney } from '@/lib/format';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, Customer } from '@/types';

/** The customer book. Owner-only — RLS gives anon nothing from this table. */
export function CustomersPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<AppointmentDetailed[]>([]);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [booking, setBooking] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState<CustomerContactDraft>({
    fullName: '',
    email: '',
    mobile: '',
  });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [pendingErase, setPendingErase] = useState<Customer | null>(null);

  const load = useCallback(async (term: string): Promise<void> => {
    setLoading(true);
    try {
      setCustomers(await listCustomers(term));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounced so typing a name is not one request per keystroke.
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  const open = async (customer: Customer): Promise<void> => {
    setSelected(customer);
    setNote(customer.notes ?? '');
    setBooking(false);
    setEditingContact(false);
    setContactError(null);
    try {
      setHistory(await listForCustomer(customer.id));
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  const startEditingContact = (customer: Customer): void => {
    setContactDraft({
      fullName: customer.full_name,
      email: customer.email,
      mobile: customer.mobile ?? '',
    });
    setContactError(null);
    setEditingContact(true);
  };

  const saveContact = async (): Promise<void> => {
    if (!selected) return;
    const nameParts = contactDraft.fullName.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      setContactError('Give a full name, first name and surname.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactDraft.email.trim())) {
      setContactError('Give a valid email address.');
      return;
    }

    setSavingContact(true);
    setContactError(null);
    try {
      await updateCustomerDetails(selected.id, contactDraft);
      setEditingContact(false);
      await load(search);
      await open({
        ...selected,
        full_name: contactDraft.fullName.trim(),
        email: contactDraft.email.trim(),
        mobile: contactDraft.mobile.trim() || null,
      });
    } catch (e) {
      setContactError(errorMessage(e));
    } finally {
      setSavingContact(false);
    }
  };

  const saveNote = async (): Promise<void> => {
    if (!selected) return;
    setSavingNote(true);
    try {
      await setCustomerNote(selected.id, note);
      await load(search);
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setSavingNote(false);
    }
  };

  const erase = async (customer: Customer): Promise<void> => {
    try {
      await softDeleteCustomer(customer.id);
      setSelected(null);
      await load(search);
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  return (
    <DashboardLayout title="Customers" subtitle="Everyone who has booked with you">
      <div className="mb-6 max-w-md">
        <Field label="Search" hint="Name, email or mobile.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Start typing…"
            />
          )}
        </Field>
      </div>

      {loading && <LoadingState label="Loading customers…" />}
      {error && <ErrorState error={error} onRetry={() => void load(search)} />}

      {!loading && !error && customers.length === 0 && (
        <EmptyState
          title={search ? 'No one matches that' : 'No customers yet'}
          description={
            search
              ? 'Try a different name, email or number.'
              : 'Customers are created automatically the first time someone books.'
          }
        />
      )}

      <div className={cn('grid gap-6', selected && 'lg:grid-cols-2')}>
        <div
          className={cn(
            // With nothing selected there's no second column, so let the
            // list itself tile across the freed-up width instead of
            // sitting in a single narrow stack — the dashboard is meant to
            // be dense and scannable (docs/DESIGN.md), not leave most of
            // the screen empty while an owner scrolls a long customer list.
            selected ? 'space-y-2' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3',
          )}
        >
          {customers.map((customer) => (
            <div
              key={customer.id}
              role="button"
              tabIndex={0}
              onClick={() => void open(customer)}
              onKeyDown={(e) => {
                // Mirrors a native <button>'s activation keys. A real
                // <button> can't be used here — it would wrap the mailto/tel
                // links below, and a button's content model forbids
                // interactive-content descendants.
                //
                // Guarded to the row itself, not bubbled children: this
                // handler also receives keydowns that bubble up from the
                // nested mailto:/tel: links below. Without the guard,
                // pressing Enter on a focused link would preventDefault()
                // here and open the customer instead of letting the link
                // activate — breaking keyboard access to the very links
                // this row renders.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void open(customer);
                }
              }}
              className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected?.id === customer.id
                  ? 'border-primary bg-card'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <p className="font-medium text-foreground">{customer.full_name}</p>
              <p className="text-sm text-muted-foreground">
                <a
                  href={`mailto:${customer.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground hover:underline hover:underline-offset-4"
                >
                  {customer.email}
                </a>
                {customer.mobile ? (
                  <>
                    {' · '}
                    <a
                      href={`tel:${customer.mobile.replace(/\s/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-foreground hover:underline hover:underline-offset-4"
                    >
                      {customer.mobile}
                    </a>
                  </>
                ) : (
                  ''
                )}
              </p>
              {customer.marketing_consent && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Consented to marketing
                </p>
              )}
            </div>
          ))}
        </div>

        {selected && (
          <Card className="h-fit p-5">
            {editingContact ? (
              <div className="mb-4 border-b border-border pb-4">
                <Field label="Full name">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={contactDraft.fullName}
                      onChange={(e) =>
                        setContactDraft({ ...contactDraft, fullName: e.target.value })
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
                        setContactDraft({ ...contactDraft, email: e.target.value })
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
                        setContactDraft({ ...contactDraft, mobile: e.target.value })
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
                  <Button
                    size="sm"
                    loading={savingContact}
                    onClick={() => void saveContact()}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingContact(false);
                      setContactError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    {selected.full_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    <a
                      href={`mailto:${selected.email}`}
                      className="hover:text-foreground hover:underline hover:underline-offset-4"
                    >
                      {selected.email}
                    </a>
                    {selected.mobile ? (
                      <>
                        {' · '}
                        <a
                          href={`tel:${selected.mobile.replace(/\s/g, '')}`}
                          className="hover:text-foreground hover:underline hover:underline-offset-4"
                        >
                          {selected.mobile}
                        </a>
                      </>
                    ) : (
                      ''
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditingContact(selected)}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {booking && (
              <div className="mb-4">
                <NewBookingPanel
                  prefill={{
                    fullName: selected.full_name,
                    email: selected.email,
                    mobile: selected.mobile ?? '',
                  }}
                  onClose={() => setBooking(false)}
                  onBooked={() => {
                    setBooking(false);
                    void open(selected);
                  }}
                />
              </div>
            )}

            <Field
              label="Private note"
              hint="Only you see this. Never shown to the customer."
            >
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Prefers a quiet appointment. Allergic to ammonia."
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={savingNote} onClick={() => void saveNote()}>
                Save note
              </Button>
              {!booking && (
                <Button size="sm" variant="ghost" onClick={() => setBooking(true)}>
                  Book follow-up
                </Button>
              )}
            </div>

            <h3 className="mb-2 mt-6 font-display text-base font-semibold text-foreground">
              History
            </h3>
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

            <div className="mt-6 border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => setPendingErase(selected)}>
                Erase personal details
              </Button>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={pendingErase !== null}
        title="Erase personal details?"
        message={
          pendingErase
            ? `This is the UK GDPR deletion path for ${pendingErase.full_name}. Their appointment history stays for your records, but their contact details and notes are removed and they will arrive as a new customer if they book again.`
            : ''
        }
        tone="destructive"
        confirmLabel="Erase details"
        onConfirm={() => {
          if (!pendingErase) return;
          const customer = pendingErase;
          setPendingErase(null);
          void erase(customer);
        }}
        onCancel={() => setPendingErase(null)}
      />
    </DashboardLayout>
  );
}
