import {
  useCallback,
  useEffect,
  useRef,
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
import { listCustomers } from '@/services/customerService';
import { errorMessage } from '@/lib/errors';
import type { Customer } from '@/types';

/**
 * Action 3's search half: find the customer. Reuses `customerService`'s own
 * search — the same one `CustomersPage` calls — debounced the same 250ms so
 * typing a name isn't one request per keystroke. Selecting a result is the
 * parent's job (it builds the `PrefilledCustomer` shape and swaps to the
 * booking step).
 */
export function RebookSearchStep({
  searchInputRef,
  onSelect,
  onBack,
  onClose,
}: {
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSelect: (customer: Customer) => void;
  onBack: () => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Ordering guard, as in `ComposeContentStep` and `CustomersPage`: the
     debounce spaces requests out, it does not stop a slower earlier one
     landing after a faster later one and repopulating the list with results
     for a query the owner has already typed past. */
  const searchId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = (searchId.current += 1);
    setLoading(true);
    setError(null);
    try {
      const rows = await listCustomers(query);
      if (id !== searchId.current) return;
      setResults(rows.slice(0, MAX_RESULTS));
    } catch (e) {
      if (id !== searchId.current) return;
      setError(errorMessage(e));
    } finally {
      if (id === searchId.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    // Debounced, same 250ms as `CustomersPage`'s own search. `load` already
    // changes identity whenever `query` does (see its own `useCallback`
    // deps above), so depending on it here is enough to re-run per keystroke.
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <StepHeader
        title="Rebook customer"
        description="Find the customer, then book their next visit."
        onBack={onBack}
        onClose={onClose}
      />
      <Field label="Search" hint="Name, email or mobile.">
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

      {loading && <LoadingState label="Loading customers…" />}
      {error && <ErrorState error={error} onRetry={() => void load()} />}
      {!loading && !error && results.length === 0 && (
        <EmptyState
          title={query ? 'No one matches that' : 'No customers yet'}
          description="Try a different name, email or number."
        />
      )}
      <ul className="space-y-2">
        {results.map((customer) => (
          <li key={customer.id}>
            <button
              type="button"
              data-quicklauncher-item
              onClick={() => onSelect(customer)}
              className={ITEM_BUTTON_CLASS}
            >
              <p className="font-medium text-foreground">{customer.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {customer.email}
                {customer.mobile ? ` · ${customer.mobile}` : ''}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
