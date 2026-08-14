import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Field';
import {
  STATUS_CATEGORIES,
  STATUS_CATEGORY_DOT,
  STATUS_CATEGORY_LABELS,
  STATUS_DOTS,
  type StatusCategory,
} from '@/lib/status';

/**
 * Calendar rail filters, by appointment status — Kokolett is a single-owner
 * salon (docs/PRD.md) with no staff to filter by, so this filters what these
 * bookings are (status), not who they're assigned to.
 */
export function CalendarFiltersCard({
  visibleCategories,
  onToggleCategory,
  showCancelled,
  onToggleShowCancelled,
}: {
  visibleCategories: Set<StatusCategory>;
  onToggleCategory: (category: StatusCategory, visible: boolean) => void;
  showCancelled: boolean;
  onToggleShowCancelled: (value: boolean) => void;
}): JSX.Element {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-display text-base font-semibold text-foreground">Filters</h2>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status ({visibleCategories.size}/{STATUS_CATEGORIES.length})
        </p>
        <div className="space-y-2">
          {STATUS_CATEGORIES.map((category) => {
            const id = `calendar-filter-${category}`;
            const checked = visibleCategories.has(category);
            return (
              <label
                key={category}
                htmlFor={id}
                className="flex items-center gap-2.5 text-sm text-foreground"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggleCategory(category, e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOTS[STATUS_CATEGORY_DOT[category]]}`}
                />
                {STATUS_CATEGORY_LABELS[category]}
              </label>
            );
          })}
        </div>
      </div>

      <Checkbox
        label="Show cancelled & no-show"
        checked={showCancelled}
        onChange={(e) => onToggleShowCancelled(e.target.checked)}
        className="mb-0"
      />
    </Card>
  );
}
