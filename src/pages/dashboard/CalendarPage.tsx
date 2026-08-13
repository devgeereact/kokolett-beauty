import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CalendarCapacityTabs } from '@/components/dashboard/CalendarCapacityTabs';
import { CalendarShell } from '@/components/dashboard/calendar/CalendarShell';
import { WeekView } from '@/components/dashboard/calendar/WeekView';
import { DayView } from '@/components/dashboard/calendar/DayView';
import { MonthView } from '@/components/dashboard/calendar/MonthView';
import { AppointmentCard } from '@/components/dashboard/AppointmentCard';
import { MoveAppointmentPanel } from '@/components/dashboard/calendar/MoveAppointmentPanel';
import { NewBookingPanel } from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  listMonthSummary,
  listDaySlots,
  type DaySummary,
  type OwnerDaySlot,
} from '@/services/availabilityService';
import {
  listAppointments,
  setAppointmentStatus,
  setOwnerNote,
} from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import {
  formatDateLong,
  formatDateShort,
  salonDayRange,
  toSalonDate,
} from '@/lib/format';
import {
  monthGrid,
  monthLabel,
  parseDate,
  shiftAnchor,
  weekDates,
  type CalendarView,
} from '@/lib/calendar';
import { LIVE_STATUSES } from '@/types';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/** Bucket appointments by their salon-local calendar date. */
function groupByDate(
  appointments: AppointmentDetailed[],
  timezone: string,
): Map<string, AppointmentDetailed[]> {
  const map = new Map<string, AppointmentDetailed[]>();
  for (const a of appointments) {
    const date = toSalonDate(a.starts_at, timezone);
    const list = map.get(date) ?? [];
    list.push(a);
    map.set(date, list);
  }
  return map;
}

/**
 * The calendar.
 *
 * One page, three views over the same day-is-a-list-of-times model
 * (`docs/SCHEMA.md`, migration 0011): Month for orientation, Week for the
 * working shape of a fortnight, Day for the hour-by-hour grid a chair-side
 * owner actually works from. `view` and `anchor` (the focused date) live here
 * because the header's prev/today/next controls and the view tabs both act on
 * them, and because the three grids read from a single Supabase fetch keyed
 * off whichever date range the active view needs — a day never re-derives
 * data another view already holds.
 */
