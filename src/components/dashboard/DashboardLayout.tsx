import { useEffect, useRef, useState, type ReactNode, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/sentry';
import {
  buildNavGroups,
  isEntryActive,
  type DashboardNavBadges,
} from '@/lib/dashboardNav';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useFocusTrap, FOCUSABLE_SELECTOR } from '@/hooks/useFocusTrap';
import { getProfile } from '@/services/profileService';
import { Button } from '@/components/ui/Button';
import { QuickActionLauncher } from '@/components/dashboard/QuickActionLauncher';
import { NotificationBellPopover } from '@/components/dashboard/NotificationBellPopover';
import { DashboardNavList } from '@/components/dashboard/DashboardNavList';
import { DashboardWordmark } from '@/components/dashboard/DashboardWordmark';
import { DashboardAccountFooter } from '@/components/dashboard/DashboardAccountFooter';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

const SIDEBAR_COLLAPSED_KEY = 'kokolett-sidebar-collapsed';

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
  badges?: DashboardNavBadges;
}): JSX.Element {
  /* Owner pages inherited index.html's marketing title, so every dashboard tab
     and bookmark read "Kokolett Beauty UK is a women's hair salon in
     Thamesmead...". `noindex` because robots.txt disallowing /dashboard stops
     crawling but not a rendered preview, and no `path` because none of these
     canonicalise anywhere. */
  useDocumentMeta({
    title: typeof title === 'string' ? title : 'Dashboard',
    noindex: true,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(menuOpen, menuPanelRef, () => setMenuOpen(false));

  /* `aria-modal` is a promise to a screen reader, and a trap alone does not keep
     it: `useFocusTrap` only wraps Tab once focus is already inside the panel. On
     open, focus stayed on the Menu button behind the overlay, so a keyboard user
     went on tabbing through the obscured dashboard; on close, the focused element
     was removed from the document and focus fell to <body>. The hook deliberately
     leaves placement to the caller (Modal and ConfirmDialog want different
     things), so this belongs here rather than in the hook. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    menuTriggerRef.current = document.activeElement as HTMLElement | null;
    const panel = menuPanelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel)?.focus();
    return () => menuTriggerRef.current?.focus();
  }, [menuOpen]);
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

  const navGroups = buildNavGroups(badges);

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

  const closeMenu = (): void => setMenuOpen(false);

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
            needing a matching `md:pl-*` offset on the content column.
            Wordmark and account footer stay pinned; the nav list between
            them scrolls on its own once it outgrows the viewport (2026-08-31
            — six section groups no longer reliably fit a ~720px-tall laptop
            screen; System Health/Broadcasts/Audit Log were simply
            unreachable below the fold, with no scrollbar to find them).
            Collapses to an icon-only rail (`collapsed`, persisted in
            localStorage) for more content width on a small laptop. */}
        <aside
          className={cn(
            'z-sidebar hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 md:flex',
            collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
          )}
        >
          <div
            className={cn(
              'relative shrink-0',
              collapsed ? 'overflow-x-visible px-2 pt-4' : 'px-4 pt-4',
            )}
          >
            <DashboardWordmark rail={collapsed} onToggleCollapsed={toggleCollapsed} />
          </div>
          {/*
            The nav list is the one part of the sidebar that grows with the
            product — six section groups and counting — so it's the one part
            that scrolls internally rather than the whole shell gaining a
            second scroll region (docs/DESIGN.md §15.1). The wordmark stays
            pinned above it and the account footer (`mt-auto` on its own
            sibling below) stays pinned below, so only the middle list moves.
          */}
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto',
              collapsed ? 'overflow-x-visible px-2 pb-4' : 'px-4 pb-4',
            )}
          >
            <DashboardNavList
              navGroups={navGroups}
              rail={collapsed}
              pathname={location.pathname}
              search={location.search}
              onNavigate={closeMenu}
            />
          </div>
          <div
            className={cn(
              'mt-auto shrink-0 border-t border-sidebar-border',
              collapsed ? 'p-2' : 'p-4',
            )}
          >
            <DashboardAccountFooter
              rail={collapsed}
              ownerName={ownerName}
              userEmail={user?.email}
              onNavigate={closeMenu}
              onSignOut={doSignOut}
            />
          </div>
        </aside>

        <div className="koko-content flex flex-col">
          {/* `min-h-header`, not a hard `h-header`: 64px (docs/DESIGN.md's
              locked header height) is the target, but a page with a long
              subtitle or several action buttons wrapping to a second row on
              mobile must still be able to grow past it rather than clip —
              flexbox gives `<main>` exactly what's left either way. */}
          <header className="z-sticky flex min-h-header shrink-0 items-center border-b border-border bg-background px-4 py-3 md:px-6 lg:px-8">
            {/* The shell honours the 1440px content cap it has always
                declared (`--content-max-width`, docs/DESIGN.md §5.2/§15.2)
                and never applied: on a 1920px monitor the Reports cards
                stretched to 1680px, so a two-word empty state sat alone in a
                780px box. The same cap and the same centring are on `<main>`
                below, so the header controls stay flush with the content
                under them. Nothing opts out today; a page that genuinely
                needs the full width renders its own full-width wrapper
                inside `<main>` rather than removing this. */}
            <div className="mx-auto flex w-full max-w-content flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-3 md:gap-y-2">
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
                {/* The page name and its instruction WRAP; they used to
                    `truncate`, which on a phone turned "Availability
                    requests" into "Availabili…" and cut the subtitle — the
                    sentence that says what the screen is for — mid-word.
                    `min-h-header` on the header already allows it to grow,
                    so nothing below moves. */}
                <div className="min-w-0 flex-1">
                  <h1 className="flex min-w-0 items-start gap-2 font-serif text-2xl font-semibold text-foreground">
                    {HeaderIcon && (
                      <HeaderIcon
                        aria-hidden="true"
                        className="mt-1 h-6 w-6 shrink-0 text-primary"
                        strokeWidth={2}
                      />
                    )}
                    <span className="min-w-0 break-words">{title}</span>
                  </h1>
                  {subtitle && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
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
            <div className="mx-auto w-full max-w-content">{children}</div>
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
            onClick={closeMenu}
          />
          <div
            ref={menuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar"
          >
            <div className="p-4">
              <DashboardWordmark rail={false} onToggleCollapsed={toggleCollapsed} />
              <DashboardNavList
                navGroups={navGroups}
                rail={false}
                pathname={location.pathname}
                search={location.search}
                onNavigate={closeMenu}
              />
            </div>
            <div className="mt-auto shrink-0 border-t border-sidebar-border p-4">
              <DashboardAccountFooter
                rail={false}
                ownerName={ownerName}
                userEmail={user?.email}
                onNavigate={closeMenu}
                onSignOut={doSignOut}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
