import { Link } from 'react-router-dom';
import {
  STATUS_CATEGORIES,
  STATUS_CATEGORY_DOT,
  STATUS_CATEGORY_LABELS,
  STATUS_DOTS,
} from '@/lib/status';
import { routes } from '@/lib/routes';

/**
 * The status-colour key, below the grid — the same 6 families
 * `CalendarFiltersCard` filters by. Links to Availability, the settings
 * page that actually governs what the calendar can show (published hours),
 * rather than the general Settings page.
 */
export function CalendarLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {STATUS_CATEGORIES.map((category) => (
          <li key={category} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOTS[STATUS_CATEGORY_DOT[category]]}`}
            />
            {STATUS_CATEGORY_LABELS[category]}
          </li>
        ))}
      </ul>
      <Link
        to={routes.owner.weeklyDefault}
        className="font-medium text-foreground hover:underline hover:underline-offset-4"
      >
        View settings
      </Link>
    </div>
  );
}
