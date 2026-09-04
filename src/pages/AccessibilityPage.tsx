import type { JSX } from 'react';
import { LegalPage, LegalHeading as H2, LegalLink } from '@/components/public/LegalPage';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';
import { CONTACT_EMAIL } from '@/lib/business';

/**
 * The accessibility statement.
 *
 * Claims only what has actually been verified. The automated sweep is real
 * (`e2e/marketing-site.spec.ts` runs axe against every public route, the 404
 * and the open mobile menu, on WCAG 2.2 AA rules), and the things that have
 * never been tested are named rather than quietly implied.
 */
export function AccessibilityPage(): JSX.Element {
  const { settings } = useBusinessSettings();

  return (
    <LegalPage
      title="Accessibility"
      updated="September 2026"
      description="How accessible the Kokolett Beauty UK website is, what has been tested, what has not, and how to tell us about a problem."
      path={routes.public.accessibility}
    >
      <p>
        This site should be usable by as many people as possible, including anyone using a
        keyboard on its own, a screen reader, or a large text size. This page says where
        it stands honestly, including the parts nobody has checked.
      </p>

      <H2>What we aim for</H2>
      <p>
        We aim to meet the Web Content Accessibility Guidelines version 2.2 at level AA.
        That is the standard UK public bodies are held to, and it is a sensible bar for a
        small business site as well.
      </p>

      <H2>What is built in</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Every page can be completed with a keyboard alone.</li>
        <li>
          A &ldquo;skip to content&rdquo; link appears as soon as you start tabbing, so
          you do not have to walk through the menu on every page.
        </li>
        <li>Whatever has keyboard focus shows a visible ring around it.</li>
        <li>
          Buttons and links on the booking path are at least 44 pixels across, so they can
          be hit on a phone.
        </li>
        <li>
          Status is never shown by colour alone, there is always a word alongside it.
        </li>
        <li>
          If your device is set to reduce motion, the site stops animating and moves
          straight to the end state.
        </li>
        <li>The site works at large text sizes and down to a small phone screen.</li>
        <li>
          The menu on a phone is a proper dialog: it holds focus while open, closes on
          Escape, and puts focus back where it was.
        </li>
      </ul>

      <H2>What has been tested, and how</H2>
      <p>
        An automated accessibility check runs against every public page, the page you get
        when a link is wrong, and the phone menu while it is open. It uses the axe rule
        set at WCAG 2.2 AA and runs as part of our normal checks before anything goes
        live. Automated checks find a useful share of problems, not all of them, and they
        can miss something that appears on the page a moment after it loads.
      </p>

      <H2>Problems we already know about</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          The small labels on the terracotta panel on the home page, underneath the
          numbers, are not quite light enough against their background. They are readable,
          but they fall short of the standard we aim for, and the colour is being looked
          at.
        </li>
      </ul>

      <H2>What has not been tested</H2>
      <p>
        Automated checks catch a useful share of problems, not all of them. To be plain
        about the gaps:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Nobody has been through this site with a screen reader, and no disabled person
          has been asked to try it.
        </li>
        <li>There has been no independent accessibility audit.</li>
        <li>
          The photographs on the gallery are described briefly rather than in detail.
        </li>
      </ul>
      <p>
        So we cannot claim the site is fully accessible. If something does not work for
        you, that is worth telling us about, and it is the fastest way for it to get
        fixed.
      </p>

      <H2>Telling us about a problem</H2>
      <p>
        Email <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        {settings?.phone ? ` or call ${settings.phone}` : ''} and say what you were trying
        to do and what got in the way. We will reply within five working days and tell you
        what we can do.
      </p>
      <p>
        If you cannot use the booking page at all, telephone or email the salon and your
        appointment will be booked for you. Nobody has to use the website to get an
        appointment.
      </p>

      <H2>Getting into the salon itself</H2>
      <p>
        This page is about the website. If you need to know about getting into the
        building, parking or anything else about the visit, please ask before you book and
        the salon will tell you exactly what to expect.
      </p>
    </LegalPage>
  );
}
