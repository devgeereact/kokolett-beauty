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

/**
 * The Week / Day / Month view switcher. Navigation (prev/today/next) stays in
 * `CalendarPage`'s existing header `actions` slot — this is only the mode
 * switch.
 *
 * Deliberately plain buttons, not the ARIA tab pattern: `role="tablist"` /
 * `role="tab"` promises arrow-key roving-tabindex navigation and
 * `role="tabpanel"` wiring that this component never implements, which is
 * worse for assistive tech than no ARIA at all. `aria-pressed` describes the
 * actual behaviour — a toggle group — without any unmet contract.
 */
export function CalendarShell({ view, onViewChange }: CalendarShellProps): JSX.Element {
  return (
    <div aria-label="Calendar view" className="inline-flex gap-0.5 rounded-lg bg-muted p-1">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          aria-pressed={view === v.key}
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
