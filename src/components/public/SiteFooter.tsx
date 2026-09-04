import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { HoursLine } from '@/hooks/useUsualHours';
import { CONTACT_EMAIL } from '@/lib/business';
import type { BookingSettings } from '@/types';

interface SiteFooterProps {
  settings: BookingSettings | null;
  hours: HoursLine[];
  mapUrl: string | null;
  displayAddressLines: string[];
  whatsappUrl: string | null;
  instagramUrl: string | null;
  googleProfileUrl: string | null;
}

/**
 * Footer details come from settings, so an address or a phone number changes
 * without a deploy. Anything the owner has not filled in is left out entirely
 * rather than shown as an empty row.
 */
export function SiteFooter({
  settings,
  hours,
  mapUrl,
  displayAddressLines,
  whatsappUrl,
  instagramUrl,
  googleProfileUrl,
}: SiteFooterProps): JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-[1.2fr_1fr_1fr] lg:grid-cols-[1.2fr_1.15fr_.85fr_.85fr]">
          {/* Who we are, and how to reach us. */}
          <div>
            <p className="font-serif text-lg font-semibold text-foreground">
              Kokolett <span className="text-primary">Beauty</span> UK
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A women&rsquo;s hair salon in Thamesmead, South East London. Braids, twists,
              weaves, natural hair and colour.
            </p>

            <address className="mt-6 space-y-4 text-sm not-italic">
              {displayAddressLines.length > 0 && mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  {displayAddressLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </a>
              )}
              {settings?.phone && (
                <p>
                  <span className="text-muted-foreground">Mobile: </span>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, '')}`}
                    className="text-foreground hover:text-primary"
                  >
                    {settings.phone}
                  </a>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Email: </span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-foreground hover:text-primary"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </address>

            <div className="mt-6 flex items-center gap-4">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Message Kokolett Beauty on WhatsApp"
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M12 2.2c-5.4 0-9.8 4.4-9.8 9.8 0 1.7.5 3.4 1.3 4.8l-1.4 5 5.2-1.4c1.4.8 3 1.2 4.7 1.2 5.4 0 9.8-4.4 9.8-9.8s-4.4-9.6-9.8-9.6zm5.6 13.9c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.2-.7-2.7-1-4.4-3.8-4.6-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.4.7-.8.9-1.1 1.3-.1.2-.3.3-.1.6.7 1.2 1.4 1.9 2.5 2.6.4.2.6.2.8-.1.2-.3.7-.9.9-1.2.2-.3.4-.2.6-.1.6.3 1.9.9 2.2 1.1.3.1.5.2.6.3.1.2.1.9-.1 1.5z" />
                  </svg>
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kokolett Beauty on Instagram"
                  className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              {googleProfileUrl && (
                <a
                  href={googleProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kokolett Beauty reviews on Google"
                  className="grid h-9 w-9 place-items-center rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29A11.94 11.94 0 000 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
                    />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Opening hours, from the weekly pattern the owner publishes. */}
          {hours.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Opening hours</h3>
              <dl className="mt-5 space-y-3 text-sm">
                {hours.map((line) => (
                  <div key={line.days} className="flex items-baseline gap-6">
                    <dt className="whitespace-nowrap text-muted-foreground">
                      {line.days}
                    </dt>
                    <dd
                      className={cn(
                        'whitespace-nowrap',
                        line.hours ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {line.hours ?? 'Closed'}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Some days differ.{' '}
                <Link
                  to={routes.public.book}
                  className="text-foreground underline underline-offset-4"
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
            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <Link
                  to={routes.public.about}
                  className="text-muted-foreground hover:text-foreground"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.gallery}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Gallery
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.services}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.testimonials}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Testimonials
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.faqs}
                  className="text-muted-foreground hover:text-foreground"
                >
                  FAQs
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.contact}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Where visitors actually want to go next. */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bookings</h3>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li>
                <Link
                  to={routes.public.book}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Book an appointment
                </Link>
              </li>
              <li>
                <Link
                  to={routes.customer.home}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change or cancel
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.requestAvailability}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Ask for a time
                </Link>
              </li>
              <li>
                <Link
                  to={routes.public.bookingPolicy}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Booking policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>&copy; {year} Kokolett Beauty UK. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to={routes.public.privacy} className="hover:text-foreground">
              Privacy
            </Link>
            <Link to={routes.public.terms} className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
