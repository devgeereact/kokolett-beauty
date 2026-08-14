import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/sentry';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { QuickActionLauncher } from '@/components/dashboard/QuickActionLauncher';
import { NAV_ICONS } from '@/lib/icons';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rendered as a count beside the label; omitted when zero. */
  badge?: number;
  /**
   * Extra paths that also count as "active" for this entry, for a single nav
   * item that fronts more than one route — Calendar also owns Appointment
   * type (`CalendarCapacityTabs`'s in-page switcher). Availability
   * (`weeklyDefault`) is deliberately NOT included here even though it's
   * also reachable from that switcher — it has its own direct nav row under
   * Salon, and including it here would double-highlight the sidebar.
   */
  activePaths?: string[];
  /**
   * For entries that deep-link into Inbox's `?tab=` param (Approvals,
   * Availability Requests) rather than owning a distinct route.
   */
  matchTab?: 'approvals' | 'requests';
}

interface NavGroup {
  label: string;
  items: NavEntry[];
}

/** Mirrors `NavLink`'s own non-`end` matching: exact, or a path segment below. */
function isEntryActive(entry: NavEntry, pathname: string, search: string): boolean {
  if (entry.matchTab) {
    return (
      pathname === routes.owner.inbox &&
      new URLSearchParams(search).get('tab') === entry.matchTab
    );
  }
  if (entry.activePaths) return entry.activePaths.includes(pathname);
  if (entry.to === routes.owner.dashboard) return pathname === entry.to;
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
}

/**
 * The owner shell: a persistent sidebar on desktop/tablet, a slide-over on
 * phone. The sidebar visibility breakpoint is `md:` (768px), not the more
 * common `lg:` (1024px) — a portrait salon tablet (~768–834px CSS width) is
 * a real device this shell is designed for, and `lg:` would drop it into
 * the phone-style "tap Menu" pattern (docs/planning/
 * owner-console-nav-breakpoint-decision.md).
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
  const location = useLocation();

  // Grouped Owner Console nav (docs/planning/owner-console-rebuild-plan.md §0).
  const navGroups: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { to: routes.owner.dashboard, label: 'Dashboard', icon: NAV_ICONS.Dashboard },
        {
          to: routes.owner.calendar,
          label: 'Calendar',
          icon: NAV_ICONS.Calendar,
          activePaths: [routes.owner.calendar, routes.owner.appointmentType],
        },
        { to: routes.owner.appointments, label: 'Appointments', icon: NAV_ICONS.Appointments },
      ],
    },
    {
      label: 'Bookings',
      items: [
        {
          to: `${routes.owner.inbox}?tab=approvals`,
          label: 'Approvals',
          icon: NAV_ICONS.Approvals,
          matchTab: 'approvals',
          badge: badges?.approvals,
        },
        {
          to: `${routes.owner.inbox}?tab=requests`,
          label: 'Availability Requests',
          icon: NAV_ICONS['Availability Requests'],
          matchTab: 'requests',
          badge: badges?.requests,
        },
      ],
    },
    {
      label: 'Customers',
      items: [{ to: routes.owner.customers, label: 'Customers', icon: NAV_ICONS.Customers }],
    },
    {
      label: 'Salon',
      items: [
        { to: routes.owner.serviceMenu, label: 'Services', icon: NAV_ICONS.Services },
        { to: routes.owner.weeklyDefault, label: 'Availability', icon: NAV_ICONS.Availability },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: routes.owner.reports, label: 'Reports', icon: NAV_ICONS.Reports },
        { to: routes.owner.assistant, label: 'AI Assistant', icon: NAV_ICONS['AI Assistant'] },
      ],
    },
    {
      label: 'Communications',
      items: [
        { to: routes.owner.notifications, label: 'Notifications', icon: NAV_ICONS.Notifications },
        { to: routes.owner.email, label: 'Email', icon: NAV_ICONS.Email },
        { to: routes.owner.templates, label: 'Templates', icon: NAV_ICONS.Templates },
      ],
    },
    {
      label: 'Account',
      items: [{ to: routes.owner.settings, label: 'Settings', icon: NAV_ICONS.Settings }],
    },
  ];

  const renderEntry = (entry: NavEntry): JSX.Element => {
    const active = isEntryActive(entry, location.pathname, location.search);
    const Icon = entry.icon;
    return (
      // Plain `Link`, not `NavLink`: `NavLink`'s own prefix-based matching
      // computes `aria-current` from its *own* `isActive` (driven only by
      // `to`), which can't express `activePaths` grouping or `matchTab`
      // deep-linking into Inbox's `?tab=` param. A plain `Link` with
      // `aria-current` set directly from the same `active`/`isEntryActive`
      // boolean the styling below uses gives exactly one correct current
      // entry on every path, including the grouped and tab-based ones.
      <Link
        key={entry.to}
        to={entry.to}
        onClick={() => setMenuOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
        <span className="flex-1 truncate">{entry.label}</span>
        {entry.badge ? (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {entry.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const nav = (
    <nav className="flex flex-col gap-4" aria-label="Dashboard">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
            {group.label}
          </p>
          <div className="flex flex-col gap-1">{group.items.map(renderEntry)}</div>
        </div>
      ))}
    </nav>
  );

  /**
   * The signed-in address and the way out.
   *
   * Rendered in the mobile drawer as well as the desktop sidebar. It used to
   * live only inside the `hidden md:flex` sidebar, so below that breakpoint —
   * which includes a phone — there was no way to sign out at all.
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
      {/* Desktop/tablet sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <p className="mb-6 px-3 font-display text-lg font-semibold text-sidebar-foreground">
          Kokolett
        </p>
        {nav}

        <div className="mt-auto pt-6">{account}</div>
      </aside>

      {/* Mobile slide-over */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4">
            <p className="mb-6 px-3 font-display text-lg font-semibold text-sidebar-foreground">
              Kokolett
            </p>
            {nav}
            <div className="mt-auto pt-6">{account}</div>
          </div>
        </div>
      )}

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
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
