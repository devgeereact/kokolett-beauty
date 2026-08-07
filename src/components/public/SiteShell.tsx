import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const SALON_EMAIL = 'booking@koko.gakinz.com';

/**
 * The public site chrome. Editorial rather than utilitarian: generous
 * whitespace, serif headings, a single primary action (docs/DESIGN.md §1).
 */
export function SiteShell({ children }: { children: ReactNode }): JSX.Element {
  const links = [
    { to: routes.public.home, label: 'Home' },
    { to: routes.public.services, label: 'Services' },
    { to: routes.public.book, label: 'Book' },
    { to: routes.customer.home, label: 'My bookings' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to={routes.public.home}
            className="font-display text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Kokolett <span className="text-primary">Beauty</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === routes.public.home}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p className="font-medium text-foreground">Kokolett Beauty UK</p>
          <p className="mt-1">Women&rsquo;s hair salon · United Kingdom</p>
          <p className="mt-3">
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href={`mailto:${SALON_EMAIL}`}
            >
              {SALON_EMAIL}
            </a>
          </p>
          <p className="mt-4 text-xs">&copy; 2026 Kokolett Beauty UK</p>
        </div>
      </footer>
    </div>
  );
}
