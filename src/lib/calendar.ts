/**
 * Calendar grid maths.
 *
 * Everything here works on `yyyy-mm-dd` strings anchored to UTC noon rather
 * than on local `Date` objects. A month grid built from browser-local dates
 * drifts by a day for anyone west of Greenwich, and the drift only shows up
 * near midnight — which is exactly when nobody is looking.
 */

import { addDays } from '@/lib/format';

/** `yyyy-mm-dd` for a Date, read in UTC. */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse `yyyy-mm-dd` to a Date at UTC noon, safely away from any DST edge. */
export function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function dayOfWeek(date: string): number {
  return parseDate(date).getUTCDay();
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)));
}

export function dayNumber(date: string): number {
  return parseDate(date).getUTCDate();
}

export function isSameMonth(date: string, year: number, month: number): boolean {
  const d = parseDate(date);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/**
 * Six weeks of dates covering the month, Monday-first.
 *
 * Always six rows, so the grid does not change height between months — a
 * calendar that resizes as you page through it is unpleasant to scan.
 */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1, 12));
  // getUTCDay: 0 = Sunday. Monday-first means Sunday sits at the end.
  const leading = (first.getUTCDay() + 6) % 7;

  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - leading);

  const weeks: string[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(iso(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Monday-first weekday headings. */
export const WEEKDAY_HEADINGS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

/** First and last date of the rendered grid, for one query per month. */
export function gridRange(year: number, month: number): { from: string; to: string } {
  const days = monthGrid(year, month).flat();
  // The grid is always 6x7, so both ends exist; the fallbacks satisfy
  // noUncheckedIndexedAccess without pretending an empty grid is possible.
  return { from: days[0] ?? '', to: days[days.length - 1] ?? '' };
}

// Hour-axis grid rendering support

/** Minutes-since-midnight bounds for the hour axis. Always multiples of 60. */
export interface HourRange {
  startMin: number;
  endMin: number;
}

/** Pixel height of one hour row — shared by the axis labels and the grid lines. */
export const HOUR_ROW_PX = 64;

const FALLBACK_RANGE: HourRange = { startMin: 8 * 60, endMin: 20 * 60 };
const MIN_SPAN_MIN = 6 * 60;
const DAY_MIN = 24 * 60;

/**
 * The hour axis to render, fitted to whatever is actually happening that day.
 *
 * An owner with one 9am booking should not see a 24-hour axis — but the axis
 * also should not be so tight that a single appointment fills the screen, so
 * it pads an hour either side and floors the span at 6 hours.
 */
export function hourRange(minutesOfDay: number[]): HourRange {
  if (minutesOfDay.length === 0) return FALLBACK_RANGE;

  const min = Math.min(...minutesOfDay);
  const max = Math.max(...minutesOfDay);

  let startMin = Math.max(0, Math.floor((min - 60) / 60) * 60);
  let endMin = Math.min(DAY_MIN, Math.ceil((max + 60) / 60) * 60);

  if (endMin - startMin < MIN_SPAN_MIN) {
    endMin = Math.min(DAY_MIN, startMin + MIN_SPAN_MIN);
    startMin = Math.max(0, endMin - MIN_SPAN_MIN);
  }

  return { startMin, endMin };
}

/** Where a time falls within the axis, as a percentage — clamped, never overflows. */
export function offsetPercent(minutesOfDay: number, range: HourRange): number {
  const span = range.endMin - range.startMin;
  if (span <= 0) return 0;
  const pct = ((minutesOfDay - range.startMin) / span) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** One label per hour row, e.g. `["09:00", "10:00", …]`. */
export function hourLabels(range: HourRange): string[] {
  const labels: string[] = [];
  for (let m = range.startMin; m < range.endMin; m += 60) {
    labels.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:00`);
  }
  return labels;
}

/** The Monday-first week containing `anchorDate`. */
export function weekDates(anchorDate: string): string[] {
  const dow = dayOfWeek(anchorDate); // 0 = Sunday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(anchorDate, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export type CalendarView = 'month' | 'week' | 'day';

/** Moves the focused date by one step of whichever view is showing. */
export function shiftAnchor(
  view: CalendarView,
  anchor: string,
  direction: 1 | -1,
): string {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, 7 * direction);
  const { year, month } = shiftMonth(
    parseDate(anchor).getUTCFullYear(),
    parseDate(anchor).getUTCMonth(),
    direction,
  );
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
