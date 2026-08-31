import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CalendarShell } from '@/components/dashboard/calendar/CalendarShell';
import { WeekView } from '@/components/dashboard/calendar/WeekView';
import { DayView } from '@/components/dashboard/calendar/DayView';
import { MonthView } from '@/components/dashboard/calendar/MonthView';
import { AgendaList, type AgendaEntry } from '@/components/dashboard/calendar/AgendaList';
import { AppointmentEditModal } from '@/components/dashboard/AppointmentEditModal';
import { AppointmentDetailPanel } from '@/components/dashboard/calendar/AppointmentDetailPanel';
import { MiniMonthCalendar } from '@/components/dashboard/calendar/MiniMonthCalendar';
import { CalendarFiltersCard } from '@/components/dashboard/calendar/CalendarFiltersCard';
import { CalendarLegend } from '@/components/dashboard/calendar/CalendarLegend';
import { NewBookingPanel } from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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
  deleteAppointmentAsOwner,
  listAppointments,
  setAppointmentStatus,
  setOwnerNote,
} from '@/services/appointmentService';
import { logPayment } from '@/services/paymentService';
import { errorMessage } from '@/lib/errors';
import {
  formatDateLong,
  formatDateShort,
  formatTime,
  salonDayRange,
  toSalonDate,
} from '@/lib/format';
import {
  CALENDAR_GRID_HEIGHT_CLASS,
  monthGrid,
  monthLabel,
  parseDate,
  shiftAnchor,
  weekDates,
  type CalendarView,
} from '@/lib/calendar';
import { STATUS_CATEGORIES, STATUS_CATEGORY, type StatusCategory } from '@/lib/status';
import { cn } from '@/lib/utils';
import { LIVE_STATUSES } from '@/types';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

