import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/** The booking page is always live once the site is deployed — there is no "pause bookings" switch, so this reports fact, not a toggle. */
export function BookingPageStatusCard(): JSX.Element {
  const url = `${window.location.origin}${routes.public.book}`;
  const [copied, setCopied] = useState(false);

  const copy = (): void => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">
          Booking page status
        </h2>
        <Badge tone="completed">Live</Badge>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Your booking page is active and accepting bookings.
      </p>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {url.replace(/^https?:\/\//, '')}
        </span>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
    </Card>
  );
}
