import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useUsualHours } from '@/hooks/useUsualHours';

const SALON_EMAIL = 'booking@kokolettbeauty.com';

/**
 * The public site chrome.
 *
 * The nav carries two text links and one button. Booking used to appear twice,
 * once as a link and again as a button beside it, which reads as a mistake
 * rather than emphasis. It is now the button only, and the button is the single
 * strongest thing in the header.
 *
 * Footer details come from settings, so an address or a phone number changes
 * without a deploy. Anything the owner has not filled in is left out entirely
 * rather than shown as an empty row.
 */
export function SiteShell({ children }: { children: ReactNode }): JSX.Element {
  const { settings } = useBusinessSettings();
  const { lines: hours } = useUsualHours();
  const year = new Date().getFullYear();

  // On a phone the wordmark is the way home, so the Home link is hidden there
  // rather than left to wrap the header onto two lines.
  const links = [
    { to: routes.public.home, label: 'Home', phone: false },
    { to: routes.customer.home, label: 'My bookings', phone: true },
  ];

  const mapUrl = settings?.address_line
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `Kokolett Beauty UK, ${settings.address_line}`,
      )}`
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-sticky border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 md:gap-4 md:px-6 md:py-4">
          <Link
            to={routes.public.home}
            className="whitespace-nowrap font-serif text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-lg"
          >
            Kokolett <span className="text-primary">Beauty</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-0.5 md:gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === routes.public.home}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium md:px-3',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    link.phone ? 'inline-flex' : 'hidden md:inline-flex',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              to={routes.public.book}
              className="ml-1 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            >
              Book
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
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
