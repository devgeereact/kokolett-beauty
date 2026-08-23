import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * How far ahead a customer can book.
 *
 * This was hard-coded at 28 days while the owner's Booking Rules card told her
 * the horizon was 90 and the weekly generator dutifully published three months
 * of times. The result was two thirds of a published calendar that no customer
 * could reach, and nothing anywhere said so. The number now comes from
 * `booking_settings.max_horizon_days`, and these tests exist so it cannot
 * quietly go back to being a literal in this file.
 *
 * Both modules are mocked rather than stubbed at the network layer: importing
 * the real `bookingService` constructs a Supabase client at module scope, and
 * CI has no `.env`.
 */
const fetchAvailableSlots = vi.fn();
const useBusinessSettings = vi.fn();

vi.mock('@/services/bookingService', () => ({
  fetchAvailableSlots: (...args: unknown[]): unknown => fetchAvailableSlots(...args),
}));

vi.mock('@/hooks/useBusinessSettings', () => ({
  useBusinessSettings: (): unknown => useBusinessSettings(),
}));

const { useAvailability } = await import('@/hooks/useAvailability');

function settings(maxHorizonDays: number | null, loading = false): void {
  useBusinessSettings.mockReturnValue({
    settings: maxHorizonDays === null ? null : { max_horizon_days: maxHorizonDays },
    loading,
    timezone: 'Europe/London',
  });
}

/** The `toDate` argument of the most recent availability fetch. */
function requestedUntil(): string {
  const calls = fetchAvailableSlots.mock.calls;
  return calls[calls.length - 1]?.[1] as string;
}

describe('useAvailability window', () => {
  beforeEach(() => {
    // `shouldAdvanceTime` so a frozen clock still lets `waitFor` poll — without
    // it every async assertion here sits until the test times out.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-23T12:00:00Z'));
    fetchAvailableSlots.mockReset();
    fetchAvailableSlots.mockResolvedValue({ slotsByDate: {}, openDates: [] });
    useBusinessSettings.mockReset();
  });

  it('asks for the horizon the owner configured, not a hard-coded fortnight', async () => {
    settings(90);
    renderHook(() => useAvailability(45));

    await waitFor(() => expect(fetchAvailableSlots).toHaveBeenCalled());
    expect(requestedUntil()).toBe('2026-11-21');
  });

  it('follows the setting when the owner changes it', async () => {
    settings(30);
    renderHook(() => useAvailability(45));

    await waitFor(() => expect(fetchAvailableSlots).toHaveBeenCalled());
    expect(requestedUntil()).toBe('2026-09-22');
  });

  it('falls back to three months when there is no settings row', async () => {
    settings(null);
    renderHook(() => useAvailability(45));

    await waitFor(() => expect(fetchAvailableSlots).toHaveBeenCalled());
    expect(requestedUntil()).toBe('2026-11-21');
  });

  it('waits for settings rather than fetching a window it will have to redo', () => {
    settings(null, true);
    renderHook(() => useAvailability(45));

    expect(fetchAvailableSlots).not.toHaveBeenCalled();
  });

  it('still lets a caller ask for a narrower window explicitly', async () => {
    settings(90);
    renderHook(() => useAvailability(45, undefined, 7));

    await waitFor(() => expect(fetchAvailableSlots).toHaveBeenCalled());
    expect(requestedUntil()).toBe('2026-08-30');
  });
});
