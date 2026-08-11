import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/sentry';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface NavEntry {
  to: string;
  label: string;
  /** Rendered as a count beside the label; omitted when zero. */
  badge?: number;
}

/**
 * The owner shell: a persistent sidebar on desktop, a slide-over on mobile.
 *
 * The sidebar has its own colour ramp so it reads as chrome rather than
 * content (docs/DESIGN.md §3).
 */
export function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
  badges,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badges?: { approvals?: number; requests?: number };
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useSupabaseAuth();
  const navigate = useNavigate();

  const entries: NavEntry[] = [
    { to: routes.owner.dashboard, label: 'Today' },
    { to: routes.owner.calendar, label: 'Calendar' },
    { to: routes.owner.weeklyDefault, label: 'Weekly default' },
    { to: routes.owner.appointments, label: 'Appointments' },
    { to: routes.owner.requests, label: 'Requests', badge: badges?.requests },
    { to: routes.owner.customers, label: 'Customers' },
    { to: routes.owner.appointmentType, label: 'Appointment' },
    { to: routes.owner.serviceMenu, label: 'Services' },
    { to: routes.owner.settings, label: 'Settings' },
  ];

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {entries.map((entry) => (
        <NavLink
          key={entry.to}
          to={entry.to}
          end={entry.to === routes.owner.dashboard}
          onClick={() => setMenuOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )
          }
        >
          <span>{entry.label}</span>
          {entry.badge ? (
            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {entry.badge}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );

  /**
   * The signed-in address and the way out.
   *
   * Rendered in the mobile drawer as well as the desktop sidebar. It used to
   * live only inside the `hidden lg:flex` sidebar, so below that breakpoint —
   * which includes an iPad in portrait, a plausible salon device — there was no
   * way to sign out at all.
   */
  const account = (
    <div className="space-y-3 px-3">
      <p className="truncate text-xs text-sidebar-foreground" title={user?.email ?? ''}>
        {user?.email}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => {
          setMenuOpen(false);
          // Navigate whether or not the network call succeeds. `signOut()`
          // rejects when offline, and a silent no-op leaves the owner looking
          // at the dashboard believing she has signed out — worst of all on the
          // borrowed device that made her want to.
          void signOut()
            .catch((e: unknown) => reportError(e, { where: 'DashboardLayout.signOut' }))
            .finally(() => navigate(routes.public.home));
        }}
      >
        Sign out
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <p className="mb-6 px-3 font-display text-lg font-semibold text-sidebar-foreground">
          Kokolett
        </p>
        {nav}

        <div className="mt-auto pt-6">{account}</div>
      </aside>

      {/* Mobile slide-over */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4">
            <p className="mb-6 px-3 font-display text-lg font-semibold text-sidebar-foreground">
              Kokolett
            </p>
            {nav}
            <div className="mt-auto pt-6">{account}</div>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-2xl font-semibold text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
