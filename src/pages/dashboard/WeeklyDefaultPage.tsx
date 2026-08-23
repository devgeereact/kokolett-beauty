import { type JSX, useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DayPanel } from '@/components/dashboard/DayPanel';
import { OpeningHoursSummaryCard } from '@/components/dashboard/availability/OpeningHoursSummaryCard';
import { NextWeeksGlanceCard } from '@/components/dashboard/availability/NextWeeksGlanceCard';
import { BookingRulesCard } from '@/components/dashboard/availability/BookingRulesCard';
import { BookingPageStatusCard } from '@/components/dashboard/availability/BookingPageStatusCard';
import { SpecialHoursClosuresCard } from '@/components/dashboard/availability/SpecialHoursClosuresCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
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
import { addMonths, DAYS_OF_WEEK, formatDateLong, toSalonDate } from '@/lib/format';
import { routes } from '@/lib/routes';
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
 * The repeating week — matching `docs/design/avalability.png`'s layout
 * (compact day-row table + sidebar) as closely as this app's real
 * availability model allows.
 *
 * The reference assumes a richer model than this app has on purpose: a
 * continuous "opening hours" range with a separately-editable "breaks"
 * range, a per-day-of-week "max bookings" figure, and a per-day "online
 * booking" toggle distinct from its open/closed status. None of those are
 * real here — `max_appointments_per_day` is one global `booking_settings`
 * value (already editable on Settings → Business, mirrored read-only by
 * `BookingRulesCard`), and a day's own list of published times is
 * simultaneously its hours, its breaks (the gaps in the list) and its
 * open/closed status — there's nothing else to toggle. Rather than fabricate
 * three columns with no backing data, this shows what's real: the times
 * themselves. See `SpecialHoursClosuresCard` for the same reasoning applied
 * to the reference's closures list.
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
  const { timezone, settings } = useBusinessSettings();
  const { services } = useServices(true);
  const appointmentMinutes = services[0]?.duration_min ?? 60;
  const [dayEditorDate, setDayEditorDate] = useState(() =>
    toSalonDate(new Date(), timezone),
  );
  const [dayEditorOpen, setDayEditorOpen] = useState(false);
  const [days, setDays] = useState<TemplateDay[]>([]);
  const [status, setStatus] = useState<WeeklyTemplateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState<number | 'apply' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [fill, setFill] = useState({ from: '09:00', to: '17:00', every: '60' });
  const [months, setMonths] = useState('3');
  const [newTime, setNewTime] = useState<Record<number, string>>({});
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  // Bumped whenever a day's published times actually change, so
  // `SpecialHoursClosuresCard` refetches even when that edit doesn't move
  // `status.filled_to` (an ordinary single-day edit usually doesn't).
  const [dayEditVersion, setDayEditVersion] = useState(0);
  // Accordion: one day's editor open at a time, none by default — the
  // reference's "Weekly schedule" is one compact row per day, not seven
  // always-expanded chip editors stacked on top of each other.
  const [openDayIndex, setOpenDayIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    const monthsAhead = Number(months);
    if (!Number.isFinite(monthsAhead) || monthsAhead < 1) {
      setFormError('Choose how far ahead to publish.');
      return;
    }

    setBusy('apply');
    setFormError(null);
    setMessage(null);
    try {
      const from = toSalonDate(new Date(), timezone);
      const result = await applyWeeklyTemplate(
        from,
        addMonths(from, monthsAhead),
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
  // has ruled on, so it runs straight away. The months-ahead validation still
  // has to happen before the dialog opens — an invalid value should surface
  // its error immediately rather than behind a confirmation for an apply that
  // is about to fail anyway.
  const requestApply = (replace: boolean): void => {
    if (!replace) {
      void apply(false);
      return;
    }
    const monthsAhead = Number(months);
    if (!Number.isFinite(monthsAhead) || monthsAhead < 1) {
      setFormError('Choose how far ahead to publish.');
      return;
    }
    setConfirmingReplace(true);
  };

  const openDayEditor = (date: string): void => {
    setDayEditorDate(date);
    setDayEditorOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout title="Availability">
        <LoadingState />
      </DashboardLayout>
    );
  }

  const totalTimes = days.reduce((n, d) => n + d.times.length, 0);

  return (
    <DashboardLayout
      title="Availability"
      subtitle="Set your working hours and booking preferences."
      actions={
        <a
          href={routes.public.book}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Preview booking page
        </a>
      }
    >
      {error && <ErrorState error={error} onRetry={() => void load()} />}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
              Weekly schedule
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">
              Set the times you normally work. A day with no times is a day you are
              normally closed.
            </p>
            <p className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              This is your repeating pattern only — changes here don&rsquo;t reach the
              calendar on their own.{' '}
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="font-medium text-primary hover:underline"
              >
                Show advanced options
              </button>{' '}
              below to apply it.
              {status?.filled_to && (
                <>
                  {' '}
                  Calendar is currently filled up to{' '}
                  <span className="font-medium text-foreground">
                    {formatDateLong(`${status.filled_to}T12:00:00Z`, 'UTC')}
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
                        setOpenDayIndex((cur) => (cur === dayIndex ? null : dayIndex))
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
                            {sorted[0]}–{sorted.at(-1)}
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
                              void saveDay(dayIndex, [
                                ...times,
                                newTime[dayIndex] ?? '09:00',
                              ])
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
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDayEditor(dayEditorDate)}
              >
                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                Adjust a single day
              </Button>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                All times are in {timezone}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
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
                      onChange={(e) => setFill({ ...fill, from: e.target.value })}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="tf-to"
                      className="mb-1 block text-xs text-muted-foreground"
                    >
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
            )}
          </Card>

          {showAdvanced && (
            <>
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
                      Put it on the calendar
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      The pattern does nothing on its own — this is what writes it into
                      real days.
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2 rounded-md border border-border bg-muted px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      Times set this week
                    </span>
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
                      onChange={(e) => setMonths(e.target.value)}
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

              <Card className="p-5">
                <h3 className="mb-4 font-serif text-base font-semibold text-foreground">
                  How this behaves
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      Fill empty days
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Only touches days you have never set. A day you cleared stays
                      cleared.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      Replace every day
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Lays the week over the top, including days you have changed. Times
                      with bookings against them are always kept.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      Fills forward nightly
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The calendar quietly extends from this pattern each night, so you
                      never run out of bookable days.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="mb-1 text-sm font-medium text-foreground">
                      A single day always wins
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Editing any date above overrides the pattern for that date from then
                      on.
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}

          <SpecialHoursClosuresCard
            timezone={timezone}
            days={days}
            filledTo={status?.filled_to ?? null}
            refreshToken={dayEditVersion}
            onEditDate={openDayEditor}
          />
        </div>

        <div className="space-y-4">
          <OpeningHoursSummaryCard days={days} />
          <NextWeeksGlanceCard timezone={timezone} days={days} />
          <BookingRulesCard settings={settings} />
          <BookingPageStatusCard />
        </div>
      </div>

      <Modal
        open={dayEditorOpen}
        onClose={() => setDayEditorOpen(false)}
        ariaLabel="Adjust a single day"
        className="max-w-modal-md"
      >
        <div className="mb-4">
          <label
            htmlFor="day-editor-date"
            className="mb-1 block text-xs text-muted-foreground"
          >
            Date
          </label>
          <DatePicker
            id="day-editor-date"
            className="w-56"
            value={dayEditorDate}
            onChange={setDayEditorDate}
          />
        </div>
        <DayPanel
          date={dayEditorDate}
          timezone={timezone}
          appointmentMinutes={appointmentMinutes}
          onChanged={() => {
            setDayEditVersion((v) => v + 1);
            void load();
          }}
        />
      </Modal>

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
