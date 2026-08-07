import { useCallback, useEffect, useState } from 'react';
import { fetchAvailableSlots } from '@/services/bookingService';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { addDays, toSalonDate } from '@/lib/format';
import type { Service, TimeSlot } from '@/types';

interface UseAvailability {
  /** ISO date (yyyy-mm-dd) → slots open that day. Empty array = closed/full. */
  slotsByDate: Record<string, TimeSlot[]>;
  /** Days with at least one slot, for enabling the date grid. */
  openDates: string[];
  loading: boolean;
  error: Error | null;
  /** True when the whole window is empty — trigger the availability-request path. */
  isEmpty: boolean;
  refresh: () => Promise<void>;
}

/**
 * Bookable slots for one service.
 *
 * **Deviation from docs/HOOKS.md, deliberate.** That contract has this hook
 * generating slots in the browser from rules minus exceptions minus live
 * appointments. It cannot: anon has no SELECT on `appointments` (see the
 * closing comment of `0002_salon.sql`), and granting one broad enough to
 * compute availability would publish the salon's entire schedule. The
 * subtraction happens in `available_slots()` instead, which returns only free
 * slots. The hook's public shape is unchanged.
 *
 * The window is a rolling `days` from `startDate` rather than a calendar month,
 * because a customer opening the page on the 29th cares about the next fortnight,
 * not about the two remaining days of this month.
 */
export function useAvailability(
  service: Service | null,
  startDate?: string,
  days = 21,
): UseAvailability {
  const { timezone } = useBusinessSettings();
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [openDates, setOpenDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const from = startDate ?? toSalonDate(new Date(), timezone);

  const load = useCallback(async (): Promise<void> => {
    if (!service) {
      setSlotsByDate({});
      setOpenDates([]);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchAvailableSlots(
        service.id,
        from,
        addDays(from, days),
        service.duration_min,
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
  }, [service, from, days, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    slotsByDate,
    openDates,
    loading,
    error,
    isEmpty: !loading && error === null && openDates.length === 0 && service !== null,
    refresh: load,
  };
}
