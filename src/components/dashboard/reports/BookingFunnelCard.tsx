import { type JSX, useEffect, useState } from 'react';
import { Card, CardHeading } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { getBookingFunnel, type BookingFunnel } from '@/services/reportsService';
import { cn } from '@/lib/utils';

const STAGES: { key: keyof Omit<BookingFunnel, 'days'>; label: string }[] = [
  { key: 'book_page_viewed', label: 'Viewed the booking page' },
  { key: 'slot_selected', label: 'Picked a time' },
  { key: 'booking_submitted', label: 'Submitted details' },
  { key: 'booking_confirmed', label: 'Booking confirmed' },
];

/**
 * KOKO_GAP.md P3: "no booking funnel, no conversion tracking." First-party
 * counts (`product_events`, migration 0064) rather than a third-party
 * vendor — see `reportsService.getBookingFunnel`'s own comment for why.
 * Each stage's bar is relative to the first stage, the same "% of visitors
 * who reached here" read any funnel chart gives.
 */
export function BookingFunnelCard(): JSX.Element {
  const [funnel, setFunnel] = useState<BookingFunnel | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getBookingFunnel(30)
      .then(setFunnel)
      .catch(() => setError(true));
  }, []);

  const top = funnel?.book_page_viewed ?? 0;

  return (
    <Card pad="compact">
      <CardHeading
        size="compact"
        title="Booking funnel"
        description="Last 30 days, tracked on the public booking page only."
      />

      {error && (
        <p className="text-xs text-muted-foreground">
          Couldn&rsquo;t load the funnel right now.
        </p>
      )}

      {!error && !funnel && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}

      {funnel && (
        <div className="space-y-2.5">
          {STAGES.map((stage) => {
            const count = funnel[stage.key];
            const pct = top > 0 ? Math.round((count / top) * 100) : 0;
            return (
              <div key={stage.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-foreground">{stage.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} {top > 0 && `· ${pct}%`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full bg-primary')}
                    style={{ width: `${top > 0 ? pct : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
