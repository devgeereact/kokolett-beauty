import type { JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { formatDateLong } from '@/lib/format';

interface ApplyPatternSectionProps {
  totalTimes: number;
  months: string;
  onMonthsChange: (months: string) => void;
  busy: number | 'apply' | null;
  onRequestApply: (replace: boolean) => void;
  message: string | null;
  formError: string | null;
  filledTo: string | null;
}

/**
 * Writes the repeating week onto the real calendar, and explains what each
 * apply mode does. Split out of `WeeklyDefaultPage` so the page stays a thin
 * data/state shell; this owns no state of its own beyond what its parent
 * passes in, since `showAdvanced` gates it alongside the schedule card above.
 */
export function ApplyPatternSection({
  totalTimes,
  months,
  onMonthsChange,
  busy,
  onRequestApply,
  message,
  formError,
  filledTo,
}: ApplyPatternSectionProps): JSX.Element {
  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
              Put it on the calendar
            </h2>
            <p className="text-sm text-muted-foreground">
              The pattern does nothing on its own. This is what writes it into real days.
            </p>
          </div>
          <div className="flex items-baseline gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <span className="text-xs text-muted-foreground">Times set this week</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {totalTimes}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 rounded-md border border-border p-3">
          <div>
            <label
              htmlFor="months-ahead"
              className="mb-1 block text-xs font-medium text-foreground"
            >
              How far ahead
            </label>
            {/* Months, not weeks. The salon publishes and thinks in
                months, customers can see three months of times, and
                "8 weeks" asked the owner to translate between two
                units to work out whether she had covered the period a
                customer can actually book. Three months is the whole
                horizon, so it is the default. */}
            <Select
              id="months-ahead"
              className="w-40"
              value={months}
              onChange={(e) => onMonthsChange(e.target.value)}
            >
              <option value="1">1 month</option>
              <option value="2">2 months</option>
              <option value="3">3 months</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy === 'apply'}
              disabled={totalTimes === 0}
              onClick={() => onRequestApply(false)}
            >
              Fill empty days
            </Button>
            <Button
              variant="ghost"
              loading={busy === 'apply'}
              disabled={totalTimes === 0}
              onClick={() => onRequestApply(true)}
            >
              Replace every day
            </Button>
          </div>
        </div>

        {totalTimes === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Add some times to your week first.
          </p>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm text-status-completed">
            {message}
          </p>
        )}
        {formError && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}

        {filledTo && (
          <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
            Calendar is set up to{' '}
            <span className="font-medium text-foreground">
              {formatDateLong(`${filledTo}T12:00:00Z`, 'UTC')}
            </span>
            .
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-serif text-base font-semibold text-foreground">
          How this behaves
        </h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="mb-1 text-sm font-medium text-foreground">Fill empty days</p>
            <p className="text-xs text-muted-foreground">
              Only touches days you have never set. A day you cleared stays cleared.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="mb-1 text-sm font-medium text-foreground">Replace every day</p>
            <p className="text-xs text-muted-foreground">
              Lays the week over the top, including days you have changed. Times with
              bookings against them are always kept.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="mb-1 text-sm font-medium text-foreground">
              Fills forward nightly
            </p>
            <p className="text-xs text-muted-foreground">
              The calendar quietly extends from this pattern each night, so you never run
              out of bookable days.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="mb-1 text-sm font-medium text-foreground">
              A single day always wins
            </p>
            <p className="text-xs text-muted-foreground">
              Editing any date above overrides the pattern for that date from then on.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}
