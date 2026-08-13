import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/sentry';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { QuickActionLauncher } from '@/components/dashboard/QuickActionLauncher';

interface NavEntry {
  to: string;
  label: string;
  /** Rendered as a count beside the label; omitted when zero. */
  badge?: number;
  /**
   * Extra paths that also count as "active" for this entry, for a single nav
   * item that fronts more than one route — Calendar & Capacity groups
   * `calendar`, `appointmentType` and `weeklyDefault` (docs/plan.md Phase 1
   * step 6). When omitted, only `to` (and its sub-paths) count.
   */
  activePaths?: string[];
}

/** Mirrors `NavLink`'s own non-`end` matching: exact, or a path segment below. */
function isEntryActive(entry: NavEntry, pathname: string): boolean {
  if (entry.activePaths) return entry.activePaths.includes(pathname);
  if (entry.to === routes.owner.dashboard) return pathname === entry.to;
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
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
  badges?: { inbox?: number };
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The seven core owner workflows (docs/plan.md Phase 1 step 3).
  const entries: NavEntry[] = [
    { to: routes.owner.dashboard, label: 'Today' },
    { to: routes.owner.inbox, label: 'Inbox', badge: badges?.inbox },
    {
      to: routes.owner.calendar,
      label: 'Calendar & Capacity',
      activePaths: [
        routes.owner.calendar,
        routes.owner.appointmentType,
        routes.owner.weeklyDefault,
      ],
    },
    { to: routes.owner.appointments, label: 'Bookings' },
    { to: routes.owner.customers, label: 'Customers' },
    { to: routes.owner.serviceMenu, label: 'Growth' },
    { to: routes.owner.settings, label: 'Settings' },
  ];

  // Real, shipped pages that sit outside the plan's 7-nav model — kept
  // reachable, visually secondary rather than hidden or relabelled (see
  // docs/BASELINE-AUDIT.md: neither is a stub or redirect).
  const secondaryEntries: NavEntry[] = [
    { to: routes.owner.reports, label: 'Reports' },
    { to: routes.owner.assistant, label: 'AI Assistant' },
  ];

  const renderEntry = (entry: NavEntry, primary: boolean): JSX.Element => {
    const active = isEntryActive(entry, location.pathname);
    return (
      <Link
        // Plain `Link`, not `NavLink`: `NavLink`'s own prefix-based matching
        // computes `aria-current` from its *own* `isActive` (driven only by
        // `to`), which either double-marks "Today" (`/dashboard`) as current
        // on every dashboard sub-route, or — passing `aria-current` through
        // as a prop merely supplies the *value* NavLink uses when its own
        // `isActive` is true, so it still misses grouped paths like
        // Calendar & Capacity's `appointmentType`/`weeklyDefault`, which
        // never match `to="/dashboard/calendar"` under NavLink's own rules.
        // A plain `Link` with `aria-current` set directly from the same
        // `active`/`isEntryActive` boolean the styling below uses gives
        // exactly one correct current entry on every path, including the
        // grouped ones.
        key={entry.to}
        to={entry.to}
        onClick={() => setMenuOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          !primary && 'py-2 text-[13px] font-normal',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : primary
              ? 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <span>{entry.label}</span>
        {entry.badge ? (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {entry.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {entries.map((entry) => renderEntry(entry, true))}
      <div className="my-2 border-t border-sidebar-border" aria-hidden="true" />
      {secondaryEntries.map((entry) => renderEntry(entry, false))}
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
      <Link
        to={routes.owner.profile}
        onClick={() => setMenuOpen(false)}
        className="block truncate text-xs text-sidebar-foreground hover:underline"
        title={user?.email ?? ''}
      >
        {user?.email}
      </Link>
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
            .finally(() => void navigate(routes.public.home));
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
              <QuickActionLauncher />
              <NavLink
                to={routes.owner.notifications}
                aria-label="Notifications"
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                Notifications
              </NavLink>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
