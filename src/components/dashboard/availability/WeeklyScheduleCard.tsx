import type { JSX } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import type { TemplateDay } from '@/services/availabilityService';
import { DAYS_OF_WEEK, formatDateLong } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BookingSettings } from '@/types';

/** Monday first, because that is how a working week reads. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface FillOptions {
  from: string;
  to: string;
  every: string;
}

interface WeeklyScheduleCardProps {
  days: TemplateDay[];
  settings: BookingSettings | null;
  timezone: string;
  filledTo: string | null;
  busy: number | 'apply' | null;
  onSaveDay: (dayOfWeek: number, times: string[]) => void;
  fill: FillOptions;
  onFillChange: (fill: FillOptions) => void;
  showAdvanced: boolean;
  onShowAdvancedChange: (show: boolean) => void;
  openDayIndex: number | null;
  onOpenDayIndexChange: (index: number | null) => void;
  newTime: Record<number, string>;
  onNewTimeChange: (newTime: Record<number, string>) => void;
  onAdjustSingleDay: () => void;
}

function buildTimes(from: string, to: string, everyMinutes: number): string[] {
  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const out: string[] = [];
  for (let m = toMinutes(from); m < toMinutes(to); m += everyMinutes) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    );
  }
  return out;
}

/**
 * The repeating week itself: a compact day-row table with an accordion
 * editor per day, plus the "Fill" defaults used by each row's quick-fill
 * button. Applying the pattern to the calendar lives in `ApplyPatternSection`.
 */
export function WeeklyScheduleCard({
  days,
  settings,
  timezone,
  filledTo,
  busy,
  onSaveDay,
  fill,
  onFillChange,
  showAdvanced,
  onShowAdvancedChange,
  openDayIndex,
  onOpenDayIndexChange,
  newTime,
  onNewTimeChange,
  onAdjustSingleDay,
}: WeeklyScheduleCardProps): JSX.Element {
  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        Weekly schedule
      </h2>
      <p className="mb-2 text-sm text-muted-foreground">
        Set the times you normally work. A day with no times is a day you are normally
        closed.
      </p>
      <p className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        This is your repeating pattern only. Changes here don&rsquo;t reach the calendar
        on their own.{' '}
        <button
          type="button"
          onClick={() => onShowAdvancedChange(true)}
          className="font-medium text-brand-ink hover:underline"
        >
          Show advanced options
        </button>{' '}
        below to apply it.
        {filledTo && (
          <>
            {' '}
            Calendar is currently filled up to{' '}
            <span className="font-medium text-foreground">
              {formatDateLong(`${filledTo}T12:00:00Z`, 'UTC')}
            </span>
            .
          </>
        )}
      </p>

      <div>
        {DAY_ORDER.map((dayIndex) => {
          const day = days.find((d) => d.day_of_week === dayIndex);
          const times = day?.times ?? [];
          const name = DAYS_OF_WEEK[dayIndex]?.name ?? '';
          const open = times.length > 0;

          const sorted = [...times].sort();
          const isEditing = openDayIndex === dayIndex;

          return (
            <div key={dayIndex} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() =>
                  onOpenDayIndexChange(openDayIndex === dayIndex ? null : dayIndex)
                }
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md p-2 -mx-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2">
                  <p className="w-24 font-medium text-foreground">{name}</p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      open
                        ? 'bg-tint-completed text-status-completed'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {open ? 'Open' : 'Closed'}
                  </span>
                  {open && (
                    <span className="hidden text-sm text-muted-foreground md:inline">
                      {sorted[0]} to {sorted.at(-1)}
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  {open &&
                    `${times.length} time${times.length === 1 ? '' : 's'} · up to ${settings?.max_appointments_per_day ?? '—'} per day`}
                  <span className="font-medium text-primary">
                    {isEditing ? 'Close' : 'Edit'}
                  </span>
                </span>
              </button>

              {isEditing && (
                <div className="mt-3">
                  {times.length > 0 && (
                    <ul className="mb-2 flex flex-wrap gap-1.5">
                      {times.map((t) => (
                        <li key={t}>
                          <button
                            type="button"
                            disabled={busy === dayIndex}
                            onClick={() =>
                              onSaveDay(
                                dayIndex,
                                times.filter((x) => x !== t),
                              )
                            }
                            title="Remove from the weekly default"
                            aria-label={`Remove ${t} from the weekly default`}
                            className={cn(
                              'rounded-md border border-border bg-card px-2 py-1 font-mono text-sm text-foreground',
                              'hover:border-destructive hover:text-destructive',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            )}
                          >
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`Add a time to ${name}`}
                      className="w-32"
                      value={newTime[dayIndex] ?? '09:00'}
                      onChange={(e) =>
                        onNewTimeChange({ ...newTime, [dayIndex]: e.target.value })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy === dayIndex}
                      onClick={() =>
                        onSaveDay(dayIndex, [...times, newTime[dayIndex] ?? '09:00'])
                      }
                    >
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy === dayIndex}
                      onClick={() =>
                        onSaveDay(
                          dayIndex,
                          buildTimes(fill.from, fill.to, Number(fill.every)),
                        )
                      }
                    >
                      Fill {fill.from} to {fill.to}
                    </Button>
                    {times.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy === dayIndex}
                        onClick={() => onSaveDay(dayIndex, [])}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onAdjustSingleDay}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Adjust a single day
        </Button>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          All times are in {timezone}.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onShowAdvancedChange(!showAdvanced)}
        className="mt-3 rounded border-t border-border pt-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
      </button>

      {showAdvanced && (
        <div className="mt-3 rounded-md border border-border bg-muted p-3">
          <p className="mb-2 text-xs font-medium text-foreground">
            What &ldquo;Fill&rdquo; uses
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label
                htmlFor="tf-from"
                className="mb-1 block text-xs text-muted-foreground"
              >
                From
              </label>
              <Input
                id="tf-from"
                type="time"
                className="w-28"
                value={fill.from}
                onChange={(e) => onFillChange({ ...fill, from: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="tf-to" className="mb-1 block text-xs text-muted-foreground">
                To
              </label>
              <Input
                id="tf-to"
                type="time"
                className="w-28"
                value={fill.to}
                onChange={(e) => onFillChange({ ...fill, to: e.target.value })}
              />
            </div>
            <div>
              <label
                htmlFor="tf-every"
                className="mb-1 block text-xs text-muted-foreground"
              >
                Every
              </label>
              <Select
                id="tf-every"
                className="w-28"
                value={fill.every}
                onChange={(e) => onFillChange({ ...fill, every: e.target.value })}
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">1½ hours</option>
                <option value="120">2 hours</option>
              </Select>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
