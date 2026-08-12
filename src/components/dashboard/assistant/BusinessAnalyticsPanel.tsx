import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { getBusinessAnalytics } from '@/services/assistantService';
import type { BusinessAnalyticsSummary } from '@/lib/insights';

const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

/** A plain-English performance summary, computed live from the last 90 days. */
export function BusinessAnalyticsPanel({ timezone }: { timezone: string }): JSX.Element {
  const [summary, setSummary] = useState<BusinessAnalyticsSummary | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getBusinessAnalytics(timezone)
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!summary) return <LoadingState label="Crunching the last 90 days…" />;

  const sentence = `In the last 90 days you've had ${summary.totalInWindow} booking${summary.totalInWindow === 1 ? '' : 's'}, ${pct(summary.returningRate)} of them from customers who'd visited before. ${pct(summary.noShowRate)} were no-shows and ${pct(summary.cancellationRate)} were cancelled.`;

  const stats = [
    { label: 'Bookings this month', value: String(summary.bookingsThisMonth) },
    { label: 'Returning-customer rate', value: pct(summary.returningRate) },
    { label: 'No-show rate', value: pct(summary.noShowRate) },
    { label: 'Cancellation rate', value: pct(summary.cancellationRate) },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="text-sm text-foreground">{sentence}</p>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="font-display text-2xl font-semibold text-foreground">
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
