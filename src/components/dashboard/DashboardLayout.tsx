import { useEffect, useState, type ReactNode, type JSX } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/sentry';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { getProfile } from '@/services/profileService';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { QuickActionLauncher } from '@/components/dashboard/QuickActionLauncher';
import { NotificationBellPopover } from '@/components/dashboard/NotificationBellPopover';
import { NAV_ICONS } from '@/lib/icons';

const SIDEBAR_COLLAPSED_KEY = 'kokolett-sidebar-collapsed';

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
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  badges?: { approvals?: number; requests?: number; notifications?: number };
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const { user, signOut } = useSupabaseAuth();
  const { timezone } = useBusinessSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Collapse state just won't persist across reloads.
      }
      return next;
    });
  };

  const [ownerName, setOwnerName] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => setOwnerName(p?.full_name ?? null))
      .catch(() => setOwnerName(null));
  }, [user]);

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
        {
          to: routes.owner.appointments,
          label: 'Appointments',
          icon: NAV_ICONS.Appointments,
        },
        {
          to: routes.owner.dailyClose,
          label: 'Daily Close',
          icon: NAV_ICONS['Daily Close'],
        },
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
      items: [
        { to: routes.owner.customers, label: 'Customers', icon: NAV_ICONS.Customers },
      ],
    },
    {
      label: 'Salon',
      items: [
        { to: routes.owner.serviceMenu, label: 'Services', icon: NAV_ICONS.Services },
        {
          to: routes.owner.weeklyDefault,
          label: 'Availability',
          icon: NAV_ICONS.Availability,
        },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: routes.owner.reports, label: 'Reports', icon: NAV_ICONS.Reports },
        {
          to: routes.owner.assistant,
          label: 'AI Assistant',
          icon: NAV_ICONS['AI Assistant'],
        },
      ],
    },
    {
      label: 'Communications',
      items: [
        {
          to: routes.owner.notifications,
          label: 'Notifications',
          icon: NAV_ICONS.Notifications,
        },
        { to: routes.owner.email, label: 'Email', icon: NAV_ICONS.Email },
        { to: routes.owner.templates, label: 'Templates', icon: NAV_ICONS.Templates },
        { to: routes.owner.broadcasts, label: 'Broadcasts', icon: NAV_ICONS.Broadcasts },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: routes.owner.settings, label: 'Settings', icon: NAV_ICONS.Settings },
        { to: routes.owner.audit, label: 'Audit Log', icon: NAV_ICONS.Audit },
        {
          to: routes.owner.systemHealth,
          label: 'System Health',
          icon: NAV_ICONS['System Health'],
        },
      ],
    },
  ];

  // The header's title icon is never hand-picked per page — it's whichever
  // sidebar row is currently active, via the exact same `isEntryActive`
  // matching the sidebar itself uses (including `activePaths` and
  // `matchTab`). One source of truth means the header can never drift from
  // the nav — a route not in `navGroups` (Profile, Appointment type's own
  // page shell) just renders no icon rather than a guessed one.
  const activeNavEntry = navGroups
    .flatMap((group) => group.items)
    .find((entry) => isEntryActive(entry, location.pathname, location.search));
  const HeaderIcon = activeNavEntry?.icon;

  const renderEntry = (entry: NavEntry, rail: boolean): JSX.Element => {
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
        title={rail ? entry.label : undefined}
        className={cn(
          'relative flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          rail && 'justify-center px-0',
          active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
        {!rail && <span className="flex-1 truncate">{entry.label}</span>}
        {entry.badge ? (
          rail ? (
            <span className="absolute right-1 top-1 inline-flex h-2 w-2 rounded-full bg-primary" />
          ) : (
            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {entry.badge}
            </span>
          )
        ) : null}
      </Link>
    );
  };

  const buildNav = (rail: boolean): JSX.Element => (
    <nav className="flex flex-col gap-3.5" aria-label="Dashboard">
      {navGroups.map((group) => (
        <div key={group.label}>
          {!rail && (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map((entry) => renderEntry(entry, rail))}
          </div>
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
  const doSignOut = (): void => {
    setMenuOpen(false);
    // Navigate whether or not the network call succeeds. `signOut()` rejects
    // when offline, and a silent no-op leaves the owner looking at the
    // dashboard believing she has signed out — worst of all on the borrowed
    // device that made her want to.
    void signOut()
      .catch((e: unknown) => reportError(e, { where: 'DashboardLayout.signOut' }))
      .finally(() => void navigate(routes.public.home));
  };

  const buildAccount = (rail: boolean): JSX.Element =>
    rail ? (
      <div className="flex flex-col items-center gap-2 px-1">
        <Link
          to={routes.owner.profile}
          onClick={() => setMenuOpen(false)}
          title={ownerName ?? user?.email ?? 'Owner'}
        >
          <Avatar name={ownerName ?? user?.email ?? '?'} size="sm" />
        </Link>
        <button
          type="button"
          title="Sign out"
          onClick={doSignOut}
          className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 rotate-180"
            strokeWidth={2}
          />
        </button>
      </div>
    ) : (
      // Profile (avatar, name, business address/phone/email, theme) and the
      // public-site link all live one click away on Settings/Profile now —
      // keeping them out of the sidebar footer is what lets the sidebar
      // render statically, full height, every nav row visible with no
      // internal scroll.
      <Button variant="ghost" size="sm" className="w-full" onClick={doSignOut}>
        Sign out
      </Button>
    );

  const buildWordmark = (rail: boolean): JSX.Element => (
    <div
      className={cn(
        'mb-4 flex items-center',
        rail ? 'justify-center px-0' : 'justify-between px-3',
      )}
    >
      {rail ? (
        <span
          title="Kokolett Beauty UK"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-sm font-bold text-primary-foreground"
        >
          K
        </span>
      ) : (
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold leading-tight text-sidebar-foreground">
            Kokolett
          </p>
          <p className="text-xs font-semibold tracking-wide text-primary">BEAUTY UK</p>
        </div>
      )}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex',
          rail &&
            'absolute -right-3 top-4 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar shadow-popover',
        )}
      >
        {rail ? (
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <ChevronLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );

  return (
    <>
      {/*
        Skip link. The dashboard sidebar puts roughly twenty links ahead of the
        content, so a keyboard or screen-reader user was tabbing through all of
        them again on every navigation. Visually hidden until focused, which is
        the only moment it is any use.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {/* The one scroll region is `<main>` below (docs/DESIGN.md §15 —
          dashboard scroll architecture is a hard requirement): the browser
          viewport itself never scrolls, so the sidebar and header can never
          drift, double-scroll, or leave pagination looking detached. */}
      <div className="koko-app bg-background">
        {/* Desktop/tablet sidebar — a real flex sibling now, not a `fixed`
            overlay, so it participates in `koko-app`'s row layout instead of
            needing a matching `md:pl-*` offset on the content column. Static,
            no internal scroll — nav + footer fit one viewport without their
            own scroll region. Collapses to an icon-only rail (`collapsed`,
            persisted in localStorage) for more content width on a small
            laptop. */}
        <aside
          className={cn(
            'z-sidebar hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 md:flex',
            collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
          )}
        >
          <div
            className={cn('relative', collapsed ? 'overflow-x-visible px-2 py-4' : 'p-4')}
          >
            {buildWordmark(collapsed)}
            {buildNav(collapsed)}
          </div>
          <div
            className={cn(
              'mt-auto shrink-0 border-t border-sidebar-border',
              collapsed ? 'p-2' : 'p-4',
            )}
          >
            {buildAccount(collapsed)}
          </div>
        </aside>

        <div className="koko-content flex flex-col">
          {/* `min-h-header`, not a hard `h-header`: 64px (docs/DESIGN.md's
              locked header height) is the target, but a page with a long
              subtitle or several action buttons wrapping to a second row on
              mobile must still be able to grow past it rather than clip —
              flexbox gives `<main>` exactly what's left either way. */}
          <header className="z-sticky flex min-h-header shrink-0 items-center border-b border-border bg-background px-4 py-3 md:px-6 lg:px-8">
            <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-3 md:gap-y-2">
              <div className="flex min-w-0 items-center gap-3">
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
                  <h1 className="flex min-w-0 items-center gap-2 font-serif text-2xl font-semibold text-foreground">
                    {HeaderIcon && (
                      <HeaderIcon
                        aria-hidden="true"
                        className="h-6 w-6 shrink-0 text-primary"
                        strokeWidth={2}
                      />
                    )}
                    <span className="truncate">{title}</span>
                  </h1>
                  {subtitle && (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="hidden md:block">
                  <QuickActionLauncher />
                </div>
                {actions}
                <NotificationBellPopover
                  timezone={timezone}
                  badgeCount={badges?.notifications ?? 0}
                />
              </div>
            </div>
          </header>

          <main
            id="main-content"
            className="koko-scroll scroll-bottom-gap px-4 pt-6 md:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile slide-over — always the full, uncollapsed nav. A sibling of
          `koko-app`, not nested inside it: `koko-app` is `overflow-hidden`,
          which clips a `position: fixed` descendant in every major browser
          despite `fixed` supposedly escaping normal containing blocks — the
          same reason `Modal`/`ConfirmDialog`/`QuickActionLauncher` portal to
          `document.body` instead of rendering in place. */}
      {menuOpen && (
        <div className="fixed inset-0 z-drawer md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="overlay-backdrop absolute inset-0"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar">
            <div className="p-4">
              {buildWordmark(false)}
              {buildNav(false)}
            </div>
            <div className="mt-auto shrink-0 border-t border-sidebar-border p-4">
              {buildAccount(false)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
