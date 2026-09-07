import type { JSX } from 'react';
import { segmentedItem, segmentedTray } from '@/components/ui/controlClasses';
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
 *
 * Visual treatment comes from `components/ui/Segmented.tsx`, shared with
 * `CalendarCapacityTabs` and Inbox's queue switch. The 44px item height that
 * used to live here (this switcher is tapped constantly on the tablet the
 * owner keeps the calendar open on all day) is now the shared height, which
 * is how the other two picked it up.
 */
export function CalendarShell({ view, onViewChange }: CalendarShellProps): JSX.Element {
  return (
    <div aria-label="Calendar view" className={segmentedTray}>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          aria-pressed={view === v.key}
          onClick={() => onViewChange(v.key)}
          className={segmentedItem(view === v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
