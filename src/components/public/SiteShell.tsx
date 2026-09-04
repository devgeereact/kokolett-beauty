import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { SiteFooter } from '@/components/public/SiteFooter';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useUsualHours } from '@/hooks/useUsualHours';
import { toWhatsAppLink } from '@/lib/whatsapp';
import { splitAddressLines } from '@/lib/format';
import { INSTAGRAM_URL, buildGoogleProfileUrl, buildMapUrl } from '@/lib/business';

/** The site's real pages, in nav order — reinstated 2026-08-25 (marketing
    rebrand). `My bookings` stays separate: it's a customer utility, not a
    marketing page, so it doesn't belong in the same list.
    FAQs is deliberately not in this list (2026-08-25): it stays reachable
    from the footer and directly at `/faqs`, just not in the header/mobile
    nav, which the owner wanted kept to the pages people look for first. */
const PAGES = [
  { to: routes.public.home, label: 'Home' },
  { to: routes.public.about, label: 'About' },
  { to: routes.public.gallery, label: 'Gallery' },
  { to: routes.public.services, label: 'Services' },
  { to: routes.public.testimonials, label: 'Testimonials' },
  { to: routes.public.contact, label: 'Contact' },
];

/**
 * The public site chrome.
 *
 * A real multi-page nav now that the marketing site is one (2026-08-25) —
 * the desktop bar shows every page, a mobile hamburger opens the same list
 * full-screen. Booking is still the one button in the header; it doesn't
 * also appear as a text link beside it, which would read as a mistake
 * rather than emphasis.
 *
 * Footer details come from settings, so an address or a phone number changes
 * without a deploy. Anything the owner has not filled in is left out entirely
 * rather than shown as an empty row.
 */
export function SiteShell({ children }: { children: ReactNode }): JSX.Element {
  const { settings } = useBusinessSettings();
  const { lines: hours } = useUsualHours();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  /* The dashboard's drawer got a trap when `useFocusTrap` was extracted; this
     one did not, and it is the overlay a customer on a phone actually meets.
     Without it Tab walked straight out of the full-screen panel into the page
     underneath — which is still rendered and still focusable — so a keyboard
     or screen-reader user was tabbing through invisible links with no way to
     tell where they were, and Escape did nothing. */
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useFocusTrap(menuOpen, menuPanelRef, closeMenu);

  /* Close on navigation. Every link already calls `closeMenu`, but the browser
     Back button and any programmatic navigation do not, and a menu left open
     over the page it navigated to reads as a frozen app. */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /* Return focus to the trigger, and stop the page behind scrolling under the
     overlay: on iOS a scroll gesture over a `fixed` overlay scrolls the body,
     so closing the menu landed the customer somewhere they had not chosen. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    /* Captured now rather than read in the cleanup: by the time the cleanup
       runs the ref may point at a different node, or none. */
    const trigger = menuButtonRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, [menuOpen]);

  const mapUrl = settings?.address_line ? buildMapUrl(settings.address_line) : null;
  /* The footer icon sits in the social row next to Instagram, so it has to go
     to the profile. `google_review_url` is the write-a-review dialog. */
  /* Falls back to the constant the structured data's `sameAs` uses. Reading
     only from settings meant clearing that field hid the footer icon while
     index.html still asserted the profile, which is the identity split this
     module exists to close. */
  const instagramUrl = settings?.instagram_url ?? INSTAGRAM_URL;
  const googleProfileUrl =
    buildGoogleProfileUrl(settings?.google_place_id) ??
    settings?.google_review_url ??
    null;
  const whatsappUrl = toWhatsAppLink(settings?.phone ?? null);

  /* Street / city / postcode, one per line, with "United Kingdom" appended
     to the city line — the country never changes, so it is added here
     rather than asking the owner to type it into `address_line` herself. */
  const addressLines = settings?.address_line
    ? splitAddressLines(settings.address_line)
    : [];
  const cityLineIndex = addressLines.length - 2;
  const displayAddressLines = addressLines.map((line, i) =>
    i === cityLineIndex ? `${line} United Kingdom` : line,
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/*
        Skip link, matching the dashboard's, so a keyboard user lands past the
        header nav instead of tabbing through it on every page. Visually hidden
        until focused, which is the only moment it is any use.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-sticky border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <Link
            to={routes.public.home}
            /* The words live inside ONE span, which is the flex box's only item.
               Applying `inline-flex` straight to the link makes "Kokolett " and the
               coloured span two items and drops the whitespace between them — the
               wordmark rendered "KokolettBeauty", and a CSS `gap` only papers over
               it visually: `textContent` stays unspaced, so screen readers and
               copy-paste get one word. Nesting keeps normal inline flow, and the
               real space with it, while the flex box centres it against
               `min-h-touch`. */
            className="inline-flex min-h-touch items-center whitespace-nowrap font-serif text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-lg"
          >
            <span>
              Kokolett <span className="text-primary">Beauty</span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
            {PAGES.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === routes.public.home}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-touch items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 md:gap-2">
            <NavLink
              to={routes.customer.home}
              className={({ isActive }) =>
                cn(
                  'hidden min-h-touch items-center whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium md:inline-flex md:px-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              My bookings
            </NavLink>
            <Link
              to={routes.public.book}
              className="ml-1 inline-flex min-h-touch items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Book
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen(true)}
              className="ml-1 grid h-11 w-11 place-items-center rounded-full border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          ref={menuPanelRef}
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-drawer flex flex-col bg-background p-5 lg:hidden"
        >
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Close menu"
              onClick={closeMenu}
              className="grid h-11 w-11 place-items-center rounded-full border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
            {PAGES.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMenu}
                className="border-b border-border py-3.5 font-serif text-2xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={routes.customer.home}
              onClick={closeMenu}
              className="py-3.5 text-sm font-medium text-muted-foreground"
            >
              My bookings
            </Link>
          </nav>
          <Link
            to={routes.public.book}
            onClick={closeMenu}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground"
          >
            Book an appointment
          </Link>
        </div>
      )}

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <SiteFooter
        settings={settings}
        hours={hours}
        mapUrl={mapUrl}
        displayAddressLines={displayAddressLines}
        whatsappUrl={whatsappUrl}
        instagramUrl={instagramUrl}
        googleProfileUrl={googleProfileUrl}
      />
    </div>
  );
}
