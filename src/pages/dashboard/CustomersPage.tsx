import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AdvisorySection } from '@/components/dashboard/assistant/AdvisorySection';
import { CommunicationAssistancePanel } from '@/components/dashboard/assistant/CommunicationAssistancePanel';
import { RepeatCustomerInsightsPanel } from '@/components/dashboard/assistant/RepeatCustomerInsightsPanel';
import { CancellationForecastingPanel } from '@/components/dashboard/assistant/CancellationForecastingPanel';
import { CustomerTable } from '@/components/dashboard/customers/CustomerTable';
import { CustomerDetailPanel } from '@/components/dashboard/customers/CustomerDetailPanel';
import { NewBookingPanel } from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  getCustomer,
  listCustomersWithStats,
  setCustomerNote,
  softDeleteCustomer,
  updateCustomerDetails,
  type CustomerContactDraft,
  type CustomerWithStats,
} from '@/services/customerService';
import { listForCustomer } from '@/services/appointmentService';
import { downloadCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import type { AppointmentDetailed } from '@/types';

type StatusFilter = 'all' | 'active' | 'inactive' | 'new';

function isInactive(customer: CustomerWithStats): boolean {
  if (!customer.last_visit_at) return false;
  return Date.now() - new Date(customer.last_visit_at).getTime() > 180 * 24 * 60 * 60 * 1000;
}

function isNewCustomer(customer: CustomerWithStats): boolean {
  if (customer.completed_count > 1) return false;
  const ageMs = Date.now() - new Date(customer.first_seen_at ?? customer.created_at).getTime();
  return ageMs < 14 * 24 * 60 * 60 * 1000;
}

/** The customer book. Owner-only — RLS gives anon nothing from this table. */
export function CustomersPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selected, setSelected] = useState<CustomerWithStats | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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
  const [pendingErase, setPendingErase] = useState<CustomerWithStats | null>(null);

  const load = useCallback(async (term: string): Promise<void> => {
    setLoading(true);
    try {
      setCustomers(await listCustomersWithStats(term));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return customers;
    if (statusFilter === 'new') return customers.filter(isNewCustomer);
    if (statusFilter === 'inactive') return customers.filter(isInactive);
    return customers.filter((c) => !isInactive(c));
  }, [customers, statusFilter]);

  const open = async (customer: CustomerWithStats): Promise<void> => {
    setSelected(customer);
    setDetailOpen(true);
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

  useEffect(() => {
    const customerId = new URLSearchParams(location.search).get('customer');
    if (!customerId) return;
    getCustomer(customerId)
      .then((customer) => {
        if (customer) void open({ ...customer, completed_count: 0, upcoming_count: 0, no_show_count: 0, last_visit_at: null, favourite_services: [] });
      })
      .catch((e: unknown) => showToast({ message: errorMessage(e) }));
    void navigate(routes.owner.customers, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEditingContact = (customer: CustomerWithStats): void => {
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
      showToast({ message: 'Note saved.' });
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setSavingNote(false);
    }
  };

  const erase = async (customer: CustomerWithStats): Promise<void> => {
    try {
      await softDeleteCustomer(customer.id);
      setSelected(null);
      setDetailOpen(false);
      await load(search);
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  const exportCsv = (): void => {
    const header = ['Name', 'Email', 'Mobile', 'Total visits', 'Last visit', 'Status', 'Marketing consent'];
    const rows = filtered.map((c) => [
      c.full_name,
      c.email,
      c.mobile ?? '',
      String(c.completed_count),
      c.last_visit_at ?? '',
      isInactive(c) ? 'Inactive' : 'Active',
      c.marketing_consent ? 'Yes' : 'No',
    ]);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`customers-${today}.csv`, [header, ...rows]);
  };

  return (
    <DashboardLayout title="Customers" subtitle="View your clients, their history and preferences.">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Loading…' : `${filtered.length} customer${filtered.length === 1 ? '' : 's'}`}
        </p>
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Export
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers, email, phone…"
            className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-11 rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All customers</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="new">New</option>
        </select>
      </div>

      {loading && <LoadingState label="Loading customers…" />}
      {error && <ErrorState error={error} onRetry={() => void load(search)} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={search ? 'No one matches that' : 'No customers yet'}
          description={
            search
              ? 'Try a different name, email or number.'
              : 'Customers are created automatically the first time someone books.'
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <CustomerTable
          customers={filtered}
          selectedId={selected?.id ?? null}
          onSelect={(c) => void open(c)}
          timezone={timezone}
        />
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        ariaLabel="Customer details"
        className="max-w-3xl"
      >
        {selected && (
          <CustomerDetailPanel
            customer={selected}
            history={history}
            timezone={timezone}
            note={note}
            onNoteChange={setNote}
            savingNote={savingNote}
            onSaveNote={() => void saveNote()}
            editingContact={editingContact}
            contactDraft={contactDraft}
            onContactDraftChange={setContactDraft}
            contactError={contactError}
            savingContact={savingContact}
            onStartEdit={() => startEditingContact(selected)}
            onSaveContact={() => void saveContact()}
            onCancelEdit={() => {
              setEditingContact(false);
              setContactError(null);
            }}
            onClose={() => setDetailOpen(false)}
            onBookFollowUp={() => {
              setDetailOpen(false);
              setBooking(true);
            }}
            onErase={() => setPendingErase(selected)}
            onConsentChange={(consent) =>
              setCustomers((prev) => prev.map((c) => (c.id === selected.id ? { ...c, marketing_consent: consent } : c)))
            }
          />
        )}
      </Modal>

      <Modal open={booking} onClose={() => setBooking(false)} ariaLabel="New booking">
        {selected && (
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
        )}
      </Modal>

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

      <AdvisorySection title="Customer messages" description="AI-assisted replies for a customer's message.">
        <CommunicationAssistancePanel timezone={timezone} />
      </AdvisorySection>
      <AdvisorySection title="Repeat customers" description="Who books again and again, and who's gone quiet.">
        <RepeatCustomerInsightsPanel timezone={timezone} />
      </AdvisorySection>
      <AdvisorySection title="Cancellation risk" description="Bookings more likely than usual to no-show or cancel.">
        <CancellationForecastingPanel timezone={timezone} />
      </AdvisorySection>
    </DashboardLayout>
  );
}
