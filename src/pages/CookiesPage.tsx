import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { LegalPage, LegalHeading as H2 } from '@/components/public/LegalPage';
import { Button } from '@/components/ui/Button';
import { useConsent } from '@/hooks/useConsent';
import { routes } from '@/lib/routes';

interface StoredItem {
  name: string;
  what: string;
  howLong: string;
}

/* Everything a visitor to the public site can end up with. The owner's
   dashboard keeps a handful of layout and format preferences as well, which
   are described in prose below rather than listed, because nobody but her ever
   meets them. */
const ESSENTIAL: StoredItem[] = [
  {
    name: 'Light or dark',
    what: 'Which version of the site you chose, so it does not flash the wrong one at you next time.',
    howLong: 'Until you clear your browser storage.',
  },
  {
    name: 'This choice',
    what: 'Whether you said yes or no on this page, so you are not asked again on every page.',
    howLong: 'Until you clear it, or change your mind below.',
  },
  {
    name: 'Your sign-in',
    what: 'If you use a sign-in link from an email, a single token so the site can show you your own bookings. Only ever created if you use one.',
    howLong: 'Until you sign out, or 30 days.',
  },
  {
    name: 'Install prompt',
    what: 'Remembers that you closed the "add this to your home screen" suggestion, so it stops asking.',
    howLong: 'Until you clear your browser storage.',
  },
  {
    name: 'Offline copy of the site',
    what: 'Pages, photographs, typefaces and the salon opening hours, saved so the site still opens on a bad connection. It holds no bookings and no customer details.',
    howLong: 'Refreshed as you browse; cleared with your browser storage.',
  },
];

const OPTIONAL: StoredItem[] = [
  {
    name: 'Booking counter',
    what: 'One random number so the salon can count how many people reach the booking page and how many finish. It holds no name, no email address and no IP address, and it cannot be linked to you or followed between visits.',
    howLong: 'Until you close the tab.',
  },
];

function StorageList({ items }: { items: StoredItem[] }): JSX.Element {
  return (
    <dl className="space-y-4">
      {items.map((item) => (
        <div key={item.name} className="border-l-2 border-border pl-4">
          <dt className="font-semibold text-foreground">{item.name}</dt>
          <dd className="mt-1">{item.what}</dd>
          <dd className="mt-1 text-xs">{item.howLong}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The cookie and browser storage notice, and the place a visitor changes
 * their mind.
 *
 * The site genuinely sets no cookies, so this page is about what it keeps in
 * browser storage instead. That distinction matters less than it sounds:
 * PECR is about storing information on someone's device however it is done,
 * which is why the one non-essential item here is behind a real choice.
 */
export function CookiesPage(): JSX.Element {
  const { decided, analytics, accept, reject } = useConsent();

  return (
    <LegalPage
      title="Cookies and storage"
      updated="September 2026"
      description="Everything Kokolett Beauty UK keeps in your browser, what each item is for, and how to change your mind."
      path={routes.public.cookies}
    >
      <p>
        This site sets no cookies. There is no advertising, no tracking across other
        websites, and no third-party analytics product. It does keep a few things in your
        own browser, and the law treats that the same way, so here is all of it.
      </p>

      <H2>Needed to make the site work</H2>
      <p>
        These are not optional, because without them the site either forgets what you
        asked for or stops working. They are never used to track you.
      </p>
      <StorageList items={ESSENTIAL} />

      <H2>Optional, and only if you say yes</H2>
      <StorageList items={OPTIONAL} />
      <p>
        Nothing is written for this unless you agree, and if you say no, or say nothing at
        all, it is never created. Saying no does not change anything else about the site.
      </p>

      <H2>Your choice</H2>
      <p>
        {!decided
          ? 'You have not chosen yet, so the booking counter is off.'
          : analytics
            ? 'You said yes to the booking counter. Thank you, it genuinely helps the salon see where the booking form loses people.'
            : 'You said no to the booking counter. Nothing is being stored for it.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={analytics ? 'secondary' : 'primary'}
          size="lg"
          onClick={reject}
          aria-pressed={decided && !analytics}
        >
          No thanks
        </Button>
        <Button
          type="button"
          variant={analytics ? 'primary' : 'secondary'}
          size="lg"
          onClick={accept}
          aria-pressed={analytics}
        >
          Yes, that is fine
        </Button>
      </div>
      <p>
        Turning it off removes what was stored for it straight away. You can change this
        as often as you like.
      </p>

      <H2>Clearing everything</H2>
      <p>
        Your browser can clear all of it at once. In most browsers it is under settings,
        then privacy, then clearing site data, and you can do it for this site alone. If
        you are signed in with a link, clearing it signs you out.
      </p>

      <H2>The salon&rsquo;s own dashboard</H2>
      <p>
        When the owner signs in to run the salon, her browser also keeps her sign-in
        session and a few layout preferences, such as whether the sidebar is collapsed and
        whether she prefers a 12 or 24 hour clock. No customer ever meets those.
      </p>

      <H2>More detail</H2>
      <p>
        What we collect, who else sees it and how long we keep it is on the{' '}
        <Link
          to={routes.public.privacy}
          className="underline underline-offset-4 hover:text-foreground"
        >
          privacy
        </Link>{' '}
        page.
      </p>
    </LegalPage>
  );
}
