import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  listCustomers,
  setCustomerNote,
  softDeleteCustomer,
} from '@/services/customerService';
import { listForCustomer } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney } from '@/lib/format';
import { StatusChip } from '@/components/ui/StatusChip';
import type { AppointmentDetailed, Customer } from '@/types';

/** The customer book. Owner-only — RLS gives anon nothing from this table. */
export function CustomersPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<AppointmentDetailed[]>([]);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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
    try {
      setHistory(await listForCustomer(customer.id));
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  const saveNote = async (): Promise<void> => {
    if (!selected) return;
    setSavingNote(true);
    try {
      await setCustomerNote(selected.id, note);
      await load(search);
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setSavingNote(false);
    }
  };

  const erase = async (customer: Customer): Promise<void> => {
    if (
      !window.confirm(
        `Erase ${customer.full_name}'s personal details?\n\nThis is the UK GDPR deletion path. Their appointment history stays for your records, but their contact details and notes are removed and they will arrive as a new customer if they book again.`,
      )
    ) {
      return;
    }
    try {
      await softDeleteCustomer(customer.id);
      setSelected(null);
      await load(search);
    } catch (e) {
      window.alert(errorMessage(e));
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => void open(customer)}
              className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected?.id === customer.id
                  ? 'border-primary bg-card'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <p className="font-medium text-foreground">{customer.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {customer.email}
                {customer.mobile ? ` · ${customer.mobile}` : ''}
              </p>
              {customer.marketing_consent && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Consented to marketing
                </p>
              )}
            </button>
          ))}
        </div>

        {selected && (
          <Card className="h-fit p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {selected.full_name}
                </h2>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

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
            <Button size="sm" loading={savingNote} onClick={() => void saveNote()}>
              Save note
            </Button>

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
              <Button variant="ghost" size="sm" onClick={() => void erase(selected)}>
                Erase personal details
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
