import type { JSX } from 'react';
import { Calendar } from '@/components/ui/Calendar';
import { formatLocalDate, parseLocalDate } from '@/lib/localDate';

/**
 * The rail's jump-to-date picker — the same `Calendar`/`react-day-picker`
 * wrapper `DatePicker` uses, rendered inline instead of behind a popover.
 * `anchor` is a `yyyy-mm-dd` string in `lib/calendar.ts`'s UTC-noon
 * convention; `parseLocalDate`/`formatLocalDate` are the app's existing
 * bridge to `react-day-picker`'s local-midnight `Date`s (see `DatePicker`).
 */
export function MiniMonthCalendar({
  anchor,
  onSelect,
}: {
  anchor: string;
  onSelect: (date: string) => void;
}): JSX.Element {
  const selected = parseLocalDate(anchor);

  return (
    <Calendar
      mode="single"
      size="sm"
      selected={selected}
      defaultMonth={selected}
      onSelect={(date) => {
        if (date) onSelect(formatLocalDate(date));
      }}
      className="w-full p-0"
    />
  );
}