const CANCELLED_AND_NO_SHOW_STATUSES: AppointmentStatus[] = [
  'cancelled',
  'rejected',
  'no_show',
];

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
  const [editing, setEditing] = useState(false);
  const [newBooking, setNewBooking] = useState<{ date: string; time: string } | null>(
    null,
  );

  const [summary, setSummary] = useState<Map<string, DaySummary>>(new Map());
  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [daySlots, setDaySlots] = useState<Map<string, OwnerDaySlot[]>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  // Rail filters — client-side only, over whatever `load()` already fetched.
  const [visibleCategories, setVisibleCategories] = useState<Set<StatusCategory>>(
    () => new Set(STATUS_CATEGORIES),
  );
  const [showCancelledNoShow, setShowCancelledNoShow] = useState(false);

  const cursor = useMemo(() => {
    const d = parseDate(anchor);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, [anchor]);

  // Every view's date list, in salon-calendar order. Month's list is the full
  // six-week grid (padding days included) so `range` below spans exactly what
  // `MonthView` renders; Week, Day and Agenda only ever request their own day.
  const visibleDates = useMemo(() => {
    if (view === 'day' || view === 'agenda') return [anchor];
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
      const needsSlots = view === 'week' || view === 'day' || view === 'agenda';

      const [summaryRows, appts, slotRows] = await Promise.all([
        needsSummary ? listMonthSummary(range.from, range.to) : Promise.resolve([]),
        listAppointments({
          from: salonDayRange(range.from, timezone).start,
          to: salonDayRange(range.to, timezone).end,
          statuses: showCancelledNoShow
            ? [...LIVE_STATUSES, ...CANCELLED_AND_NO_SHOW_STATUSES]
            : [...LIVE_STATUSES],
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
  }, [view, range.from, range.to, timezone, visibleDates, showCancelledNoShow]);

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
    setEditing(false);
    setNewBooking(null);
  }, [view, anchor]);

  // Status-category checkboxes filter what's drawn, not what's fetched —
  // `showCancelledNoShow` (above) is what widens the fetch itself.
  const visibleAppointments = useMemo(
    () => appointments.filter((a) => visibleCategories.has(STATUS_CATEGORY[a.status])),
    [appointments, visibleCategories],
  );
  const appointmentsByDate = useMemo(
    () => groupByDate(visibleAppointments, timezone),
    [visibleAppointments, timezone],
  );
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  // The rail is never empty when there's something to show, matching
  // docs/design/calendar.png (its rail always shows a real appointment, not
  // an empty prompt): with nothing explicitly clicked, prefer whichever
  // appointment is happening right now, else the soonest one still to come.
  const defaultAppointment = useMemo((): AppointmentDetailed | null => {
    const nowMs = Date.now();
    const byStartsAt = (a: AppointmentDetailed, b: AppointmentDetailed): number =>
      a.starts_at.localeCompare(b.starts_at);

    const inService = [...appointments]
      .filter((a) => a.status === 'in_service')
      .sort(byStartsAt)[0];
    if (inService) return inService;

    const upcoming = [...appointments]
      .filter(
        (a) =>
          (a.status === 'confirmed' ||
            a.status === 'pending_approval' ||
            a.status === 'checked_in') &&
          new Date(a.starts_at).getTime() >= nowMs,
      )
      .sort(byStartsAt)[0];
    return upcoming ?? null;
  }, [appointments]);

  const displayed = selected ?? defaultAppointment;
  const displayedContextLabel = selected
    ? undefined
    : displayed?.status === 'in_service'
      ? 'Currently in service'
      : displayed
        ? 'Next up'
        : undefined;

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

  const saveNote = useCallback(
    async (id: string, note: string): Promise<void> => {
      try {
        await setOwnerNote(id, note);
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [showToast],
  );

  const logPaymentHandler = useCallback(
    async (
      id: string,
      amountPence: number,
      note: string,
      correctsPaymentId?: string,
    ): Promise<void> => {
      try {
        await logPayment(id, amountPence, note, correctsPaymentId);
        await load();
      } catch (e) {
        showToast({ message: errorMessage(e) });
        throw e;
      }
    },
    [load, showToast],
  );

  const deleteHandler = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteAppointmentAsOwner(id);
        showToast({ message: 'Appointment deleted.' });
        setSelectedId(null);
        await load();
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [load, showToast],
  );

  const goToDay = useCallback((date: string): void => {
    setAnchor(date);
    setView('day');
  }, []);

  const selectAppointment = useCallback((appointment: AppointmentDetailed): void => {
    setNewBooking(null);
    setEditing(false);
    setSelectedId(appointment.id);
  }, []);

  const selectOpenSlot = useCallback((date: string, slot: OwnerDaySlot): void => {
    setSelectedId(null);
    setEditing(false);
    setNewBooking({ date, time: slot.local_time });
  }, []);

  // Chronological merge of the day's bookings and open published times —
  // Agenda's accessible, zero-drag alternative to Day's positioned grid.
  const agendaEntries = useMemo((): AgendaEntry[] => {
    if (view !== 'agenda') return [];
    const booked = (appointmentsByDate.get(anchor) ?? []).map((a) => ({
      sortKey: a.starts_at,
      entry: {
        key: a.id,
        time: formatTime(a.starts_at, timezone),
        label: `${a.customer_name ?? 'Customer'} · ${a.service_name ?? ''}`,
        variant: 'booked' as const,
        status: a.status,
        onClick: () => selectAppointment(a),
      },
    }));
    const open = (daySlots.get(anchor) ?? [])
      .filter((s) => !s.is_booked && !s.is_past)
      .map((s) => ({
        sortKey: s.starts_at,
        entry: {
          key: s.starts_at,
          time: s.local_time,
          label: `+ Add · ${s.local_time}`,
          variant: 'open' as const,
          onClick: () => selectOpenSlot(anchor, s),
        },
      }));
    return [...booked, ...open]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((row) => row.entry);
  }, [
    view,
    anchor,
    appointmentsByDate,
    daySlots,
    timezone,
    selectAppointment,
    selectOpenSlot,
  ]);

  const toggleCategory = useCallback(
    (category: StatusCategory, visible: boolean): void => {
      setVisibleCategories((prev) => {
        const next = new Set(prev);
        if (visible) next.add(category);
        else next.delete(category);
        return next;
      });
    },
    [],
  );

  const heading =
    view === 'month'
      ? monthLabel(cursor.year, cursor.month)
      : view === 'week'
        ? `${formatDateShort(`${range.from}T12:00:00Z`, 'UTC')} – ${formatDateShort(`${range.to}T12:00:00Z`, 'UTC')}`
        : formatDateLong(`${anchor}T12:00:00Z`, 'UTC');

  return (
    <DashboardLayout
      title="Calendar"
      subtitle="Manage your schedule, drag to reschedule appointments."
      actions={
        <Button size="sm" onClick={() => setNewBooking({ date: anchor, time: '10:00' })}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          New booking
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 opacity-70"
            strokeWidth={2.5}
          />
        </Button>
      }
    >
      {/* The one place for date navigation + view switch — the header row
          above only starts a booking, so Today/prev/next isn't shown twice. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous"
            onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}
          >
            ‹
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
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium text-foreground">
          {heading}
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5 text-muted-foreground"
            strokeWidth={2}
          />
        </span>
        <CalendarShell view={view} onViewChange={setView} />
      </div>

      {error && <ErrorState error={error} onRetry={() => void load()} />}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
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

          {view === 'agenda' && (
            <div
              className={cn(
                'overflow-y-auto rounded-md border border-border bg-card p-4',
                CALENDAR_GRID_HEIGHT_CLASS,
              )}
            >
              <AgendaList
                entries={agendaEntries}
                emptyLabel="Nothing published for this day."
              />
            </div>
          )}
        </div>

        <aside
          className={cn(
            'flex w-full flex-col gap-4 lg:w-80 lg:shrink-0',
            // Matched to the grid's own height, desktop/tablet two-column
            // layout only, all four views now that Month/Agenda are also
            // height-capped — so the rail's bottom lines up with the
            // calendar's instead of growing past it once a selected
            // appointment's details lengthen the card. Overflow scrolls
            // inside the rail rather than the whole page. Unconstrained on
            // mobile, where the rail stacks full-width below the grid and
            // should just show everything via normal page scroll.
            'lg:h-[calc(100vh-16rem)] lg:min-h-[480px] lg:overflow-y-auto',
          )}
        >
          <AppointmentDetailPanel
            appointment={displayed}
            contextLabel={displayedContextLabel}
            timezone={timezone}
            onClose={selected ? () => setSelectedId(null) : undefined}
            onEdit={() => setEditing(true)}
          />
          <div className="rounded-md border border-border bg-card p-3">
            <MiniMonthCalendar anchor={anchor} onSelect={setAnchor} />
          </div>
          <CalendarFiltersCard
            visibleCategories={visibleCategories}
            onToggleCategory={toggleCategory}
            showCancelled={showCancelledNoShow}
            onToggleShowCancelled={setShowCancelledNoShow}
          />
        </aside>
      </div>

      <div className="mt-6">
        <CalendarLegend />
      </div>

      <AppointmentEditModal
        appointment={displayed}
        open={editing}
        timezone={timezone}
        onClose={() => setEditing(false)}
        onStatusChange={changeStatus}
        onNoteSave={saveNote}
        onLogPayment={logPaymentHandler}
        onDelete={deleteHandler}
        onMoved={() => {
          setSelectedId(null);
          void load();
        }}
      />

      <Modal
        open={!!newBooking}
        onClose={() => setNewBooking(null)}
        ariaLabel="Take a booking"
      >
        {newBooking && (
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
        )}
      </Modal>
    </DashboardLayout>
  );
}
