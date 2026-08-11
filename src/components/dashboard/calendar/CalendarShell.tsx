import { cn } from '@/lib/utils';
import type { CalendarView } from '@/lib/calendar';

export interface CalendarShellProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
  { key: 'month', label: 'Month' },
];

/** The Week / Day / Month tab switcher. Navigation (prev/today/next) stays in `CalendarPage`'s existing header `actions` slot — this is only the mode switch. */
export function CalendarShell({ view, onViewChange }: CalendarShellProps): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="inline-flex gap-0.5 rounded-lg bg-muted p-1"
    >
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={view === v.key}
          onClick={() => onViewChange(v.key)}
          className={cn(
            'rounded-md px-3.5 py-1.5 text-sm font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            view === v.key
              ? 'bg-card text-foreground shadow-card'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
