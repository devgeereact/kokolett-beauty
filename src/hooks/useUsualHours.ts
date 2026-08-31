import { useCallback, useEffect, useState } from 'react';
import { listWeeklyTemplate } from '@/services/availabilityService';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

export interface HoursLine {
  /** e.g. "Tuesday to Sunday" or "Monday" */
  days: string;
  /** e.g. "09:00 to 17:00", or null when closed. */
  hours: string | null;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Monday first, because that is how opening hours are read. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * The salon's usual week, summarised for the footer.
 *
 * Derived from the weekly template rather than hard-coded, so it cannot drift
 * from what the owner actually publishes. It is deliberately labelled *usual*:
 * the template is what generates days, but any individual day can be changed on
 * the calendar, so the only authority on a specific date is the booking page.
 *
 * Consecutive days with the same hours are collapsed — "Tuesday to Sunday
 * 09:00 to 17:00" is what a person reads, not seven identical lines.
 */
export function useUsualHours(): { lines: HoursLine[]; loading: boolean } {
  const [lines, setLines] = useState<HoursLine[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      const template = await listWeeklyTemplate();
      const byDay = new Map(template.map((d) => [d.day_of_week, d.times]));

      // First and last appointment start is the honest summary of a list of
      // discrete times; the salon does not work "09:00 to 17:00 continuously".
      const summarise = (day: number): string | null => {
        const times = (byDay.get(day) ?? []).slice().sort();
        if (times.length === 0) return null;
        return times.length === 1
          ? times[0]!
          : `${times[0]} to ${times[times.length - 1]}`;
      };

      const grouped: HoursLine[] = [];
      for (const day of ORDER) {
        const hours = summarise(day);
        const previous = grouped[grouped.length - 1];

        // Extend the run only if this day is adjacent in the displayed order.
        if (previous && previous.hours === hours) {
          previous.days = `${previous.days.split(' to ')[0]} to ${DAY_NAMES[day]}`;
        } else {
          grouped.push({ days: DAY_NAMES[day] ?? '', hours });
        }
      }

      setLines(grouped);
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The footer is often left open for a while; picking up a change the
  // owner makes to the weekly template without a reload is the whole point
  // of "usual hours" being live rather than a screenshot of the schedule.
  useRealtimeTable('weekly_template', () => void load());

  return { lines, loading };
}
