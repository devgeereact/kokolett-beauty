import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listMonthSummary,
  listDaySlots,
  type DaySummary,
  type OwnerDaySlot,
} from '@/services/availabilityService';
import { listAppointments } from '@/services/appointmentService';
import { formatDateLong, formatDateShort, salonDayRange } from '@/lib/format';
import {
  monthGrid,
  monthLabel,
  parseDate,
  weekDates,
  type CalendarView,
} from '@/lib/calendar';
import { LIVE_STATUSES } from '@/types';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

const CANCELLED_AND_NO_SHOW_STATUSES: AppointmentStatus[] = [
  'cancelled',
  'rejected',
  'no_show',
];

interface UseCalendarData {
  cursor: { year: number; month: number };
  visibleDates: string[];
  range: { from: string; to: string };
  heading: string;
  summary: Map<string, DaySummary>;
  appointments: AppointmentDetailed[];
  daySlots: Map<string, OwnerDaySlot[]>;
  error: Error | null;
  reload: () => Promise<void>;
}

/**
 * The date math and the single Supabase fetch behind all four calendar
 * views: which dates are visible, the range that covers them, and the
 * summary/appointments/open-slots rows for that range. `view` and `anchor`
 * stay owned by `CalendarPage` (its header controls act on them directly);
 * this hook only reacts to them.
 */
export function useCalendarData(
  view: CalendarView,
  anchor: string,
  timezone: string,
  showCancelledNoShow: boolean,
): UseCalendarData {
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

  const heading =
    view === 'month'
      ? monthLabel(cursor.year, cursor.month)
      : view === 'week'
        ? `${formatDateShort(`${range.from}T12:00:00Z`, 'UTC')} to ${formatDateShort(`${range.to}T12:00:00Z`, 'UTC')}`
        : formatDateLong(`${anchor}T12:00:00Z`, 'UTC');

  const [summary, setSummary] = useState<Map<string, DaySummary>>(new Map());
  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [daySlots, setDaySlots] = useState<Map<string, OwnerDaySlot[]>>(new Map());
  const [error, setError] = useState<Error | null>(null);

  // Stepping through views or dates restarts this fetch before the previous
  // one has landed. Without the sequence guard a slow earlier request can
  // overwrite what is now on screen — see CalendarPage's prior single-month
  // version, which carried the same guard for the same reason.
  const requestId = useRef(0);

  const reload = useCallback(async (): Promise<void> => {
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
    void reload();
  }, [reload]);

  return {
    cursor,
    visibleDates,
    range,
    heading,
    summary,
    appointments,
    daySlots,
    error,
    reload,
  };
}
