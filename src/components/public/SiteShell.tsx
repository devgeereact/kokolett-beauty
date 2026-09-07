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
import { ConsentBanner } from '@/components/public/ConsentBanner';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useFocusTrap, FOCUSABLE_SELECTOR } from '@/hooks/useFocusTrap';
import { useUsualHours } from '@/hooks/useUsualHours';
import { toWhatsAppLink } from '@/lib/whatsapp';
import { splitAddressLines } from '@/lib/format';
import { INSTAGRAM_URL, buildGoogleProfileUrl, buildMapUrl } from '@/lib/business';
import { publicButton } from '@/components/ui/controlClasses';

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
     so closing the menu landed the customer somewhere they had not chosen.

     Opening focus is placed inside the panel for the same reason
     `DashboardLayout` does it: `aria-modal` is a promise to a screen reader,
     and `useFocusTrap` only wraps Tab once focus is ALREADY inside. Without
     this, focus stayed on the Menu button behind the overlay and the first
     Tab went on into the obscured page. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    /* Captured now rather than read in the cleanup: by the time the cleanup
       runs the ref may point at a different node, or none. */
    const trigger = menuButtonRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const panel = menuPanelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel)?.focus();
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
    <div className="flex min-h-screen-app flex-col bg-background">
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
                      ? 'text-brand-ink'
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
                    ? 'text-brand-ink'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              My bookings
            </NavLink>
            <Link
              to={routes.public.book}
              className={cn(publicButton(), 'ml-1 px-4 text-sm')}
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
          tabIndex={-1}
          /* `overflow-y-auto` and the safe-area padding are both about the
             short viewport: in landscape on a phone the six links plus the
             booking button are taller than the screen, and with no scroll of
             its own the Book button — the whole point of the menu — was
             unreachable. The inset padding keeps the close button clear of a
             notch and the CTA clear of the home indicator. */
          className="overlay-pad-safe fixed inset-0 z-drawer flex flex-col overflow-y-auto overscroll-contain bg-background lg:hidden"
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
          {/* `NavLink`, not `Link`: the desktop bar has always marked the
              current page and the mobile menu never did, so on a phone the
              menu could not tell you where you were — no `aria-current` for a
              screen reader and no visible cue for anyone else. */}
          <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
            {PAGES.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === routes.public.home}
                onClick={closeMenu}
                className={({ isActive }) =>
                  cn(
                    'border-b border-border py-3.5 font-serif text-2xl font-semibold',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'text-brand-ink' : 'text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <NavLink
              to={routes.customer.home}
              onClick={closeMenu}
              className={({ isActive }) =>
                cn(
                  'py-3.5 text-sm font-medium',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'text-brand-ink' : 'text-muted-foreground',
                )
              }
            >
              My bookings
            </NavLink>
          </nav>
          <Link
            to={routes.public.book}
            onClick={closeMenu}
            className={cn(publicButton(), 'mt-6 h-12 px-8 text-base')}
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

      {/* Public chrome only. The dashboard fires no product events, and the
          owner is not the person the banner is asking. */}
      <ConsentBanner />
    </div>
  );
}
