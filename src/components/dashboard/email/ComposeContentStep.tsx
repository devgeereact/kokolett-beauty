import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { listCustomers } from '@/services/customerService';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Customer } from '@/types';

const MAX_RESULTS = 8;

/**
 * Compose step 2 — recipient, subject and body together in one screen
 * (not three separate pages), so choosing who it's for and refining what
 * it says both happen without losing sight of the other. Subject/body
 * arrive pre-filled from whichever template step 1 picked (or blank), and
 * stay fully editable — the owner always sends her own words, never raw
 * template output unread (docs/RULES.md §9.6).
 */
export function ComposeContentStep({
  contentLoading,
  contentError,
  recipient,
  onRecipientChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  sending,
  sendError,
  onSend,
  onBack,
  onClose,
}: {
  contentLoading: boolean;
  contentError: string | null;
  recipient: Customer | null;
  onRecipientChange: (customer: Customer | null) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
  onBack: () => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchIdRef = useRef(0);

  const search = useCallback(async (): Promise<void> => {
    const requestId = ++searchIdRef.current;
    setSearching(true);
    setSearchError(null);
    try {
      const rows = await listCustomers(query);
      if (requestId !== searchIdRef.current) return;
      setResults(rows.slice(0, MAX_RESULTS));
    } catch (e) {
      if (requestId !== searchIdRef.current) return;
      setSearchError(errorMessage(e));
    } finally {
      if (requestId === searchIdRef.current) setSearching(false);
    }
  }, [query]);

  useEffect(() => {
    if (recipient) return undefined;
    const timer = window.setTimeout(() => void search(), 250);
    return () => window.clearTimeout(timer);
  }, [search, recipient]);

  const canSend =
    !sending && !contentLoading && !!recipient && subject.trim() !== '' && body.trim() !== '';

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Back to templates
          </button>
          <h2 className="font-serif text-lg font-semibold text-foreground">Compose</h2>
          <p className="text-sm text-muted-foreground">
            Choose who it&rsquo;s for, then send.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-foreground">To</label>
        {recipient ? (
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Avatar name={recipient.full_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {recipient.full_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
            </div>
            <button
              type="button"
              aria-label="Remove recipient"
              onClick={() => onRecipientChange(null)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers by name, email or mobile…"
              className="h-10 w-full rounded-sm border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border">
              {searching ? (
                <LoadingState label="Searching…" />
              ) : searchError ? (
                <ErrorState error={searchError} onRetry={() => void search()} />
              ) : results.length === 0 ? (
                <EmptyState
                  title={query ? 'No one matches that' : 'No customers yet'}
                  description="Try a different name, email or number."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {results.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => onRecipientChange(customer)}
                        className={cn(
                          'flex w-full items-center gap-3 p-2.5 text-left transition-colors',
                          'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                      >
                        <Avatar name={customer.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {customer.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {customer.email}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {contentLoading ? (
        <LoadingState label="Loading template content…" />
      ) : (
        <>
          {contentError && (
            <p className="mb-3 text-sm text-status-no-show">{contentError}</p>
          )}
          <Field label="Subject">
            {({ id }) => (
              <Input id={id} value={subject} onChange={(e) => onSubjectChange(e.target.value)} />
            )}
          </Field>
          <Field label="Body">
            {({ id }) => (
              <Textarea
                id={id}
                rows={10}
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
              />
            )}
          </Field>
        </>
      )}

      {sendError && (
        <p role="alert" className="mb-3 text-sm text-status-no-show">
          {sendError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={sending} disabled={!canSend} onClick={onSend}>
          Send email
        </Button>
      </div>
    </div>
  );
}