export function CalendarPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const { showToast } = useToast();
  const today = toSalonDate(new Date(), timezone);

  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [newBooking, setNewBooking] = useState<{ date: string; time: string } | null>(
    null,
  );

  const [summary, setSummary] = useState<Map<string, DaySummary>>(new Map());
  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [daySlots, setDaySlots] = useState<Map<string, OwnerDaySlot[]>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  const cursor = useMemo(() => {
    const d = parseDate(anchor);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, [anchor]);

  // Every view's date list, in salon-calendar order. Month's list is the full
  // six-week grid (padding days included) so `range` below spans exactly what
  // `MonthView` renders; Week and Day only ever request their own days.
  const visibleDates = useMemo(() => {
    if (view === 'day') return [anchor];
    if (view === 'week') return weekDates(anchor);
    return monthGrid(cursor.year, cursor.month).flat();
  }, [view, anchor, cursor]);

  const range = useMemo(
    () => ({
      from: visibleDates[0] ?? anchor,
      to: visibleDates[visibleDates.length - 1] ?? anchor,
    }),
    [visibleDates, anchor],
  );

  // Stepping through views or dates restarts this fetch before the previous
  // one has landed. Without the sequence guard a slow earlier request can
  // overwrite what is now on screen — see CalendarPage's prior single-month
  // version, which carried the same guard for the same reason.
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = (requestId.current += 1);
    try {
      const needsSummary = view === 'month';
      const needsSlots = view === 'week' || view === 'day';

      const [summaryRows, appts, slotRows] = await Promise.all([
        needsSummary ? listMonthSummary(range.from, range.to) : Promise.resolve([]),
        listAppointments({
          from: salonDayRange(range.from, timezone).start,
          to: salonDayRange(range.to, timezone).end,
          statuses: [...LIVE_STATUSES],
        }),
        needsSlots
          ? Promise.all(visibleDates.map((d) => listDaySlots(d)))
          : Promise.resolve([]),
      ]);

      if (id !== requestId.current) return;

      setSummary(new Map(summaryRows.map((r) => [r.on_date, r])));
      setAppointments(appts);
      setDaySlots(
        needsSlots
          ? new Map(visibleDates.map((d, i) => [d, slotRows[i] ?? []]))
          : new Map(),
      );
      setError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [view, range.from, range.to, timezone, visibleDates]);

  useEffect(() => {
    void load();
  }, [load]);

  // A detail card open when the owner switches view or date must not survive
  // the switch — including on a failed refetch, where `appointments` is left
  // stale (matching how the rest of this page already handles a failed
  // reload, via the `ErrorState`/retry affordance above). Without this, a
  // dropped connection mid-navigation can leave a stale appointment's status
  // buttons live on screen with no indication it belongs to a different day.
  useEffect(() => {
    setSelectedId(null);
    setMoving(false);
    setNewBooking(null);
  }, [view, anchor]);

  const appointmentsByDate = useMemo(
    () => groupByDate(appointments, timezone),
    [appointments, timezone],
  );
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const changeStatus = useCallback(
    async (id: string, status: AppointmentStatus): Promise<void> => {
      try {
        await setAppointmentStatus(id, status);
        await load();
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [load, showToast],
  );

  const saveNote = useCallback(async (id: string, note: string): Promise<void> => {
    await setOwnerNote(id, note);
  }, []);

  const goToDay = useCallback((date: string): void => {
    setAnchor(date);
    setView('day');
  }, []);

  const selectAppointment = useCallback((appointment: AppointmentDetailed): void => {
    setNewBooking(null);
    setSelectedId(appointment.id);
  }, []);

  const selectOpenSlot = useCallback((date: string, slot: OwnerDaySlot): void => {
    setSelectedId(null);
    setMoving(false);
    setNewBooking({ date, time: slot.local_time });
  }, []);

  const heading =
    view === 'month'
      ? monthLabel(cursor.year, cursor.month)
      : view === 'week'
        ? `${formatDateShort(`${range.from}T12:00:00Z`, 'UTC')} – ${formatDateShort(`${range.to}T12:00:00Z`, 'UTC')}`
        : formatDateLong(`${anchor}T12:00:00Z`, 'UTC');

  return (
    <DashboardLayout
      title="Calendar"
      subtitle={heading}
      actions={
        <div className="flex items-center gap-3">
          <CalendarShell view={view} onViewChange={setView} />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous"
              onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
            >
              ‹
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next"
              onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}
            >
              ›
            </Button>
          </div>
        </div>
      }
    >
      <CalendarCapacityTabs />

      {error && <ErrorState error={error} onRetry={() => void load()} />}

      {view === 'month' && (
        <MonthView
          year={cursor.year}
          month={cursor.month}
          today={today}
          timezone={timezone}
          summary={summary}
          appointmentsByDate={appointmentsByDate}
          onSelectDate={goToDay}
        />
      )}

      {view === 'week' && (
        <WeekView
          dates={visibleDates}
          today={today}
          timezone={timezone}
          appointmentsByDate={appointmentsByDate}
          openSlotsByDate={daySlots}
          onSelectAppointment={selectAppointment}
          onSelectDate={goToDay}
          onSelectOpenSlot={selectOpenSlot}
          onChanged={() => void load()}
        />
      )}

      {view === 'day' && (
        <DayView
          date={anchor}
          today={today}
          timezone={timezone}
          appointments={appointmentsByDate.get(anchor) ?? []}
          openSlots={daySlots.get(anchor) ?? []}
          onSelectAppointment={selectAppointment}
          onSelectOpenSlot={(slot) => selectOpenSlot(anchor, slot)}
          onChanged={() => void load()}
        />
      )}

      {selected && (
        <div className="mt-6">
          <AppointmentCard
            appointment={selected}
            timezone={timezone}
            onStatusChange={changeStatus}
            onNoteSave={saveNote}
            onMove={() => setMoving(true)}
          />
        </div>
      )}

      {selected &&
        moving &&
        (selected.status === 'confirmed' || selected.status === 'pending_approval') && (
          <div className="mt-4">
            <MoveAppointmentPanel
              key={selected.id}
              appointment={selected}
              timezone={timezone}
              onClose={() => setMoving(false)}
              onMoved={() => {
                setMoving(false);
                setSelectedId(null);
                void load();
              }}
            />
          </div>
        )}

      {newBooking && (
        <div className="mt-6">
          <NewBookingPanel
            key={`${newBooking.date}T${newBooking.time}`}
            initialDate={newBooking.date}
            initialTime={newBooking.time}
            onClose={() => setNewBooking(null)}
            onBooked={() => {
              setNewBooking(null);
              void load();
            }}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
