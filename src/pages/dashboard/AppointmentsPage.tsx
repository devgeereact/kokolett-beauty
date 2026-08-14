import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AppointmentEditModal } from '@/components/dashboard/AppointmentEditModal';
import {
  AppointmentsFilterPanel,
  type PaymentStatusFilter,
} from '@/components/dashboard/appointments/AppointmentsFilterPanel';
import {
  AppointmentsTable,
  type AppointmentTableGroup,
} from '@/components/dashboard/appointments/AppointmentsTable';
import { Pagination } from '@/components/ui/Pagination';
import {
  NewBookingPanel,
  type PrefilledCustomer,
} from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useAppointments } from '@/hooks/useAppointments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { getProfile } from '@/services/profileService';
import {
  deleteAppointmentAsOwner,
  setAppointmentStatus,
  setOwnerNote,
} from '@/services/appointmentService';
import { logPayment } from '@/services/paymentService';
import { listActiveServices } from '@/services/serviceCatalogService';
import { errorMessage } from '@/lib/errors';
import { downloadCsv } from '@/lib/csv';
import { formatMoney, formatTime, toSalonDate } from '@/lib/format';
import {
  computeDateRange,
  dateRangeLabel,
  stepDateMode,
  type DateMode,
} from '@/lib/appointmentsDateRange';
import { STATUS_CATEGORIES, STATUS_CATEGORY, STATUS_LABELS, type StatusCategory } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, AppointmentStatus, Service } from '@/types';

type Tab = 'all' | 'upcoming' | 'today' | 'in_service' | 'completed' | 'cancelled_no_show';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'in_service', label: 'In service' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled_no_show', label: 'Cancelled / No-show' },
];

const PAGE_SIZE = 10;

/**
 * Every booking in a window, as a real table (docs/design/appointment.png) —
 * grouped by day, filtered by status/service/payment/search, paginated.
 * "Staff" and "Location" pickers from the reference aren't here: Kokolett is
 * a single-owner, single-site salon, so a picker offering choices that don't
 * exist would be the same kind of fake control already dropped from the
 * Calendar screen's filters. The Staff *column* stays — showing who actually
 * did the work isn't fake just because the answer is always the same person.
 */
