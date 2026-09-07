import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { segmentedItem, segmentedTray } from '@/components/ui/controlClasses';
import { cn } from '@/lib/utils';

const TABS = [
  { to: routes.owner.calendar, label: 'Schedule' },
  { to: routes.owner.appointmentType, label: 'Appointment type' },
  { to: routes.owner.weeklyDefault, label: 'Weekly hours' },
] as const;

/**
 * Shared by `CalendarPage`, `AppointmentTypePage` and `WeeklyDefaultPage` —
 * three separately-routed pages grouped under the sidebar's single
 * "Calendar & Capacity" entry. Each page keeps its own state and logic;
 * this just makes the other two one click away.
 *
 * Same visual role as `CalendarShell`'s Week/Day/Month switcher, and since
 * 2026-09-05 literally the same classes (`components/ui/Segmented.tsx`) —
 * they had drifted to different heights and different selected treatments.
 * Real `NavLink`s rather than a state toggle, since these are three distinct
 * routes rather than one page's view mode, and deliberately not ARIA tabs:
 * a tab that changes the URL is a link.
 */
export function CalendarCapacityTabs(): JSX.Element {
  return (
    <nav aria-label="Calendar & capacity sections" className={cn(segmentedTray, 'mb-6')}>
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) => segmentedItem(isActive)}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
