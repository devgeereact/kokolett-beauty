import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { RequestRow } from '@/components/dashboard/requests/RequestRow';
import { RequestDetailPanel } from '@/components/dashboard/requests/RequestDetailPanel';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Pagination } from '@/components/ui/Pagination';
import { ErrorState, LoadingState, EmptyState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  declineRequest,
  listAllRequests,
  offerSlotToRequest,
  setRequestOwnerNote,
  whoIsAhead,
  type QueuedRequest,
} from '@/services/requestService';
import { listActiveServices } from '@/services/serviceCatalogService';
import { errorMessage, toAppError } from '@/lib/errors';
import {
  REQUEST_LANE_LABELS,
  laneForStatus,
  priorityFromWaitingHours,
  type RequestLane,
  type RequestPriority,
} from '@/lib/requestStatus';
import { cn } from '@/lib/utils';
import type { Service } from '@/types';
import {
  filterBar,
  filterCount,
  filterTab,
  toolbarControl,
} from '@/components/ui/controlClasses';

export interface RequestsQueueHandle {
  reload: () => Promise<void>;
}

type Lane = 'all' | RequestLane;
const LANES: Lane[] = ['all', 'new', 'awaiting_response', 'converted', 'declined'];

type SortOrder = 'newest' | 'oldest';
type PriorityFilter = 'all' | RequestPriority;

/** A request's own `preferred_dates` overlaps the owner's from/to filter window. Empty (no preference) always matches — "any date" is flexible by definition. */
function overlapsPreferredWindow(dates: string[], from: string, to: string): boolean {
  if (dates.length === 0) return true;
  return dates.some((d) => (!from || d >= from) && (!to || d <= to));
}

// A single-column row list, so no grid-divisibility constraint — 8 is just
// the same round page size as the other single-column list screens
// (Notifications), not a one-off number.
const PAGE_SIZE = 8;

/**
 * The requests queue, rebuilt onto `docs/design/availability-request.png` —
 * a filterable table-style list on the left and a single decision surface
 * on the right, replacing the old inline-expanding cards (`RequestsPanel`).
 * Booking/decline logic is unchanged from that component, just re-plumbed
 * through the new panel's callback shape.
 */
export const RequestsQueue = forwardRef<
  RequestsQueueHandle,
  { onCountChange?: (n: number) => void }
