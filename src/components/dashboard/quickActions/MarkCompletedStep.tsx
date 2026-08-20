import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
  type JSX,
} from 'react';
import { Field, Input } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusChip } from '@/components/ui/StatusChip';
import { StepHeader } from '@/components/dashboard/quickActions/StepHeader';
import {
  ITEM_BUTTON_CLASS,
  MAX_RESULTS,
} from '@/components/dashboard/quickActions/shared';
import { listAppointments } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { addDays, formatDateTime, salonDayRange, toSalonDate } from '@/lib/format';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/** Statuses `set_appointment_status` will actually move to 'completed' from
 * — mirrors `AppointmentCard.tsx`'s `NEXT_ACTIONS` map, not re-exported from
 * there since that map is a private implementation detail of that file. */
const COMPLETABLE_STATUSES: AppointmentStatus[] = [
  'confirmed',
  'checked_in',
  'in_service',
];

/**
 * Action 2: "Mark completed". Owns its own search (fetch once on mount,
 * filter client-side as the owner types — the same shape `AppointmentsPage`
 * already uses). The actual status write, its toast, and closing the
 * launcher stay with the parent: those need `useToast`/`close`, which this
 * step doesn't otherwise care about, and keeping the mutation call site next
 * to the other three actions' mutation call sites is easier to audit than
 * splitting it across files too.
 */
export function MarkCompletedStep({
  timezone,
  searchInputRef,
  completingId,
  onSelect,
  onBack,
  onClose,
}: {
  timezone: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  /** The id of the appointment currently being marked complete, if any —
   * disables just that row while the write is in flight. */
  completingId: string | null;
  onSelect: (appointment: AppointmentDetailed) => void;
  onBack: () => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<AppointmentDetailed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const today = toSalonDate(new Date(), timezone);
      const rows = await listAppointments({
        // 60 days back covers backlog clean-up; 3 days forward covers today's
        // (and the next couple of) live appointments an owner closes early —
        // wide enough to be useful, bounded so this stays a quick lookup
        // rather than an unbounded table scan.
        from: salonDayRange(addDays(today, -60), timezone).start,
        to: salonDayRange(addDays(today, 3), timezone).end,
        statuses: COMPLETABLE_STATUSES,
      });
      setCandidates(rows);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? candidates.filter((a) =>
          [a.customer_name, a.customer_email, a.customer_mobile, a.reference]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : candidates;
    return filtered.slice(0, MAX_RESULTS);
  }, [candidates, query]);

  return (
    <div>
      <StepHeader
        title="Mark completed"
        description="Find a live appointment. Marking it complete needs no confirmation."
        onBack={onBack}
        onClose={onClose}
      />
      <Field label="Find the appointment" hint="Name, email, mobile or reference.">
        {({ id, describedBy }) => (
          <Input
            ref={searchInputRef}
            id={id}
            aria-describedby={describedBy}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Koko, KB-XXXX…"
          />
        )}
      </Field>

      {loading && <LoadingState label="Loading live appointments…" />}
      {error && <ErrorState error={error} onRetry={() => void load()} />}
      {!loading && !error && results.length === 0 && (
        <EmptyState
          title={query ? 'Nobody matches that' : 'Nothing live right now'}
          description={
            query
              ? 'Try a different name, email, mobile or reference.'
              : 'Confirmed, checked-in and in-service appointments will show up here.'
          }
        />
      )}
      <ul className="space-y-2">
        {results.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              data-quicklauncher-item
              disabled={completingId === a.id}
              onClick={() => onSelect(a)}
              className={ITEM_BUTTON_CLASS}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{a.customer_name}</span>
                <StatusChip status={a.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(a.starts_at, timezone)} · {a.reference}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
