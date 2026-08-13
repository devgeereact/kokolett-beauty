import { NavLink } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const TABS = [
  { to: routes.owner.calendar, label: 'Schedule' },
  { to: routes.owner.appointmentType, label: 'Appointment type' },
  { to: routes.owner.weeklyDefault, label: 'Weekly hours' },
] as const;

/**
 * Shared by `CalendarPage`, `AppointmentTypePage` and `WeeklyDefaultPage` —
 * three separately-routed pages grouped under the sidebar's single
 * "Calendar & Capacity" entry (docs/plan.md Phase 1 step 6). Each page keeps
 * its own state and logic; this just makes the other two one click away.
 *
 * Same visual pattern as `CalendarShell`'s Week/Day/Month switcher, but real
 * `NavLink`s rather than a state toggle, since these are three distinct
 * routes rather than one page's view mode.
 */
export function CalendarCapacityTabs(): JSX.Element {
  return (
    <nav
      aria-label="Calendar & capacity sections"
      className="mb-6 inline-flex gap-0.5 rounded-lg bg-muted p-1"
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-card text-foreground shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
