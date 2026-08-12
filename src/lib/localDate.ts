/**
 * `yyyy-mm-dd` string ↔ local-midnight `Date` conversions for `react-day-picker`
 * based components. Kept out of `DatePicker.tsx` so React Fast Refresh keeps
 * working there — a component file that also exports plain functions loses
 * its refresh boundary (the same reason `lib/status.ts` exists).
 *
 * `react-day-picker` operates on local-timezone `Date` objects with no
 * timezone awareness of its own, so every `Calendar`-based picker needs the
 * same local-midnight anchor to compare selections and disabled matchers
 * against a set of `yyyy-mm-dd` date strings without drifting a day.
 */

export function parseLocalDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
