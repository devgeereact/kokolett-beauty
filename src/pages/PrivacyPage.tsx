import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalHeading as H2, LegalLink } from '@/components/public/LegalPage';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';
import { CONTACT_EMAIL, OWNER_NAME } from '@/lib/business';

/**
 * The privacy notice.
 *
 * Written to describe what this application actually does, not from a
 * template. Every claim here is checkable against the code: the data listed is
 * the data the schema stores, the supplier list is every service the app
 * actually talks to, the retention story matches the purge jobs in migrations
 * `0042` and `0046`, and the device-storage detail lives on `/cookies` with
 * the rest of the inventory.
 *
 * Where a fact belongs to the business rather than the software, an ICO
 * registration number for instance, the page leaves it out instead of
 * inventing it. A privacy notice with a made-up registration number is worse
 * than none.
 */
export function PrivacyPage(): JSX.Element {
  const { settings } = useBusinessSettings();

  return (
    <LegalPage
      title="Privacy"
      updated="September 2026"
      description="How Kokolett Beauty UK handles your personal information, what is stored, who sees it, and how to have it removed."
      path={routes.public.privacy}
    >
      <p>
        Kokolett Beauty UK is a single-owner women&rsquo;s hair salon. This page explains
        exactly what we hold about you, why, who else sees it, and how to get rid of it.
        It describes what the booking system actually does rather than what a template
        says.
      </p>

      <H2>Who we are</H2>
      <p>
        {OWNER_NAME} runs the salon as a sole trader, trading as Kokolett Beauty UK. She
        is the data controller for everything described here, which means she decides what
        is collected and why, and she is the person to ask about it. There is no company
        number because this is not a registered company.
      </p>
      <p>
        Kokolett Beauty UK
        {settings?.address_line ? `, ${settings.address_line}` : ''}.{' '}
        <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        {settings?.phone ? ` · ${settings.phone}` : ''}
      </p>

      <H2>What we collect</H2>
      <p>Different parts of the site ask for different things. This is all of it.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>When you book:</strong> your name, email address and mobile number,
          anything you type into the &ldquo;what are you after&rdquo; box, the
          appointments you have made, and whether you ticked the box to receive occasional
          news.
        </li>
        <li>
          <strong>When you ask for a time that is not shown:</strong> your name, email
          address, mobile number, the dates and times that would suit you, and any note
          you add.
        </li>
        <li>
          <strong>When you use the contact form:</strong> your name, email address and
          your message.
        </li>
        <li>
          <strong>When you join the mailing list:</strong> your email address and, if you
          give it, your name.
        </li>
        <li>
          <strong>After your appointment:</strong> what was paid, so the salon has a
          record of its own takings.
        </li>
        <li>
          <strong>Notes the salon keeps:</strong> {OWNER_NAME} can write a private note
          against your record, the sort of thing a stylist keeps in a card index. It is
          for looking after you properly and only she can see it. See the next section,
          because those notes sometimes contain health information.
        </li>
      </ul>
      <p>
        We do not ask for a date of birth, a home address or payment card details, and
        there is no account or password to create.
      </p>

      <H2>Allergies and anything about your health</H2>
      <p>
        If you tell the salon about an allergy, a scalp condition or a reaction to a
        product, that is health information, and data protection law treats it as a
        special category needing extra care. {OWNER_NAME} records it because working on
        your hair without it would not be safe, particularly for colour. It is kept in the
        same private note described above, it is never used for marketing, and it is not
        shared with anyone.
      </p>
      <p>
        You do not have to tell her anything. If you would rather she did not keep a note
        of it, say so and she will not, but she may then decline a service where knowing
        matters.
      </p>

      <H2>Why we need it, and on what basis</H2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Your <strong>name and email</strong> identify the booking and carry your
          confirmation, reminders and any change to your appointment. The basis is
          performing the appointment you asked for.
        </li>
        <li>
          Your <strong>mobile number</strong> is so the salon can reach you if something
          changes at short notice, a phone call is faster than an email when it matters.
          Same basis.
        </li>
        <li>
          Your <strong>note</strong> tells the salon what to prepare before you arrive.
          Same basis.
        </li>
        <li>
          Your <strong>message</strong> through the contact form is answered because you
          asked a question. Same basis.
        </li>
        <li>
          <strong>Payment records</strong> are kept because a business has to be able to
          account for its takings. The basis is a legal obligation.
        </li>
        <li>
          <strong>Marketing email</strong> only ever goes to people who explicitly asked
          for it. The basis is your consent, and you can take it back at any time.
        </li>
        <li>
          <strong>Health information</strong> is kept with your explicit agreement, given
          when you tell the salon about it, so that a service can be carried out safely.
        </li>
      </ul>

      <H2>Who else sees it</H2>
      <p>
        The salon owner. Nobody else has an account on this system. Behind the scenes the
        site relies on these suppliers, and this is the whole list:
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Supabase</strong> hosts the database, in their London region. Your
          booking details stay in the United Kingdom.
        </li>
        <li>
          <strong>Our email host</strong> delivers confirmations, reminders and any
          message the salon sends you, from {CONTACT_EMAIL}.
        </li>
        <li>
          <strong>Cloudflare</strong> sits in front of the website and handles the
          connection between your browser and us.
        </li>
        <li>
          <strong>Sentry</strong> records technical errors so faults get fixed. Reports
          are stored in the European Union. When an error happens it may also record a
          picture of what the page looked like, with all text hidden and images blocked,
          so what reaches Sentry is a shape rather than your words.
        </li>
        <li>
          <strong>ImageKit</strong> delivers the photographs on the site.
        </li>
        <li>
          <strong>Google</strong> serves the typefaces the site is set in, which means
          your browser asks Google for them and Google sees your IP address. Google also
          supplies the public reviews shown on the home page.
        </li>
        <li>
          <strong>OpenRouter</strong> runs the language model behind the salon&rsquo;s
          assistant, described in the next section. It is the one supplier here that can
          be given your name and the words you wrote, and it is outside the United
          Kingdom.
        </li>
      </ul>
      <p>
        We do not sell your details, share them with advertisers, or use them to build a
        profile of you.
      </p>

      <H2>The salon&rsquo;s assistant</H2>
      <p>
        {OWNER_NAME} has a private assistant inside her own dashboard that helps her run
        the salon and word replies. Two things about it are worth being plain about.
      </p>
      <p>
        When she asks it about the day ahead or about her customers, it is sent the
        relevant records, which can include your name, your appointment and what you have
        spent. When she asks it to help word a reply to something you sent, it is sent
        your message and your name so the reply makes sense. That text goes to OpenRouter
        outside the United Kingdom, is used only to produce that answer, and is not used
        to make any decision about you.
      </p>
      <p>
        The assistant cannot do anything on its own. It can suggest a booking or a
        message, but nothing is created or sent until {OWNER_NAME} reads it and presses
        the button herself.
      </p>

      <H2>Reviews shown on this site</H2>
      <p>
        The reviews on our home page come from our public Google Business listing. We keep
        a copy so the page loads quickly, but we do not collect them and cannot edit them,
        they belong to the people who wrote them and to Google.
      </p>

      <H2>How long we keep it</H2>
      <p>
        Appointment history is kept as the salon&rsquo;s business record. If you ask us to
        erase your details, we remove your name, contact details and any private note, and
        you become an anonymous entry in that history, the appointment itself has to
        survive for the salon&rsquo;s accounts. If you book again afterwards you arrive as
        a completely new customer.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Sign-in links expire after 30&nbsp;minutes, work once, and are deleted daily.
        </li>
        <li>
          Sent email and any availability request you raised are deleted automatically
          after two years.
        </li>
        <li>
          The record of who changed what in the dashboard is deleted after two years.
        </li>
        <li>
          Your mailing list entry stays until you unsubscribe, and unsubscribing is
          permanent unless you ask to be put back.
        </li>
      </ul>

      <H2>Your rights</H2>
      <p>Under UK data protection law you can ask us to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>give you a copy of what we hold about you,</li>
        <li>correct anything that is wrong,</li>
        <li>erase your details,</li>
        <li>stop using them for a particular purpose, or pause while we look into it,</li>
        <li>hand your details to you in a portable form,</li>
        <li>and stop sending you marketing, at any time and without giving a reason.</li>
      </ul>
      <p>
        Email <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink> and
        we will deal with it within one month. We may ask a question to check we are
        talking to the right person before sending anything out, but we will not ask you
        for identity documents by email.
      </p>
      <p>
        Nothing here is decided about you automatically. Every booking, every reply and
        every decision is made by a person.
      </p>

      <H2>What is stored on your device</H2>
      <p>
        This site sets no cookies. It does keep a small number of things in your own
        browser, most of them needed to make the site work at all, and one optional item
        you are asked about. The full list, what each one is for and how to change your
        mind are on the{' '}
        <Link
          to={routes.public.cookies}
          className="underline underline-offset-4 hover:text-foreground"
        >
          cookies and storage
        </Link>{' '}
        page.
      </p>

      <H2>Children</H2>
      <p>
        This site is meant for adults. If you are under 18 and want an appointment, please
        ask a parent or guardian to book it and to come with you, so they know what has
        been agreed.
      </p>

      <H2>If you are unhappy</H2>
      <p>
        Please tell us first, the{' '}
        <Link
          to={routes.public.complaints}
          className="underline underline-offset-4 hover:text-foreground"
        >
          complaints
        </Link>{' '}
        page explains how. If you are still unhappy with how we have handled your
        information you can complain to the Information Commissioner&rsquo;s Office at{' '}
        <LegalLink href="https://ico.org.uk">ico.org.uk</LegalLink>. You do not have to
        come to us first, but it usually gets things sorted faster.
      </p>

      <H2>Changes</H2>
      <p>
        We update this page when what we do changes. The date at the top shows when it
        last changed.
      </p>
    </LegalPage>
  );
}