>(function RequestsQueue({ onCountChange }, ref) {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<QueuedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lane, setLane] = useState<Lane>('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [serviceId, setServiceId] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [preferredFrom, setPreferredFrom] = useState('');
  const [preferredTo, setPreferredTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  useEffect(() => {
    listActiveServices()
      .then(setServices)
      .catch((e: unknown) => showToast({ message: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const rows = await listAllRequests();
      setRequests(rows);
      onCountChange?.(rows.filter((r) => r.queue_position !== null).length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useImperativeHandle(ref, () => ({ reload: load }), [load]);

  const laneCounts = useMemo(() => {
    const counts: Record<Lane, number> = {
      all: requests.length,
      new: 0,
      awaiting_response: 0,
      converted: 0,
      declined: 0,
    };
    for (const r of requests) counts[laneForStatus(r.status)] += 1;
    return counts;
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = requests.filter((r) => {
      if (lane !== 'all' && laneForStatus(r.status) !== lane) return false;
      if (serviceId !== 'all' && r.service_id !== serviceId) return false;
      if (priorityFilter !== 'all') {
        const rowLane = laneForStatus(r.status);
        if (rowLane !== 'new' && rowLane !== 'awaiting_response') return false;
        if (priorityFromWaitingHours(r.waiting_hours) !== priorityFilter) return false;
      }
      if (
        (preferredFrom || preferredTo) &&
        !overlapsPreferredWindow(r.preferred_dates, preferredFrom, preferredTo)
      )
        return false;
      if (
        q &&
        !r.full_name.toLowerCase().includes(q) &&
        !r.email.toLowerCase().includes(q) &&
        !(r.notes ?? '').toLowerCase().includes(q) &&
        !(r.preferred_times ?? '').toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    const sorted = [...rows].sort((a, b) =>
      sortOrder === 'newest'
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );
    return sorted;
  }, [
    requests,
    lane,
    search,
    serviceId,
    priorityFilter,
    preferredFrom,
    preferredTo,
    sortOrder,
  ]);

  useEffect(() => {
    setPage(1);
  }, [lane, search, serviceId, priorityFilter, preferredFrom, preferredTo, sortOrder]);

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => {
    if (pageRows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!pageRows.some((r) => r.id === selectedId)) {
      setSelectedId(pageRows[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRows]);

  const selected = pageRows.find((r) => r.id === selectedId) ?? null;

  const clearFilters = (): void => {
    setSortOrder('newest');
    setServiceId('all');
    setPriorityFilter('all');
    setPreferredFrom('');
    setPreferredTo('');
  };

  const offer = async (startsAtIso: string, overrideReason?: string): Promise<void> => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await offerSlotToRequest(selected.id, startsAtIso, overrideReason);
      showToast({
        message: `Booked in. Reference ${result.reference}. They have been emailed.`,
      });
      await load();
    } catch (e) {
      const ahead = whoIsAhead(e);
      if (ahead) {
        showToast({
          message: `${ahead} asked before them for that date. Use Create custom offer with a reason if you want to skip ahead.`,
        });
      } else {
        showToast({ message: toAppError(e).message });
      }
    } finally {
      setBusy(false);
    }
  };

  const decline = async (reason: string): Promise<void> => {
    if (!selected) return;
    setBusy(true);
    try {
      await declineRequest(selected.id, reason);
      showToast({ message: 'Request declined.' });
      await load();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (note: string): Promise<void> => {
    if (!selected) return;
    try {
      await setRequestOwnerNote(selected.id, note);
      setRequests((prev) =>
        prev.map((r) => (r.id === selected.id ? { ...r, owner_note: note || null } : r)),
      );
    } catch (e) {
      showToast({ message: errorMessage(e) });
      throw e;
    }
  };

  if (loading) return <LoadingState label="Loading requests…" />;
  if (error) return <ErrorState error={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Filter requests" className={filterBar}>
        {LANES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLane(l)}
            aria-pressed={lane === l}
            className={filterTab(lane === l)}
          >
            {l === 'all' ? 'All' : REQUEST_LANE_LABELS[l]}
            <span className={filterCount(lane === l)}>{laneCounts[l]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests, clients, notes…"
            className={cn(toolbarControl, 'w-full pl-9')}
          />
        </div>
        <select
          aria-label="Sort by date"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className={toolbarControl}
        >
          <option value="newest">Date: Newest</option>
          <option value="oldest">Date: Oldest</option>
        </select>
        <select
          aria-label="Service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className={toolbarControl}
        >
          <option value="all">All services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className={toolbarControl}
        >
          <option value="all">Priority: All</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => setMoreFiltersOpen((v) => !v)}>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          More filters
        </Button>
      </div>

      {moreFiltersOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="min-w-[10rem]">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Preferred from
            </label>
            <DatePicker
              value={preferredFrom}
              onChange={setPreferredFrom}
              max={preferredTo}
            />
          </div>
          <div className="min-w-[10rem]">
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Preferred to
            </label>
            <DatePicker
              value={preferredTo}
              onChange={setPreferredTo}
              min={preferredFrom}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={lane === 'all' ? 'Nobody waiting' : 'Nobody here'}
          description={
            lane === 'all'
              ? 'Requests arrive when someone wants a time you have not published. If a booking cancels, this is where you find the next person in line.'
              : `No requests in ${REQUEST_LANE_LABELS[lane]?.toLowerCase() ?? lane} right now.`
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {pageRows.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                selected={r.id === selectedId}
                onSelect={() => setSelectedId(r.id)}
              />
            ))}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={filtered.length}
              onPageChange={setPage}
              itemLabel="requests"
            />
          </div>

          <RequestDetailPanel
            request={selected}
            timezone={timezone}
            busy={busy}
            onOffer={(iso, reason) => void offer(iso, reason)}
            onDecline={(reason) => void decline(reason)}
            onSaveNote={saveNote}
          />
        </div>
      )}
    </div>
  );
});
