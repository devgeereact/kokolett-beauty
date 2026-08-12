import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { getCancellationForecast } from '@/services/assistantService';
import { draftEmail } from '@/lib/emailDrafts';
import { formatDateShort, formatTime } from '@/lib/format';
import type { CancellationRisk } from '@/lib/insights';

/** Above this score, a reminder is worth sending proactively. */
const REMINDER_THRESHOLD = 0.4;

function reminderHref(risk: CancellationRisk, timezone: string): string {
  const a = risk.appointment;
  const draft = draftEmail(
    {
      customerName: a.customer_name ?? 'there',
      reference: a.reference,
      whenLabel: `${formatDateShort(a.starts_at, timezone)} at ${formatTime(a.starts_at, timezone)}`,
    },
    'reminder',
  );
  return `mailto:${a.customer_email ?? ''}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}

/**
 * A risk score per upcoming appointment, from signals already on the row:
 * first-time customer, short notice at booking, prior no-shows, walk-in vs
 * online. A ranking signal, not a calibrated probability — the reasons list
 * is there so the owner can sanity-check it at a glance.
 */
export function CancellationForecastingPanel({
  timezone,
}: {
  timezone: string;
}): JSX.Element {
  const [risks, setRisks] = useState<CancellationRisk[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = (): void => {
    setError(null);
    getCancellationForecast(timezone)
      .then(setRisks)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  };

  useEffect(load, [timezone]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!risks) return <LoadingState label="Scoring the next 30 days…" />;
  if (risks.length === 0) {
    return (
      <EmptyState
        title="Nothing upcoming to score"
        description="Once you have confirmed or held bookings in the next 30 days, they'll be ranked here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {risks.map((risk) => (
        <Card key={risk.appointment.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {risk.appointment.customer_name ?? 'Customer'}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDateShort(risk.appointment.starts_at, timezone)} at{' '}
                {formatTime(risk.appointment.starts_at, timezone)} ·{' '}
                {risk.appointment.reference}
              </p>
              {risk.reasons.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {risk.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-display text-lg font-semibold text-foreground">
                {Math.round(risk.score * 100)}%
              </span>
              {risk.score >= REMINDER_THRESHOLD && (
                <a
                  href={reminderHref(risk, timezone)}
                  className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Send reminder now
                </a>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
