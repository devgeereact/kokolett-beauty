import { type JSX, useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DayPanel } from '@/components/dashboard/DayPanel';
import { OpeningHoursSummaryCard } from '@/components/dashboard/availability/OpeningHoursSummaryCard';
import { NextWeeksGlanceCard } from '@/components/dashboard/availability/NextWeeksGlanceCard';
import { BookingRulesCard } from '@/components/dashboard/availability/BookingRulesCard';
import { BookingPageStatusCard } from '@/components/dashboard/availability/BookingPageStatusCard';
import { SpecialHoursClosuresCard } from '@/components/dashboard/availability/SpecialHoursClosuresCard';
import { ApplyPatternSection } from '@/components/dashboard/availability/ApplyPatternSection';
import {
  WeeklyScheduleCard,
  type FillOptions,
} from '@/components/dashboard/availability/WeeklyScheduleCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
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
import { addMonths, toSalonDate } from '@/lib/format';
import { routes } from '@/lib/routes';

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

  const [fill, setFill] = useState<FillOptions>({
    from: '09:00',
    to: '17:00',
    every: '60',
  });
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
          ? 'Nothing to fill. Every day in that period had already been decided.'
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <WeeklyScheduleCard
            days={days}
            settings={settings}
            timezone={timezone}
            filledTo={status?.filled_to ?? null}
            busy={busy}
            onSaveDay={(dayOfWeek, times) => void saveDay(dayOfWeek, times)}
            fill={fill}
            onFillChange={setFill}
            showAdvanced={showAdvanced}
            onShowAdvancedChange={setShowAdvanced}
            openDayIndex={openDayIndex}
            onOpenDayIndexChange={setOpenDayIndex}
            newTime={newTime}
            onNewTimeChange={setNewTime}
            onAdjustSingleDay={() => openDayEditor(dayEditorDate)}
          />

          {showAdvanced && (
            <ApplyPatternSection
              totalTimes={totalTimes}
              months={months}
              onMonthsChange={setMonths}
              busy={busy}
              onRequestApply={requestApply}
              message={message}
              formError={formError}
              filledTo={status?.filled_to ?? null}
            />
          )}

          <SpecialHoursClosuresCard
            timezone={timezone}
            days={days}
            filledTo={status?.filled_to ?? null}
            refreshToken={dayEditVersion}
            onEditDate={openDayEditor}
          />
        </div>

        <div className="space-y-6">
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
