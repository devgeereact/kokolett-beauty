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
import { StepHeader } from '@/components/dashboard/quickActions/StepHeader';
import {
  ITEM_BUTTON_CLASS,
  MAX_RESULTS,
} from '@/components/dashboard/quickActions/shared';
import { listQueuedRequests, type QueuedRequest } from '@/services/requestService';
import { errorMessage } from '@/lib/errors';

/**
 * Action 4's search half: find the request. Fetches the open queue once
 * (`listQueuedRequests`, the same table `RequestsQueue` reads) and filters
 * client-side as the owner types — the queue is short enough that a second
 * round trip per keystroke would be overhead, not speed.
 *
 * Selecting a result is the parent's job: it closes the launcher and
 * navigates to Inbox's Requests tab. The actual "offer a slot" interaction
 * (date/time picker, fairness warnings, override reason) is answered there,
 * inside `RequestDetailPanel` itself — reimplementing it here would
 * duplicate DB-enforced, fairness-critical business logic for what's meant
 * to be a fast "find it, jump to it" shortcut.
 */
export function OfferSlotStep({
  searchInputRef,
  onSelect,
  onBack,
  onClose,
}: {
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSelect: (request: QueuedRequest) => void;
  onBack: () => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [requests, setRequests] = useState<QueuedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listQueuedRequests());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? requests.filter((r) =>
          [r.full_name, r.email, r.mobile]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : requests;
    return filtered.slice(0, MAX_RESULTS);
  }, [requests, query]);

  return (
    <div>
      <StepHeader
        title="Offer slot to request"
        description="Find the request — you'll answer it from the Requests queue, where the date/time picker and fairness checks live."
        onBack={onBack}
        onClose={onClose}
      />
      <Field label="Find the request" hint="Name, email or mobile.">
        {({ id, describedBy }) => (
          <Input
            ref={searchInputRef}
            id={id}
            aria-describedby={describedBy}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing…"
          />
        )}
      </Field>

      {loading && <LoadingState label="Loading the queue…" />}
      {error && <ErrorState error={error} onRetry={() => void load()} />}
      {!loading && !error && results.length === 0 && (
        <EmptyState
          title={query ? 'Nobody matches that' : 'Nobody waiting'}
          description={
            query
              ? 'Try a different name, email or number.'
              : 'Requests arrive when someone wants a time you have not published.'
          }
        />
      )}
      <ul className="space-y-2">
        {results.map((request) => (
          <li key={request.id}>
            <button
              type="button"
              data-quicklauncher-item
              onClick={() => onSelect(request)}
              className={ITEM_BUTTON_CLASS}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{request.full_name}</span>
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  title={`Position ${request.queue_position} in the queue`}
                >
                  {request.queue_position}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {request.email}
                {request.mobile ? ` · ${request.mobile}` : ''} · waiting{' '}
                {request.waiting_hours}h
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
