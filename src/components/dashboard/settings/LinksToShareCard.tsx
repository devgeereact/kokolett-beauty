import { type JSX } from 'react';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { ShareLink } from '@/components/dashboard/ShareLink';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';
import { SITE_ORIGIN } from '@/lib/business';

/** The links the owner pastes into Instagram, WhatsApp, or hands to a customer directly. */
export function LinksToShareCard(): JSX.Element {
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Links to Share
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Share these links on Instagram, WhatsApp or with customers.
      </p>
      <ShareLink
        icon={MapPin}
        label="Book an appointment"
        hint="Goes straight to your available booking times."
        url={`${SITE_ORIGIN}${routes.public.book}`}
      />
      <ShareLink
        icon={Users}
        label="Join my mailing list"
        hint="Customers only need to provide their name and email."
        url={`${SITE_ORIGIN}${routes.public.subscribe}`}
      />
      <ShareLink
        icon={CalendarClock}
        label="Ask for a time"
        hint="For customers who cannot find a suitable time on the calendar."
        url={`${SITE_ORIGIN}${routes.public.requestAvailability}`}
      />
    </Card>
  );
}
