import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
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
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useCalendarMutations } from '@/hooks/useCalendarMutations';
import type { OwnerDaySlot } from '@/services/availabilityService';
import { formatTime, toSalonDate } from '@/lib/format';
import {
  CALENDAR_GRID_HEIGHT_CLASS,
  shiftAnchor,
  type CalendarView,
} from '@/lib/calendar';
import { STATUS_CATEGORIES, STATUS_CATEGORY, type StatusCategory } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

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
 * them; the date math and the underlying fetch live in `useCalendarData`, and
 * the write side in `useCalendarMutations`.
 */
export function CalendarPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const today = toSalonDate(new Date(), timezone);

  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newBooking, setNewBooking] = useState<{ date: string; time: string } | null>(
    null,
  );

  // Rail filters — client-side only, over whatever `load()` already fetched.
  const [visibleCategories, setVisibleCategories] = useState<Set<StatusCategory>>(
    () => new Set(STATUS_CATEGORIES),
  );
  const [showCancelledNoShow, setShowCancelledNoShow] = useState(false);

  const {
    cursor,
    visibleDates,
    heading,
    summary,
    appointments,
    daySlots,
    error,
    reload,
  } = useCalendarData(view, anchor, timezone, showCancelledNoShow);

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

  const { changeStatus, saveNote, logPaymentHandler, deleteHandler } =
    useCalendarMutations(appointments, reload, () => setSelectedId(null));

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

      {error && <ErrorState error={error} onRetry={() => void reload()} />}

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
              onChanged={() => void reload()}
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
              onChanged={() => void reload()}
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
            /* `dvh`, not `vh`: on iPad Safari `100vh` counts the browser chrome
               that is not actually on screen, so the calendar was taller than
               the space it had and its last hour row sat under the toolbar.
               The 16rem subtracts this page's own header + view switcher; the
               Appointments table subtracts a different number because it has a
               filter bar as well. Both floor at a usable minimum. */
            'lg:h-[calc(100dvh-16rem)] lg:min-h-[480px] lg:overflow-y-auto',
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
          void reload();
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
              void reload();
            }}
          />
        )}
      </Modal>
    </DashboardLayout>
  );
}
