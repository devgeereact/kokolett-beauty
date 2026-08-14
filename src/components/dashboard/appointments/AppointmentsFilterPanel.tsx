import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import {
  STATUS_CATEGORIES,
  STATUS_CATEGORY_DOT,
  STATUS_CATEGORY_LABELS,
  STATUS_DOTS,
  type StatusCategory,
} from '@/lib/status';
import type { Service } from '@/types';
import type { DateMode } from '@/lib/appointmentsDateRange';

const DATE_MODE_OPTIONS: { key: DateMode; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

export type PaymentStatusFilter = 'all' | 'paid' | 'unpaid';

/**
 * The persistent right rail — every control here is live (changes the list
 * immediately), matching the Calendar screen's filter rail rather than the
 * reference's stage-then-"Apply filters" pattern: there is nothing to stage
 * against, so a button that only confirms what already happened would be
 * decorative. "Staff" and "Location" from the reference aren't here at all —
 * this is a single-owner, single-site salon, so a picker offering choices
 * that don't exist would be the same kind of fake control already dropped
 * from the Calendar screen's own filters.
 */
export function AppointmentsFilterPanel({
  dateMode,
  onDateModeChange,
  dateLabel,
  onPrevDate,
  onNextDate,
  visibleCategories,
  categoryCounts,
  onToggleCategory,
  serviceId,
  onServiceChange,
  services,
  paymentStatus,
  onPaymentStatusChange,
  onClearAll,
}: {
  dateMode: DateMode;
  onDateModeChange: (mode: DateMode) => void;
  dateLabel: string;
  onPrevDate: () => void;
  onNextDate: () => void;
  visibleCategories: Set<StatusCategory>;
  categoryCounts: Record<StatusCategory, number>;
  onToggleCategory: (category: StatusCategory, visible: boolean) => void;
  serviceId: string;
  onServiceChange: (id: string) => void;
  services: Service[];
  paymentStatus: PaymentStatusFilter;
  onPaymentStatusChange: (value: PaymentStatusFilter) => void;
  onClearAll: () => void;
}): JSX.Element {
  const steppable = dateMode === 'today' || dateMode === 'week' || dateMode === 'month';

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">Filters</h2>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          Clear all
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Date range
        </p>
        <Select
          aria-label="Date range"
          value={dateMode}
          onChange={(e) => onDateModeChange(e.target.value as DateMode)}
        >
          {DATE_MODE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
        {steppable && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" aria-label="Previous" onClick={onPrevDate}>
              ‹
            </Button>
            <span className="text-sm text-foreground">{dateLabel}</span>
            <Button variant="ghost" size="sm" aria-label="Next" onClick={onNextDate}>
              ›
            </Button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status ({visibleCategories.size}/{STATUS_CATEGORIES.length})
        </p>
        <div className="space-y-2">
          {STATUS_CATEGORIES.map((category) => {
            const id = `appointments-filter-${category}`;
            const checked = visibleCategories.has(category);
            return (
              <label
                key={category}
                htmlFor={id}
                className="flex items-center justify-between gap-2 text-sm text-foreground"
              >
                <span className="flex items-center gap-2.5">
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
                </span>
                <span className="text-xs text-muted-foreground">
                  {categoryCounts[category]}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Service
        </p>
        <Select
          aria-label="Service"
          value={serviceId}
          onChange={(e) => onServiceChange(e.target.value)}
        >
          <option value="all">All services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payment status
        </p>
        <Select
          aria-label="Payment status"
          value={paymentStatus}
          onChange={(e) => onPaymentStatusChange(e.target.value as PaymentStatusFilter)}
        >
          <option value="all">All payment statuses</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Not paid</option>
        </Select>
      </div>
    </Card>
  );
}
