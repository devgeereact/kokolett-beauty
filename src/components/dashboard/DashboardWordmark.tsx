import type { JSX } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardWordmarkProps {
  rail: boolean;
  onToggleCollapsed: () => void;
}

/** The sidebar's top row: the wordmark (or, collapsed, a "K" mark) plus the collapse toggle. */
export function DashboardWordmark({
  rail,
  onToggleCollapsed,
}: DashboardWordmarkProps): JSX.Element {
  return (
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
        onClick={onToggleCollapsed}
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
}
