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

// Hour-axis grid rendering support

/** Minutes-since-midnight bounds for the hour axis. Always multiples of 60. */
export interface HourRange {
  startMin: number;
  endMin: number;
}

/**
 * Week/Day's grid fits the viewport instead of scrolling internally
 * (docs/design/calendar.png shows the full opening-to-closing span on
 * screen at once, however many hours that is) — so rows are sized by
 * percentage of this fixed container height, not a per-hour pixel constant.
 *
 * THAT RULE AND THE 44px TOUCH FLOOR CANNOT BOTH HOLD, and this is the one
 * that wins. An hour row is grid height / hour count, so on an iPad in
 * landscape the salon's 18-hour span gets 510px and each row is 28px — the
 * open-slot blocks measure 37x37. Reaching 44 a row would need 792px of grid,
 * which a 768px-tall viewport does not have once the header, toolbar and
 * legend are taken. It is arithmetic, not a value in this file: no breakpoint
 * or padding change reaches it, and the only thing that would is internal
 * scrolling, which is exactly what the mockup above rules out.
 *
 * Collapsing the right rail below `lg` was considered and rejected. It widens
 * the columns but does nothing to row height, which is the binding dimension,
 * and it would cost the details panel on every 1280px laptop — the system has
 * three breakpoints on purpose (md/lg/wide, DESIGN.md §5.3) and there is no
 * 1100px step to hide behind.
 *
 * The blocks clear WCAG 2.5.8's actual 24x24 requirement with room to spare.
 * See docs/DESIGN.md §10 for why the dashboard is not held to 44 at all.
 */
export const CALENDAR_GRID_HEIGHT_CLASS = 'h-[calc(100vh-16rem)] min-h-[480px]';

/**
 * Equal-height hour gridlines as a percentage-based repeating gradient, so
 * they render correctly at any container height.
 */
export function hourGridlines(rowCount: number): string {
  if (rowCount <= 0) return 'none';
  const rowPercent = 100 / rowCount;
  return `repeating-linear-gradient(180deg, transparent, transparent calc(${rowPercent}% - 1px), var(--border) calc(${rowPercent}% - 1px), var(--border) ${rowPercent}%)`;
}

const FALLBACK_RANGE: HourRange = { startMin: 8 * 60, endMin: 20 * 60 };
const DAY_MIN = 24 * 60;

/**
 * The hour axis for the Day/Week grid: fixed at 08:00–20:00, always. Does
 * not stretch for published slot times, appointment times, or "now" — a
 * stray slot/appointment outside this window is clamped to the nearest edge
 * by `offsetPercent` rather than widening the grid to chase it, and the
 * now-line simply stops rendering once "now" drifts past 20:00 or before
 * 08:00 rather than dragging the axis wider.
 */
export function openingHoursRange(): HourRange {
  return FALLBACK_RANGE;
}

/** Where a time falls within the axis, as a percentage — clamped, never overflows. */
export function offsetPercent(minutesOfDay: number, range: HourRange): number {
  const span = range.endMin - range.startMin;
  if (span <= 0) return 0;
  const pct = ((minutesOfDay - range.startMin) / span) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** The snap increment for dragging an appointment, in minutes. */
export const DRAG_SNAP_MIN = 15;

/**
 * The inverse of `offsetPercent`: given a vertical position on the axis (0-100,
 * clamped) hand back the minutes-since-midnight it represents. Used while
 * dragging, where the pointer gives a percentage of the grid's height and the
 * drop needs a real time.
 */
export function minutesFromPercent(percent: number, range: HourRange): number {
  const clamped = Math.min(100, Math.max(0, percent));
  return range.startMin + (clamped / 100) * (range.endMin - range.startMin);
}

/**
 * Rounds to the nearest `DRAG_SNAP_MIN`, so a drop always lands on a real slot
 * boundary. Clamped below `DAY_MIN` — a drop in the last few minutes of the
 * axis would otherwise round up to exactly midnight (minute 1440), which
 * formats as `"24:00"` and `new Date(...)` silently rolls into the *next*
 * day rather than rejecting it.
 */
export function snapMinutes(minutesOfDay: number): number {
  const snapped = Math.round(minutesOfDay / DRAG_SNAP_MIN) * DRAG_SNAP_MIN;
  return Math.min(snapped, DAY_MIN - DRAG_SNAP_MIN);
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

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

/** Moves the focused date by one step of whichever view is showing. */
export function shiftAnchor(
  view: CalendarView,
  anchor: string,
  direction: 1 | -1,
): string {
  // Agenda is a chronological list for a single day, same as Day.
  if (view === 'day' || view === 'agenda') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, 7 * direction);
  const { year, month } = shiftMonth(
    parseDate(anchor).getUTCFullYear(),
    parseDate(anchor).getUTCMonth(),
    direction,
  );
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
