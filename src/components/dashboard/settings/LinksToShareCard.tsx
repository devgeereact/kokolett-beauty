import { type JSX } from 'react';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { ShareLink } from '@/components/dashboard/ShareLink';
import { Card, CardHeading } from '@/components/ui/Card';
import { routes } from '@/lib/routes';
import { SITE_ORIGIN } from '@/lib/business';

/** The links the owner pastes into Instagram, WhatsApp, or hands to a customer directly. */
export function LinksToShareCard(): JSX.Element {
  return (
    <Card pad="standard">
      <CardHeading
        size="compact"
        title="Links to Share"
        description="Share these links on Instagram, WhatsApp or with customers."
      />
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