export function AppointmentsPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { user } = useSupabaseAuth();
  const { showToast } = useToast();
  const today = toSalonDate(new Date(), timezone);

  const [ownerName, setOwnerName] = useState('Owner');
  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => setOwnerName(p?.full_name ?? 'Owner'))
      .catch(() => setOwnerName('Owner'));
  }, [user]);

  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    listActiveServices()
      .then(setServices)
      .catch((e: unknown) => showToast({ message: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState<Tab>('all');
  const [dateMode, setDateMode] = useState<DateMode>('week');
  const [anchor, setAnchor] = useState(today);
  const [visibleCategories, setVisibleCategories] = useState<Set<StatusCategory>>(
    () => new Set(STATUS_CATEGORIES),
  );
  const [todayOnly, setTodayOnly] = useState(false);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [serviceId, setServiceId] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [booking, setBooking] = useState(false);
  const [prefill, setPrefill] = useState<PrefilledCustomer | null>(null);
  const [justBooked, setJustBooked] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AppointmentDetailed | null>(null);

  const { from, to } = useMemo(
    () => computeDateRange(dateMode, anchor, today, timezone),
    [dateMode, anchor, today, timezone],
  );

  // Every status is fetched — the tabs, the side panel's per-status counts,
  // and "Show cancelled/no-show" all need the full picture for this window,
  // not a server-side-narrowed slice. Everything below filters client-side.
  const { appointments, loading, error, refresh } = useAppointments({ from, to });

  useEffect(() => {
    setPage(1);
  }, [tab, dateMode, anchor, visibleCategories, serviceId, paymentStatus, search]);

  const applyTab = (next: Tab): void => {
    setTab(next);
    setTodayOnly(next === 'today');
    setUpcomingOnly(next === 'upcoming');
    if (next === 'in_service') setVisibleCategories(new Set(['in_service']));
    else if (next === 'completed') setVisibleCategories(new Set(['completed']));
    else if (next === 'cancelled_no_show') setVisibleCategories(new Set(['cancelled', 'no_show']));
    else setVisibleCategories(new Set(STATUS_CATEGORIES));
  };

  const toggleCategory = (category: StatusCategory, visible: boolean): void => {
    setTab('all');
    setTodayOnly(false);
    setUpcomingOnly(false);
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (visible) next.add(category);
      else next.delete(category);
      return next;
    });
  };

  const nowMs = Date.now();
  const tabCounts: Record<Tab, number> = useMemo(
    () => ({
      all: appointments.length,
      upcoming: appointments.filter(
        (a) =>
          (a.status === 'pending_approval' || a.status === 'confirmed') &&
          new Date(a.starts_at).getTime() >= nowMs,
      ).length,
      today: appointments.filter((a) => toSalonDate(a.starts_at, timezone) === today).length,
      in_service: appointments.filter((a) => a.status === 'in_service').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      cancelled_no_show: appointments.filter((a) =>
        ['cancelled', 'rejected', 'rescheduled', 'no_show'].includes(a.status),
      ).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, timezone, today],
  );

  const categoryCounts: Record<StatusCategory, number> = useMemo(() => {
    const counts: Record<StatusCategory, number> = {
      pending_approval: 0,
      confirmed: 0,
      in_service: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const a of appointments) counts[STATUS_CATEGORY[a.status]] += 1;
    return counts;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (!visibleCategories.has(STATUS_CATEGORY[a.status])) return false;
      if (todayOnly && toSalonDate(a.starts_at, timezone) !== today) return false;
      if (upcomingOnly && new Date(a.starts_at).getTime() < nowMs) return false;
      if (serviceId !== 'all' && a.service_id !== serviceId) return false;
      if (paymentStatus === 'paid' && !((a.paid_pence ?? 0) > 0)) return false;
      if (paymentStatus === 'unpaid' && (a.paid_pence ?? 0) > 0) return false;
      if (
        q &&
        ![a.customer_name, a.customer_email, a.customer_mobile, a.reference]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [
    appointments,
    visibleCategories,
    todayOnly,
    upcomingOnly,
    serviceId,
    paymentStatus,
    search,
    timezone,
    today,
    nowMs,
  ]);

  // "All" reads as a feed — most recent/soonest first, past bookings
  // trailing at the bottom. The other tabs keep the query's natural
  // ascending order (soonest-first makes more sense once you've already
  // narrowed to e.g. "Upcoming").
  const sorted = useMemo(() => {
    if (tab !== 'all') return filtered;
    return [...filtered].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  }, [filtered, tab]);

  const pageRows = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );

  const groups: AppointmentTableGroup[] = useMemo(() => {
    const map = new Map<string, AppointmentDetailed[]>();
    for (const a of pageRows) {
      const key = toSalonDate(a.starts_at, timezone);
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    return [...map.entries()].map(([date, rows]) => ({ date, rows }));
  }, [pageRows, timezone]);

  const changeStatus = async (id: string, status: AppointmentStatus): Promise<void> => {
    try {
      await setAppointmentStatus(id, status);
      await refresh();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  const saveNote = async (id: string, note: string): Promise<void> => {
    try {
      await setOwnerNote(id, note);
      await refresh();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  const logPaymentHandler = async (
    id: string,
    amountPence: number,
    note: string,
  ): Promise<void> => {
    try {
      await logPayment(id, amountPence, note);
      await refresh();
    } catch (e) {
      showToast({ message: errorMessage(e) });
      throw e;
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteAppointmentAsOwner(id);
      showToast({ message: 'Appointment deleted.' });
      await refresh();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    }
  };

  const clearAll = (): void => {
    setDateMode('week');
    setAnchor(today);
    setVisibleCategories(new Set(STATUS_CATEGORIES));
    setTodayOnly(false);
    setUpcomingOnly(false);
    setServiceId('all');
    setPaymentStatus('all');
    setSearch('');
    setTab('all');
  };

  const exportCsv = (): void => {
    const header = ['Date', 'Time', 'Client', 'Email', 'Mobile', 'Service', 'Staff', 'Status', 'Reference', 'Paid'];
    const rows = sorted.map((a) => [
      toSalonDate(a.starts_at, timezone),
      formatTime(a.starts_at, timezone),
      a.customer_name ?? '',
      a.customer_email ?? '',
      a.customer_mobile ?? '',
      a.service_name ?? '',
      ownerName,
      STATUS_LABELS[a.status],
      a.reference ?? '',
      formatMoney(a.paid_pence ?? 0),
    ]);
    downloadCsv(`appointments-${today}.csv`, [header, ...rows]);
  };

  return (
    <DashboardLayout
      title="Appointments"
      subtitle="View, search and manage all appointments."
      actions={
        <Button size="sm" onClick={() => { setPrefill(null); setJustBooked(null); setBooking(true); }}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          New booking
          <ChevronDown aria-hidden="true" className="h-4 w-4 opacity-70" strokeWidth={2.5} />
        </Button>
      }
    >
      {justBooked && (
        <div className="mb-6 rounded-lg border border-status-completed p-4 text-sm">
          <p className="font-medium text-foreground">Booked. Reference {justBooked}.</p>
          <p className="mt-1 text-muted-foreground">
            Their confirmation email is on its way, with a link they can use to change or
            cancel it themselves.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => applyTab(t.key)}
            className={
              tab === t.key
                ? 'border-b-2 border-primary px-3 pb-3 text-sm font-semibold text-primary'
                : 'border-b-2 border-transparent px-3 pb-3 text-sm font-medium text-muted-foreground hover:text-foreground'
            }
          >
            {t.label}{' '}
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {tabCounts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <input
            type="search"
            aria-label="Search appointments, clients, reference"
            placeholder="Search appointments, clients, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          aria-label="Date range"
          value={dateMode}
          onChange={(e) => setDateMode(e.target.value as DateMode)}
          className="h-9 rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select
          aria-label="Service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="h-9 rounded-lg border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          More filters
        </Button>
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          <Download aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Export
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:h-[calc(100vh-19rem)] lg:min-h-[420px] lg:flex-row lg:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:overflow-hidden">
          {loading && <LoadingState label="Loading appointments…" />}
          {error && <ErrorState error={error} onRetry={() => void refresh()} />}

          {!loading && !error && sorted.length === 0 && (
            <EmptyState
              title={search ? 'Nobody matches that' : 'Nothing in this period'}
              description={
                search
                  ? 'Try part of a name, or the booking reference.'
                  : 'Try a wider period, or a different filter.'
              }
            />
          )}

          {!loading && !error && sorted.length > 0 && (
            <>
              <div className="min-h-0 flex-1 lg:overflow-y-auto">
                <AppointmentsTable
                  groups={groups}
                  timezone={timezone}
                  ownerName={ownerName}
                  onView={setViewing}
                  onDelete={handleDelete}
                />
              </div>
              <div className="shrink-0">
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  totalItems={sorted.length}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>

        <aside
          className={cn(
            filtersOpen ? 'block' : 'hidden lg:block',
            'w-full lg:h-full lg:w-80 lg:shrink-0 lg:overflow-y-auto',
          )}
        >
          <AppointmentsFilterPanel
            dateMode={dateMode}
            onDateModeChange={setDateMode}
            dateLabel={dateRangeLabel(dateMode, anchor)}
            onPrevDate={() => setAnchor((a) => stepDateMode(dateMode, a, -1))}
            onNextDate={() => setAnchor((a) => stepDateMode(dateMode, a, 1))}
            visibleCategories={visibleCategories}
            categoryCounts={categoryCounts}
            onToggleCategory={toggleCategory}
            serviceId={serviceId}
            onServiceChange={setServiceId}
            services={services}
            paymentStatus={paymentStatus}
            onPaymentStatusChange={setPaymentStatus}
            onClearAll={clearAll}
          />
        </aside>
      </div>

      <AppointmentEditModal
        appointment={viewing}
        open={!!viewing}
        timezone={timezone}
        onClose={() => setViewing(null)}
        onStatusChange={changeStatus}
        onNoteSave={saveNote}
        onLogPayment={logPaymentHandler}
        onBookFollowUp={(a) => {
          setViewing(null);
          setPrefill({
            fullName: a.customer_name ?? '',
            email: a.customer_email ?? '',
            mobile: a.customer_mobile ?? '',
          });
          setJustBooked(null);
          setBooking(true);
        }}
        onDelete={handleDelete}
        onMoved={() => void refresh()}
      />

      <Modal open={booking} onClose={() => setBooking(false)} ariaLabel="Take a booking">
        <NewBookingPanel
          prefill={prefill}
          onClose={() => setBooking(false)}
          onBooked={(reference) => {
            setBooking(false);
            setJustBooked(reference);
            setSearch(reference);
            void refresh();
          }}
        />
      </Modal>
    </DashboardLayout>
  );
}
