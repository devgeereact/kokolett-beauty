import { useState, type JSX, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useUsualHours } from '@/hooks/useUsualHours';
import { toWhatsAppLink } from '@/lib/whatsapp';

const SALON_EMAIL = 'booking@kokolettbeauty.com';

/** The site's real pages, in nav order — reinstated 2026-08-25 (marketing
    rebrand). `My bookings` stays separate: it's a customer utility, not a
    marketing page, so it doesn't belong in the same list. */
const PAGES = [
  { to: routes.public.home, label: 'Home' },
  { to: routes.public.about, label: 'About' },
  { to: routes.public.gallery, label: 'Gallery' },
  { to: routes.public.services, label: 'Services' },
  { to: routes.public.testimonials, label: 'Testimonials' },
  { to: routes.public.faqs, label: 'FAQs' },
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
  const year = new Date().getFullYear();
  const [menuOpen, setMenuOpen] = useState(false);

  const mapUrl = settings?.address_line
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `Kokolett Beauty UK, ${settings.address_line}`,
      )}`
    : null;
  const whatsappUrl = toWhatsAppLink(settings?.phone ?? null);

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
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
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
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
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
        <div className="fixed inset-0 z-drawer flex flex-col bg-background p-5 lg:hidden">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
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
                onClick={() => setMenuOpen(false)}
                className="border-b border-border py-3.5 font-serif text-2xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to={routes.customer.home}
              onClick={() => setMenuOpen(false)}
              className="py-3.5 text-sm font-medium text-muted-foreground"
            >
              My bookings
            </Link>
          </nav>
          <Link
            to={routes.public.book}
            onClick={() => setMenuOpen(false)}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-semibold text-primary-foreground"
          >
            Book an appointment
          </Link>
        </div>
      )}

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr] lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
            {/* Who we are, and how to reach us. */}
            <div>
              <p className="font-serif text-lg font-semibold text-foreground">
                Kokolett <span className="text-primary">Beauty</span> UK
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                A women&rsquo;s hair salon in South East London. Braids, locs, weaves,
                natural hair and colour.
              </p>

              <address className="mt-5 space-y-2 text-sm not-italic">
                {settings?.address_line && mapUrl && (
                  <p>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                    >
                      {settings.address_line}
                    </a>
                  </p>
                )}
                {settings?.phone && (
                  <p>
                    <a
                      href={`tel:${settings.phone.replace(/\s/g, '')}`}
                      className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                    >
                      {settings.phone}
                    </a>
                  </p>
                )}
                <p>
                  <a
                    href={`mailto:${SALON_EMAIL}`}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    {SALON_EMAIL}
                  </a>
                </p>
              </address>

              <div className="mt-5 flex items-center gap-2">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Message Kokolett Beauty on WhatsApp"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 1.7.5 3.4 1.3 4.8l-1.4 5 5.2-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.6-9.8-9.6zm5.6 13.9c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.2-.7-2.7-1-4.4-3.8-4.6-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.4.7-.8.9-1.1 1.3-.1.2-.3.3-.1.6.7 1.2 1.4 1.9 2.5 2.6.4.2.6.2.8-.1.2-.3.7-.9.9-1.2.2-.3.4-.2.6-.1.6.3 1.9.9 2.2 1.1.3.1.5.2.6.3.1.2.1.9-.1 1.5z" />
                    </svg>
                  </a>
                )}
                {settings?.instagram_url && (
                  <a
                    href={settings.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Kokolett Beauty on Instagram"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 fill-current"
                      aria-hidden="true"
                    >
                      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zm0 3.2A6.6 6.6 0 1018.6 12 6.6 6.6 0 0012 5.4zm0 10.9A4.3 4.3 0 1116.3 12 4.3 4.3 0 0112 16.3zm6.9-11.2a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5z" />
                    </svg>
                  </a>
                )}
                {settings?.google_review_url && (
                  <a
                    href={settings.google_review_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Kokolett Beauty reviews on Google"
                    className="grid h-11 w-11 place-items-center rounded-lg border border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 fill-current"
                      aria-hidden="true"
                    >
                      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Opening hours, from the weekly pattern the owner publishes. */}
            {hours.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Opening hours</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  {hours.map((line) => (
                    <div key={line.days} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{line.days}</dt>
                      <dd
                        className={cn(
                          'text-right',
                          line.hours ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {line.hours ?? 'Closed'}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Some days differ.{' '}
                  <Link
                    to={routes.public.book}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    See what is open
                  </Link>
                  .
                </p>
              </div>
            )}

            {/* The rest of the site. */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Salon</h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    to={routes.public.about}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.gallery}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Gallery
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.services}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Services
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.testimonials}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Testimonials
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.faqs}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.contact}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Where visitors actually want to go next. */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Bookings</h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    to={routes.public.book}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Book an appointment
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.customer.home}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Change or cancel
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.requestAvailability}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Ask for a time
                  </Link>
                </li>
                <li>
                  <Link
                    to={routes.public.bookingPolicy}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    Booking policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>&copy; {year} Kokolett Beauty UK. All rights reserved.</p>
            <nav
              aria-label="Legal"
              className="flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              <Link to={routes.public.privacy} className="hover:text-foreground">
                Privacy
              </Link>
              <Link to={routes.public.terms} className="hover:text-foreground">
                Terms
              </Link>
              <Link to="/login" className="hover:text-foreground">
                Salon sign in
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
