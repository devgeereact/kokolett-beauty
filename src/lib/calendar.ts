/**
 * Calendar grid maths.
 *
 * Everything here works on `yyyy-mm-dd` strings anchored to UTC noon rather
 * than on local `Date` objects. A month grid built from browser-local dates
 * drifts by a day for anyone west of Greenwich, and the drift only shows up
 * near midnight — which is exactly when nobody is looking.
 */

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
