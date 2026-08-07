import { useCallback, useEffect, useState } from 'react';
import { fetchAvailableSlots } from '@/services/bookingService';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { addDays, toSalonDate } from '@/lib/format';
import type { TimeSlot } from '@/types';

interface UseAvailability {
  /** ISO date (yyyy-mm-dd) → slots open that day. */
  slotsByDate: Record<string, TimeSlot[]>;
  /** Days with at least one slot, for enabling the date grid. */
  openDates: string[];
  loading: boolean;
  error: Error | null;
  /** True when the whole window is empty — trigger the request path. */
  isEmpty: boolean;
  refresh: () => Promise<void>;
}

/**
 * Bookable times over a rolling window.
 *
 * No service argument since 0011: there is one appointment type and a slot is
 * absolute, so availability is the same question for everybody.
 *
 * Slots are generated in the database, not the browser. Anon has no `SELECT` on
 * `appointments`, and a policy broad enough to compute availability client-side
 * would publish the salon's whole schedule. `available_slots()` returns only
 * free starts.
 *
 * The window rolls from today rather than following a calendar month: someone
 * opening the page on the 29th cares about the next fortnight, not the two days
 * left in the month.
 */
export function useAvailability(
  appointmentMinutes: number,
  startDate?: string,
  days = 28,
): UseAvailability {
  const { timezone } = useBusinessSettings();
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [openDates, setOpenDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const from = startDate ?? toSalonDate(new Date(), timezone);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await fetchAvailableSlots(
        from,
        addDays(from, days),
        appointmentMinutes,
        timezone,
      );
      setSlotsByDate(result.slotsByDate);
      setOpenDates(result.openDates);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setSlotsByDate({});
      setOpenDates([]);
    } finally {
      setLoading(false);
    }
  }, [from, days, appointmentMinutes, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    slotsByDate,
    openDates,
    loading,
    error,
    isEmpty: !loading && error === null && openDates.length === 0,
    refresh: load,
  };
}
