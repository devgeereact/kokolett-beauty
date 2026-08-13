import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CalendarCapacityTabs } from '@/components/dashboard/CalendarCapacityTabs';
import { DayPanel } from '@/components/dashboard/DayPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useServices } from '@/hooks/useServices';
import {
  applyWeeklyTemplate,
  getWeeklyTemplateStatus,
  listWeeklyTemplate,
  setWeeklyTemplateDay,
  type TemplateDay,
  type WeeklyTemplateStatus,
} from '@/services/availabilityService';
import { errorMessage } from '@/lib/errors';
import { addDays, DAYS_OF_WEEK, formatDateLong, toSalonDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Monday first, because that is how a working week reads. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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
 * The repeating week.
 *
 * This is a **generator, not a second source of availability**. Applying it
 * writes real times into real days; nothing here is consulted when somebody
 * books. A day remains exactly its own list of times — the pattern just saves
 * typing them out every week.
 *
 * It only ever fills days nobody has ruled on. A day you cleared stays cleared,
 * because clearing it *was* a decision, and having the calendar quietly undo
 * your afternoon off overnight would be worse than no pattern at all.
 */
export function WeeklyDefaultPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { services } = useServices(true);
  const appointmentMinutes = services[0]?.duration_min ?? 60;
  const [dayEditorDate, setDayEditorDate] = useState(() =>
    toSalonDate(new Date(), timezone),
  );
  const [days, setDays] = useState<TemplateDay[]>([]);
  const [status, setStatus] = useState<WeeklyTemplateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState<number | 'apply' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [fill, setFill] = useState({ from: '09:00', to: '17:00', every: '60' });
  const [weeks, setWeeks] = useState('8');
  const [newTime, setNewTime] = useState<Record<number, string>>({});
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [template, stat] = await Promise.all([
        listWeeklyTemplate(),
        getWeeklyTemplateStatus(),
      ]);
      setDays(template);
      setStatus(stat);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDay = async (dayOfWeek: number, times: string[]): Promise<void> => {
    setBusy(dayOfWeek);
    setFormError(null);
    try {
      await setWeeklyTemplateDay(dayOfWeek, [...new Set(times)].sort());
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const apply = async (replace: boolean): Promise<void> => {
    const weeksAhead = Number(weeks);
    if (!Number.isFinite(weeksAhead) || weeksAhead < 1) {
      setFormError('Choose how many weeks to fill.');
      return;
    }

    setBusy('apply');
    setFormError(null);
    setMessage(null);
    try {
      const from = toSalonDate(new Date(), timezone);
      const result = await applyWeeklyTemplate(
        from,
        addDays(from, weeksAhead * 7),
        replace,
      );
      setMessage(
        result.days_filled === 0
          ? 'Nothing to fill — every day in that period had already been decided.'
          : `Filled ${result.days_filled} day${result.days_filled === 1 ? '' : 's'} with ${result.slots_written} time${result.slots_written === 1 ? '' : 's'}.`,
      );
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  // 'Replace every day' overwrites days the owner has already decided, so it
  // gates on a confirmation; 'Fill empty days' only ever touches days nobody
  // has ruled on, so it runs straight away. The weeks-ahead validation still
  // has to happen before the dialog opens — an invalid value should surface
  // its error immediately rather than behind a confirmation for an apply that
  // is about to fail anyway.
  const requestApply = (replace: boolean): void => {
    if (!replace) {
      void apply(false);
      return;
    }
    const weeksAhead = Number(weeks);
    if (!Number.isFinite(weeksAhead) || weeksAhead < 1) {
      setFormError('Choose how many weeks to fill.');
      return;
    }
    setConfirmingReplace(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Weekly hours">
        <CalendarCapacityTabs />
        <LoadingState />
      </DashboardLayout>
    );
  }

  const totalTimes = days.reduce((n, d) => n + d.times.length, 0);

  return (
    <DashboardLayout
      title="Weekly hours"
      subtitle="A repeating week, so you are not typing times every day"
    >
      <CalendarCapacityTabs />

      {error && <ErrorState error={error} onRetry={() => void load()} />}

      <Card className="mb-6 p-5">
        <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
          Adjust a single day
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Override the pattern for one date — a day off, an extra evening, a one-time
          change. This is the same publish/remove tool the Calendar used to show inline;
          it lives here now, next to the pattern it overrides.
        </p>

        <label
          htmlFor="day-editor-date"
          className="mb-1 block text-xs text-muted-foreground"
        >
          Date
        </label>
        <DatePicker
          id="day-editor-date"
          className="mb-4 w-56"
          value={dayEditorDate}
          onChange={setDayEditorDate}
        />

        <DayPanel
          date={dayEditorDate}
          timezone={timezone}
          appointmentMinutes={appointmentMinutes}
          onChanged={() => void load()}
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
          Your usual week
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Set the times you normally work. A day with no times is a day you are normally
          closed.
        </p>

        <div className="space-y-4">
          {DAY_ORDER.map((dayIndex) => {
            const day = days.find((d) => d.day_of_week === dayIndex);
            const times = day?.times ?? [];
            const name = DAYS_OF_WEEK[dayIndex]?.name ?? '';

            return (
              <div key={dayIndex} className="border-b border-border pb-4 last:border-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{name}</p>
                  <span className="text-xs text-muted-foreground">
                    {times.length === 0
                      ? 'Closed'
                      : `${times.length} time${times.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                {times.length > 0 && (
                  <ul className="mb-2 flex flex-wrap gap-1.5">
                    {times.map((t) => (
                      <li key={t}>
                        <button
                          type="button"
                          disabled={busy === dayIndex}
                          onClick={() =>
                            void saveDay(
                              dayIndex,
                              times.filter((x) => x !== t),
                            )
                          }
                          title="Remove from the weekly default"
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
                      setNewTime({ ...newTime, [dayIndex]: e.target.value })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy === dayIndex}
                    onClick={() =>
                      void saveDay(dayIndex, [...times, newTime[dayIndex] ?? '09:00'])
                    }
                  >
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busy === dayIndex}
                    onClick={() =>
                      void saveDay(
                        dayIndex,
                        buildTimes(fill.from, fill.to, Number(fill.every)),
                      )
                    }
                  >
                    Fill {fill.from}–{fill.to}
                  </Button>
                  {times.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy === dayIndex}
                      onClick={() => void saveDay(dayIndex, [])}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-md border border-border bg-muted p-3">
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
                onChange={(e) => setFill({ ...fill, from: e.target.value })}
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
                onChange={(e) => setFill({ ...fill, to: e.target.value })}
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
                onChange={(e) => setFill({ ...fill, every: e.target.value })}
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
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 font-display text-lg font-semibold text-foreground">
              Put it on the calendar
            </h2>
            <p className="text-sm text-muted-foreground">
              The pattern does nothing on its own — this is what writes it into real days.
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
              htmlFor="weeks-ahead"
              className="mb-1 block text-xs font-medium text-foreground"
            >
              How far ahead
            </label>
            <Select
              id="weeks-ahead"
              className="w-40"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
            >
              <option value="2">2 weeks</option>
              <option value="4">4 weeks</option>
              <option value="8">8 weeks</option>
              <option value="12">12 weeks</option>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy === 'apply'}
              disabled={totalTimes === 0}
              onClick={() => requestApply(false)}
            >
              Fill empty days
            </Button>
            <Button
              variant="ghost"
              loading={busy === 'apply'}
              disabled={totalTimes === 0}
              onClick={() => requestApply(true)}
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

        {status?.filled_to && (
          <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
            Calendar is set up to{' '}
            <span className="font-medium text-foreground">
              {formatDateLong(`${status.filled_to}T12:00:00Z`, 'UTC')}
            </span>
            .
          </p>
        )}
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-display text-base font-semibold text-foreground">
          How this behaves
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <ConfirmDialog
        open={confirmingReplace}
        title="Replace every day?"
        message={
          'Lay this week over every day in that period, replacing what is there?\n\n' +
          'Times with bookings against them are kept.'
        }
        tone="destructive"
        confirmLabel="Replace every day"
        onConfirm={() => {
          setConfirmingReplace(false);
          void apply(true);
        }}
        onCancel={() => setConfirmingReplace(false)}
      />
    </DashboardLayout>
  );
}
