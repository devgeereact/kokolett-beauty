import { type JSX, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAvailability } from '@/hooks/useAvailability';
import { useServices } from '@/hooks/useServices';
import { routes } from '@/lib/routes';

/**
 * What the booking page is actually doing right now.
 *
 * It used to render a hard-coded "Live" badge and the sentence "Your booking
 * page is active and accepting bookings", reading no data at all. On a salon
 * that has not published any hours yet, that is false in the most expensive
 * direction: `available_slots()` reads `availability_slots`, no migration
 * seeds it, and the nightly generator short-circuits on an empty weekly
 * template, so `/book` shows "No times open at the moment" indefinitely while
 * this card says the opposite. The owner has no reason to go looking.
 *
 * So it asks the same question the customer's browser asks, through the same
 * RPC: are there open times in the horizon? There is still no pause switch,
 * and this is still a report rather than a toggle. It is just a true one.
 */
export function BookingPageStatusCard(): JSX.Element {
  const url = `${window.location.origin}${routes.public.book}`;
  const [copied, setCopied] = useState(false);
  const { services } = useServices();
  const { openDates, loading, error } = useAvailability(services[0]?.duration_min ?? 60);

  const copy = (): void => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const open = openDates.length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-base font-semibold text-foreground">
          Booking page status
        </h2>
        {loading ? (
          <Badge tone="pending">Checking</Badge>
        ) : error ? (
          <Badge tone="cancelled">Unknown</Badge>
        ) : open > 0 ? (
          <Badge tone="completed">Live</Badge>
        ) : (
          <Badge tone="pending">Nothing open</Badge>
        )}
      </div>

      {loading ? (
        <p className="mb-2 text-sm text-muted-foreground">
          Checking what a customer would see.
        </p>
      ) : error ? (
        <p className="mb-2 text-sm text-muted-foreground">
          The diary could not be read just now, so this cannot say what a customer would
          see. The booking page itself may still be fine.
        </p>
      ) : open > 0 ? (
        <p className="mb-2 text-sm text-muted-foreground">
          Your booking page is accepting bookings, with {open} day
          {open === 1 ? '' : 's'} open.
        </p>
      ) : (
        <p className="mb-2 text-sm text-muted-foreground">
          Nobody can book yet: there are no open times in the diary, so the booking page
          offers a customer nothing.{' '}
          <Link
            to={routes.owner.weeklyDefault}
            className="font-medium text-brand-ink underline underline-offset-2"
          >
            Publish your hours
          </Link>{' '}
          and they will appear here.
        </p>
      )}

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
