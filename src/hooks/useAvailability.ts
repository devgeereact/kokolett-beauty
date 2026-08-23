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
 * The window to use while `booking_settings` is still in flight, and if the
 * salon ever has no settings row at all. Three months, matching the shipped
 * `max_horizon_days` — a fallback that contradicts the setting would show a
 * customer one calendar and then quietly replace it with another.
 */
const FALLBACK_HORIZON_DAYS = 90;

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
 *
 * How far it rolls is the owner's decision, not this file's. `days` used to be
 * hard-coded at 28 while `booking_settings.max_horizon_days` sat at 90 and was
 * shown back to her on the Booking Rules card as though it governed something —
 * so she published three months of times and customers could reach one. The
 * setting is now the single source of that number, and an explicit `days`
 * argument still wins for callers that genuinely want a narrower view.
 */
export function useAvailability(
  appointmentMinutes: number,
  startDate?: string,
  days?: number,
): UseAvailability {
  const { settings, loading: settingsLoading, timezone } = useBusinessSettings();
  const horizonDays = days ?? settings?.max_horizon_days ?? FALLBACK_HORIZON_DAYS;
  const [slotsByDate, setSlotsByDate] = useState<Record<string, TimeSlot[]>>({});
  const [openDates, setOpenDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const from = startDate ?? toSalonDate(new Date(), timezone);

  const load = useCallback(async (): Promise<void> => {
    // Waiting costs one render; not waiting costs a fetch over the fallback
    // window, then a second over the real one, with the calendar visibly
    // changing shape between them.
    if (settingsLoading && days === undefined) return;

    setLoading(true);
    try {
      const result = await fetchAvailableSlots(
        from,
        addDays(from, horizonDays),
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
  }, [from, days, horizonDays, settingsLoading, appointmentMinutes, timezone]);

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
