import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import { isEntryActive, type NavEntry, type NavGroup } from '@/lib/dashboardNav';
import { cn } from '@/lib/utils';

interface DashboardNavListProps {
  navGroups: NavGroup[];
  rail: boolean;
  pathname: string;
  search: string;
  onNavigate: () => void;
}

/**
 * The sidebar's nav list, shared by the desktop rail/full sidebar and the
 * mobile drawer (`rail` only ever varies the desktop rendering — the mobile
 * drawer always passes `false`).
 */
export function DashboardNavList({
  navGroups,
  rail,
  pathname,
  search,
  onNavigate,
}: DashboardNavListProps): JSX.Element {
  const renderEntry = (entry: NavEntry): JSX.Element => {
    const active = isEntryActive(entry, pathname, search);
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
        onClick={onNavigate}
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
        {rail ? (
          /* A real accessible name, not just `title`. Collapsed, the row was
             an icon plus a `title` attribute — which browsers do expose as a
             name, but only after a hover delay and never on keyboard focus,
             so the rail read as a column of unlabelled links to anyone not
             using a mouse. The badge count goes in the same string because
             its rail rendering is a bare dot with no number in it.

             A visible tooltip is NOT used here: the rail's own scroll
             container computes `overflow-x` to `auto`, so a label wide
             enough to be worth showing would be clipped by the 72px column.
             Recorded in docs/KOKO_GAP.md rather than shipped clipped. */
          <span className="sr-only">
            {entry.label}
            {entry.badge ? `, ${entry.badge} waiting` : ''}
          </span>
        ) : (
          <span className="flex-1 truncate">{entry.label}</span>
        )}
        {entry.badge ? (
          rail ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 inline-flex h-2 w-2 rounded-full bg-primary"
            />
          ) : (
            <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {entry.badge}
            </span>
          )
        ) : null}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-3.5" aria-label="Dashboard">
      {navGroups.map((group) => (
        <div key={group.label}>
          {!rail && (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {group.items.map((entry) => renderEntry(entry))}
          </div>
        </div>
      ))}
    </nav>
  );
}
