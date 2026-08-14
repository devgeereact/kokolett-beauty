/**
 * Date-range maths for the Appointments list — kept separate from the page
 * component so the filter rail can share the exact same `DateMode` type and
 * stepping logic without importing from a page file.
 */
import { parseDate, shiftMonth, weekDates, monthLabel } from '@/lib/calendar';
import { addDays, formatDateLong, formatDateShort, salonDayRange } from '@/lib/format';

export type DateMode = 'today' | 'week' | 'month' | 'last7' | 'last30' | 'all';

export interface DateRange {
  from: Date;
  to: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** First/last day of `anchor`'s month, as `yyyy-mm-dd`. */
function monthBounds(anchor: string): { first: string; last: string } {
  const d = parseDate(anchor);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    first: `${year}-${pad(month + 1)}-01`,
    last: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

export function computeDateRange(
  mode: DateMode,
  anchor: string,
  today: string,
  timezone: string,
): DateRange {
  switch (mode) {
    case 'today': {
      const { start, end } = salonDayRange(anchor, timezone);
      return { from: start, to: end };
    }
    case 'week': {
      // weekDates always returns exactly 7 entries (lib/calendar.ts).
      const week = weekDates(anchor);
      const monday = week[0] as string;
      const sunday = week[6] as string;
      return {
        from: salonDayRange(monday, timezone).start,
        to: salonDayRange(sunday, timezone).end,
      };
    }
    case 'month': {
      const { first, last } = monthBounds(anchor);
      return {
        from: salonDayRange(first, timezone).start,
        to: salonDayRange(last, timezone).end,
      };
    }
    case 'last7':
      return {
        from: salonDayRange(addDays(today, -7), timezone).start,
        to: salonDayRange(addDays(today, -1), timezone).end,
      };
    case 'last30':
      return {
        from: salonDayRange(addDays(today, -30), timezone).start,
        to: salonDayRange(addDays(today, -1), timezone).end,
      };
    case 'all':
      // Wide, not unbounded — appointments_detailed only grows and
      // listAppointments() has no .limit(), so a genuinely-infinite query
      // here is a real future performance/cost risk. 2 years back / 1 year
      // forward is more headroom than a salon live since August 2026 needs.
      return {
        from: salonDayRange(addDays(today, -730), timezone).start,
        to: salonDayRange(addDays(today, 366), timezone).end,
      };
  }
}

/** Anchor strings are already UTC-noon-safe `yyyy-mm-dd` (see `lib/calendar.ts`), so this needs no timezone. */
export function dateRangeLabel(mode: DateMode, anchor: string): string {
  switch (mode) {
    case 'today':
      return formatDateLong(`${anchor}T12:00:00Z`, 'UTC');
    case 'week': {
      // weekDates always returns exactly 7 entries (lib/calendar.ts).
      const week = weekDates(anchor);
      const monday = week[0] as string;
      const sunday = week[6] as string;
      return `${formatDateShort(`${monday}T12:00:00Z`, 'UTC')} – ${formatDateShort(`${sunday}T12:00:00Z`, 'UTC')}`;
    }
    case 'month': {
      const d = parseDate(anchor);
      return monthLabel(d.getUTCFullYear(), d.getUTCMonth());
    }
    case 'last7':
      return 'Last 7 days';
    case 'last30':
      return 'Last 30 days';
    case 'all':
      return 'All time';
  }
}

/** Only 'today' / 'week' / 'month' step with prev/next — the others have no anchor. */
export function stepDateMode(mode: DateMode, anchor: string, direction: 1 | -1): string {
  if (mode === 'today') return addDays(anchor, direction);
  if (mode === 'week') return addDays(anchor, 7 * direction);
  if (mode === 'month') {
    const d = parseDate(anchor);
    const shifted = shiftMonth(d.getUTCFullYear(), d.getUTCMonth(), direction);
    return `${shifted.year}-${pad(shifted.month + 1)}-01`;
  }
  return anchor;
}
