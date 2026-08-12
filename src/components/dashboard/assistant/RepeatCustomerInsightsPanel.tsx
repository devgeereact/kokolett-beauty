import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { getRepeatCustomers } from '@/services/assistantService';
import { formatDateShort } from '@/lib/format';
import type { RepeatCustomerInsight } from '@/lib/insights';

/** Visits at or above this count unlocks the one-click thank-you email. */
const THANK_YOU_THRESHOLD = 5;

function thankYouHref(customer: RepeatCustomerInsight['customer']): string {
  const first = customer.full_name.trim().split(/\s+/)[0] ?? customer.full_name;
  const subject = 'Thank you for being a regular';
  const body = `Hi ${first},\n\nI just wanted to say thank you for being such a regular — it genuinely makes a difference having customers like you. See you next time.`;
  return `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Customers ranked by completed visits, over the last two years. */
export function RepeatCustomerInsightsPanel({
  timezone,
}: {
  timezone: string;
}): JSX.Element {
  const [insights, setInsights] = useState<RepeatCustomerInsight[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getRepeatCustomers(timezone)
      .then(setInsights)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!insights) return <LoadingState label="Ranking your customers…" />;
  if (insights.length === 0) {
    return (
      <EmptyState
        title="No repeat visits yet"
        description="Once a customer has a completed appointment, they'll show up here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {insights.slice(0, 25).map((r) => (
        <Card key={r.customer.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.customer.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {r.completedCount} completed visit{r.completedCount === 1 ? '' : 's'}
              {r.lastVisitAt &&
                ` · last seen ${formatDateShort(r.lastVisitAt, timezone)}`}
            </p>
          </div>
          {r.completedCount >= THANK_YOU_THRESHOLD && (
            <a
              href={thankYouHref(r.customer)}
              className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Send thank-you email
            </a>
          )}
        </Card>
      ))}
    </div>
  );
}
