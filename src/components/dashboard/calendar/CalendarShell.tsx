import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { CalendarView } from '@/lib/calendar';

export interface CalendarShellProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'agenda', label: 'Agenda' },
];

/**
 * The Day / Week / Month / Agenda view switcher. Navigation (prev/today/next) stays in
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
    <div
      aria-label="Calendar view"
      className="inline-flex gap-0.5 rounded-lg bg-muted p-1"
    >
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          aria-pressed={view === v.key}
          onClick={() => onViewChange(v.key)}
          className={cn(
            /* `min-h-touch` rather than `py-1.5`: this switcher was 54x32, and it
               is tapped constantly on the tablet the owner keeps the calendar
               open on all day. `inline-flex items-center` keeps the label
               centred once the box is taller than its line box. */
            'inline-flex min-h-touch items-center rounded-md px-3.5 text-sm font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            view === v.key
              ? 'bg-tint-brand text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
