import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteShell } from '@/components/public/SiteShell';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';

/**
 * Privacy, booking policy and terms.
 *
 * Written to describe what this application actually does, not from a template.
 * Every claim here is checkable against the code: the data listed is the data
 * the schema stores, the retention story matches the soft-delete path, and the
 * cancellation window is read from settings rather than repeated as a number
 * that will drift the moment the owner changes it.
 *
 * Where a fact belongs to the business rather than the software — a trading
 * name, an ICO registration — the page says so plainly instead of inventing it.
 * A privacy notice with a made-up registration number is worse than none.
 */

const SALON_EMAIL = 'booking@kokolettbeauty.com';

function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl px-4 py-14 md:px-6">
        <h1 className="font-serif text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-sm">
          <Link
            to={routes.public.home}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Back to the salon
          </Link>
        </p>
      </article>
    </SiteShell>
  );
}

function H2({ children }: { children: ReactNode }): JSX.Element {
  return <h2 className="font-serif text-lg font-semibold text-foreground">{children}</h2>;
}

export function PrivacyPage(): JSX.Element {
  const { settings } = useBusinessSettings();

  return (
    <LegalPage title="Privacy" updated="August 2026">
      <p>
        Kokolett Beauty UK is a single-owner women&rsquo;s hair salon. This page explains
        exactly what we hold about you, why, and how to get rid of it. It describes what
        the booking system actually does rather than what a template says.
      </p>

      <H2>What we collect</H2>
      <p>When you book, we store your name, email address and mobile number.</p>
      <p>
        We also store anything you type into the &ldquo;what are you after&rdquo; box, the
        appointments you have made, and whether you agreed to receive occasional news.
        That is the whole list. We do not ask for a date of birth, an address, or payment
        details, and there is no account or password to create.
      </p>

      <H2>Why we need it</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Your <strong>name and email</strong> identify the booking and carry your
          confirmation, reminders and any change to your appointment.
        </li>
        <li>
          Your <strong>mobile number</strong> is so the salon can reach you if something
          changes at short notice, a phone call is faster than an email when it matters.
        </li>
        <li>
          Your <strong>note</strong> tells the salon what to prepare before you arrive.
        </li>
      </ul>
      <p>
        The lawful basis for all of this is performing the appointment you asked for.
        Marketing email is separate and only ever goes to people who explicitly ticked the
        box; you can stop it at any time by replying to any message.
      </p>

      <H2>Who else sees it</H2>
      <p>
        The salon owner. Nobody else has an account on this system. Behind the scenes we
        use two suppliers:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Supabase</strong> hosts the database, in their London region. Your data
          stays in the United Kingdom.
        </li>
        <li>
          <strong>Our email host</strong> delivers confirmations and reminders from{' '}
          {SALON_EMAIL}.
        </li>
      </ul>
      <p>
        We do not sell your details, share them with advertisers, or use them to build a
        profile of you.
      </p>

      <H2>Reviews shown on this site</H2>
      <p>
        The reviews on our home page come from our public Google Business listing. We do
        not collect them and cannot edit them, they belong to the people who wrote them
        and to Google.
      </p>

      <H2>How long we keep it</H2>
      <p>
        Appointment history is kept as the salon&rsquo;s business record. If you ask us to
        erase your details, we remove your name, contact details and any private note, and
        you become an anonymous entry in that history, the appointment itself has to
        survive for the salon&rsquo;s accounts. If you book again afterwards you arrive as
        a completely new customer.
      </p>
      <p>
        Sign-in links expire after 30&nbsp;minutes and work once. Expired ones are deleted
        automatically.
      </p>

      <H2>Your rights</H2>
      <p>
        Under UK GDPR you can ask for a copy of what we hold, ask us to correct it, or ask
        us to erase it. Email{' '}
        <a
          href={`mailto:${SALON_EMAIL}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {SALON_EMAIL}
        </a>{' '}
        and we will deal with it within one month.
      </p>
      <p>
        If you are unhappy with how we have handled your information you can complain to
        the Information Commissioner&rsquo;s Office at{' '}
        <a
          href="https://ico.org.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          ico.org.uk
        </a>
        .
      </p>

      <H2>Cookies</H2>
      <p>
        This site sets no advertising or analytics cookies. If you use a sign-in link,
        your browser stores a single token so the site can show you your own bookings.
        Signing out removes it.
      </p>

      <H2>Contact</H2>
      <p>
        Kokolett Beauty UK
        {settings?.address_line ? `, ${settings.address_line}` : ''}.{' '}
        <a
          href={`mailto:${SALON_EMAIL}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {SALON_EMAIL}
        </a>
        {settings?.phone ? ` · ${settings.phone}` : ''}
      </p>
    </LegalPage>
  );
}

export function BookingPolicyPage(): JSX.Element {
  const { settings } = useBusinessSettings();
  const window = settings?.cancellation_window_h ?? 24;
  const lead = settings?.lead_time_min ?? 120;

  return (
    <LegalPage title="Booking policy" updated="August 2026">
      <H2>Booking</H2>
      <p>
        Every time shown on the booking page is genuinely free, the salon publishes the
        times she can work, and a time disappears the moment somebody takes it. Your
        booking is confirmed straight away; there is nothing to wait for.
      </p>
      <p>
        Appointments cannot be booked less than{' '}
        {lead >= 60 ? `${Math.round(lead / 60)} hours` : `${lead} minutes`} in advance, so
        the salon has notice to prepare.
      </p>

      <H2>Changing or cancelling</H2>
      <p>
        You can change or cancel your own appointment at any time from the link in your
        confirmation email, or from{' '}
        <Link
          to={routes.customer.home}
          className="underline underline-offset-4 hover:text-foreground"
        >
          My bookings
        </Link>
        . No phone call, no waiting for a reply.
      </p>
      <p>
        Please give at least <strong>{window} hours&rsquo; notice</strong> where you can.
        Later changes are still accepted, we would much rather know than have you not turn
        up, but the salon is told, because a short-notice gap is difficult to fill.
      </p>
      <p>
        When you move an appointment you keep the original until you have chosen a new
        time. If somebody takes the new time first, nothing is lost and your existing
        booking stands.
      </p>

      <H2>If you cannot find a time</H2>
      <p>
        Tell us when suits using{' '}
        <Link
          to={routes.public.requestAvailability}
          className="underline underline-offset-4 hover:text-foreground"
        >
          ask for a time
        </Link>
        . Requests are answered in the order they arrive, so if somebody cancels, the
        person who asked first is offered the slot.
      </p>

      <H2>Running late</H2>
      <p>
        Please call if you are delayed. Appointments are one after another, so a late
        start may mean a shorter appointment or having to rebook.
      </p>

      <H2>Payment</H2>
      <p>
        Nothing is taken online and no deposit is required. Payment is settled in the
        salon.
      </p>
    </LegalPage>
  );
}

export function TermsPage(): JSX.Element {
  const { settings } = useBusinessSettings();

  return (
    <LegalPage title="Terms of use" updated="August 2026">
      <p>
        These terms cover using this website. They are not the whole relationship between
        you and the salon, what happens at your appointment is a matter of ordinary
        consumer law, and nothing here reduces your statutory rights.
      </p>

      <H2>Who we are</H2>
      <p>
        Kokolett Beauty UK, a women&rsquo;s hair salon
        {settings?.address_line
          ? ` at ${settings.address_line}`
          : ' in the United Kingdom'}
        . Contact us at{' '}
        <a
          href={`mailto:${SALON_EMAIL}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {SALON_EMAIL}
        </a>
        .
      </p>

      <H2>Using this site</H2>
      <p>
        Please book only appointments you intend to keep, and give real contact details, a
        booking under a false name takes a slot from somebody who wanted it. We may cancel
        a booking that appears not to be genuine.
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
        The words and design of this site belong to Kokolett Beauty UK. Reviews shown on
        the site belong to the people who wrote them.
      </p>

      <H2>Changes</H2>
      <p>We may update these terms. The date at the top shows when they last changed.</p>

      <H2>Law</H2>
      <p>These terms are governed by the law of England and Wales.</p>
    </LegalPage>
  );
}
