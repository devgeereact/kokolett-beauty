import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalHeading as H2, LegalLink } from '@/components/public/LegalPage';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';
import { CONTACT_EMAIL, OWNER_NAME } from '@/lib/business';

/**
 * Terms for using the website and its booking system.
 *
 * Deliberately narrow. What happens at an appointment is ordinary consumer
 * law and the booking policy, not something this page tries to redefine, and
 * nothing here attempts to sign away a statutory right.
 */
export function TermsPage(): JSX.Element {
  const { settings } = useBusinessSettings();

  return (
    <LegalPage
      title="Terms of use"
      updated="September 2026"
      description="The terms that apply when you use the Kokolett Beauty UK website and book an appointment."
      path={routes.public.terms}
    >
      <p>
        These terms cover using this website. They are not the whole relationship between
        you and the salon, what happens at your appointment is a matter of ordinary
        consumer law, and nothing here reduces your statutory rights.
      </p>

      <H2>Who we are</H2>
      <p>
        Kokolett Beauty UK is a women&rsquo;s hair salon run by {OWNER_NAME} as a sole
        trader
        {settings?.address_line
          ? ` at ${settings.address_line}`
          : ' in the United Kingdom'}
        . Contact us at{' '}
        <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        {settings?.phone ? ` or ${settings.phone}` : ''}.
      </p>

      <H2>Who can book</H2>
      <p>
        You need to be 18 or over to book through this site. If you are younger, a parent
        or guardian should book for you and come with you.
      </p>

      <H2>Using this site</H2>
      <p>
        Please book only appointments you intend to keep, and give real contact details, a
        booking under a false name takes a slot from somebody who wanted it. We may cancel
        a booking that appears not to be genuine.
      </p>
      <p>Please also do not:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>book on somebody else&rsquo;s behalf without their say-so,</li>
        <li>use the contact form or the booking notes to send anything abusive,</li>
        <li>
          try to get at parts of the site that are not yours, or at anybody else&rsquo;s
          booking,
        </li>
        <li>or use automated tools to make bookings or scrape the site.</li>
      </ul>

      <H2>What this site does and does not do</H2>
      <p>
        The site shows information about the salon and lets you book, change and cancel an
        appointment. It takes no payment: nothing is charged online, no card details are
        entered, and no deposit is required. Payment happens in the salon.
      </p>
      <p>
        Booking a time here is an appointment, not a contract to carry out a particular
        service at a fixed price. What is done and what it costs is agreed with you before
        any work starts, as the{' '}
        <Link
          to={routes.public.bookingPolicy}
          className="underline underline-offset-4 hover:text-foreground"
        >
          booking policy
        </Link>{' '}
        explains.
      </p>

      <H2>Availability of the site</H2>
      <p>
        We aim to keep the booking page working at all times but cannot promise it. If it
        is unavailable, email or telephone the salon.
      </p>

      <H2>Prices</H2>
      <p>
        Where a price is shown it is a guide. The final price depends on what your hair
        actually needs, and is agreed with you in the salon before any work starts.
      </p>

      <H2>Content</H2>
      <p>
        The words, photographs and design of this site belong to Kokolett Beauty UK.
        Please do not copy them for your own business. Reviews shown on the site belong to
        the people who wrote them.
      </p>

      <H2>Other people&rsquo;s services</H2>
      <p>
        The site links out to Google, Instagram and WhatsApp, and it relies on suppliers
        listed in the{' '}
        <Link
          to={routes.public.privacy}
          className="underline underline-offset-4 hover:text-foreground"
        >
          privacy notice
        </Link>
        . Those are their services under their own terms, not ours.
      </p>

      <H2>If something goes wrong</H2>
      <p>
        We are responsible for loss we cause you by failing to take reasonable care. We
        are not responsible for the site being unavailable, for a message that does not
        arrive because of a problem at your email provider, or for anything we could not
        reasonably have foreseen.
      </p>
      <p>
        Nothing in these terms limits our responsibility for death or personal injury
        caused by our negligence, for fraud, or for anything else the law does not allow
        us to limit. Your rights as a consumer under the Consumer Rights Act 2015 stand
        whatever this page says.
      </p>

      <H2>Complaints</H2>
      <p>
        Tell us and we will try to sort it out. The{' '}
        <Link
          to={routes.public.complaints}
          className="underline underline-offset-4 hover:text-foreground"
        >
          complaints
        </Link>{' '}
        page explains how, how long we take, and where to go if you are not satisfied.
      </p>

      <H2>Your information</H2>
      <p>
        How we handle what you give us is set out in the{' '}
        <Link
          to={routes.public.privacy}
          className="underline underline-offset-4 hover:text-foreground"
        >
          privacy notice
        </Link>
        , and what is kept in your browser is on the{' '}
        <Link
          to={routes.public.cookies}
          className="underline underline-offset-4 hover:text-foreground"
        >
          cookies and storage
        </Link>{' '}
        page.
      </p>

      <H2>Changes</H2>
      <p>We may update these terms. The date at the top shows when they last changed.</p>

      <H2>Law</H2>
      <p>
        These terms are governed by the law of England and Wales, and the courts of
        England and Wales deal with any dispute.
      </p>
    </LegalPage>
  );
}
