import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalHeading as H2, LegalLink } from '@/components/public/LegalPage';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { routes } from '@/lib/routes';
import { CONTACT_EMAIL, OWNER_NAME } from '@/lib/business';

/**
 * How to complain and where it goes next.
 *
 * Two escalation routes, kept apart on purpose: the ICO handles anything about
 * personal data, and it has no say over a haircut. Consumer advice handles the
 * service. Conflating them sends people to the wrong place and wastes weeks.
 */
export function ComplaintsPage(): JSX.Element {
  const { settings } = useBusinessSettings();

  return (
    <LegalPage
      title="Complaints"
      updated="September 2026"
      description="How to raise a problem with Kokolett Beauty UK, how long we take to reply, and where to go if you are still unhappy."
      path={routes.public.complaints}
    >
      <p>
        If something has gone wrong, please tell us. A small salon would far rather hear
        it and put it right than have you leave unhappy and say nothing.
      </p>

      <H2>Tell us first</H2>
      <p>
        If it is about your hair, say so at the appointment if you can, or as soon after
        as possible. Most things can be put right quickly, and it is much easier while the
        work is fresh.
      </p>
      <p>
        Otherwise, email{' '}
        <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        {settings?.phone ? ` or call ${settings.phone}` : ''}. Please include the date of
        your appointment and what happened. Photographs help if it is about the work
        itself.
      </p>

      <H2>What happens then</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>{OWNER_NAME} will acknowledge your message within three working days.</li>
        <li>
          She will give you a proper answer within fourteen days, or tell you why it is
          taking longer.
        </li>
        <li>
          Complaints go to her directly. There is nobody else in the salon they pass
          through.
        </li>
      </ul>

      <H2>If you are still not happy about the service</H2>
      <p>
        You have rights under the Consumer Rights Act 2015, which says a service must be
        carried out with reasonable care and skill. If we cannot resolve it between us,
        free and independent advice is available from Citizens Advice at{' '}
        <LegalLink href="https://www.citizensadvice.org.uk">
          citizensadvice.org.uk
        </LegalLink>
        , who can also refer the matter to Trading Standards.
      </p>

      <H2>If it is about your personal information</H2>
      <p>
        Anything about the information the salon holds about you, how it was used or a
        request we did not answer, is covered by the{' '}
        <Link
          to={routes.public.privacy}
          className="underline underline-offset-4 hover:text-foreground"
        >
          privacy notice
        </Link>
        . Please raise it with us the same way, and if you are not satisfied you can
        complain to the Information Commissioner&rsquo;s Office at{' '}
        <LegalLink href="https://ico.org.uk">ico.org.uk</LegalLink>. You do not have to
        come to us first.
      </p>

      <H2>If it is about the website</H2>
      <p>
        Something you cannot use or reach on the site belongs on the{' '}
        <Link
          to={routes.public.accessibility}
          className="underline underline-offset-4 hover:text-foreground"
        >
          accessibility
        </Link>{' '}
        page, which has its own reporting route and reply time.
      </p>
    </LegalPage>
  );
}
