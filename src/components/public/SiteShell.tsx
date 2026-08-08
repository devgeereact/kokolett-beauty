import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useUsualHours } from '@/hooks/useUsualHours';

const SALON_EMAIL = 'booking@koko.gakinz.com';

/**
 * The public site chrome.
 *
 * Editorial rather than utilitarian: generous whitespace, serif headings, one
 * primary action (docs/DESIGN.md §1). The nav stays the three things a visitor
 * wants — see the salon, book, find an existing booking — with the booking
 * action promoted to a button so it is never the thing they have to hunt for.
 *
 * Footer contact details come from settings rather than being hard-coded, so
 * the owner can change an address or a phone number without a deploy. Anything
 * she has not filled in is simply absent, which reads better than a placeholder.
 */
export function SiteShell({ children }: { children: ReactNode }): JSX.Element {
  const { settings } = useBusinessSettings();
  const { lines: hours } = useUsualHours();
  const year = new Date().getFullYear();

  const links = [
    { to: routes.public.home, label: 'Home' },
    { to: routes.public.book, label: 'Book' },
    { to: routes.customer.home, label: 'My bookings' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to={routes.public.home}
            className="font-display text-lg font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Kokolett <span className="text-primary">Beauty</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === routes.public.home}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2 py-2 text-sm font-medium sm:px-3',
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
            <Link
              to={routes.public.book}
              className="ml-1 hidden h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              Book now
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-display text-lg font-semibold text-foreground">
                Kokolett <span className="text-primary">Beauty</span> UK
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A women&rsquo;s hair salon — cutting, colouring, styling and treatments,
                booked online in under two minutes.
              </p>
              {settings?.address_line && (
                <p className="mt-3 text-sm">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `Kokolett Beauty UK, ${settings.address_line}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    {settings.address_line}
                  </a>
                </p>
              )}
            </div>

            {hours.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-foreground">Usual hours</h2>
                <dl className="mt-3 space-y-1 text-sm">
                  {hours.map((line) => (
                    <div key={line.days} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{line.days}</dt>
                      <dd
                        className={
                          line.hours ? 'text-foreground' : 'text-muted-foreground'
                        }
                      >
                        {line.hours ?? 'Closed'}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  Individual days can differ —{' '}
                  <Link
                    to={routes.public.book}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    check what is open
                  </Link>
                  .
                </p>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold text-foreground">Get in touch</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href={`mailto:${SALON_EMAIL}`}
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    {SALON_EMAIL}
                  </a>
                </li>
                {settings?.phone && (
                  <li>
                    <a
                      href={`tel:${settings.phone.replace(/\s/g, '')}`}
                      className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      {settings.phone}
                    </a>
                  </li>
                )}
                <li>
                  <Link
                    to={routes.public.requestAvailability}
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Ask for a time
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground">Find us</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {settings?.google_review_url && (
                  <li>
                    <a
                      href={settings.google_review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 fill-current"
                        aria-hidden="true"
                      >
                        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                      </svg>
                      Reviews on Google
                    </a>
                  </li>
                )}
                {settings?.instagram_url && (
                  <li>
                    <a
                      href={settings.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4 fill-current"
                        aria-hidden="true"
                      >
                        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zm0 3.2A6.6 6.6 0 1018.6 12 6.6 6.6 0 0012 5.4zm0 10.9A4.3 4.3 0 1116.3 12 4.3 4.3 0 0112 16.3zm6.9-11.2a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5z" />
                      </svg>
                      Instagram
                    </a>
                  </li>
                )}
                <li className="pt-1 text-muted-foreground">United Kingdom</li>
                <li className="text-muted-foreground">
                  All times {settings?.timezone ?? 'Europe/London'}
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border pt-6 text-xs text-muted-foreground">
            <p>&copy; {year} Kokolett Beauty UK. All rights reserved.</p>
            <nav
              aria-label="Legal"
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <Link
                to={routes.public.privacy}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                to={routes.public.bookingPolicy}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Booking policy
              </Link>
              <Link
                to={routes.public.terms}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                to="/login"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Salon sign in
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
