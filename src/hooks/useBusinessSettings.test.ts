import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The `booking_settings` row is read by 41 components. When each of them owned
 * its own copy, a page load fired one identical query per mounted caller and a
 * save in one settings card left the other four rendering pre-write values.
 * These tests hold the shared store in place.
 *
 * The service is mocked rather than stubbed at the network layer: importing the
 * real one constructs a Supabase client at module scope, and CI has no `.env`.
 */
const getBookingSettings = vi.fn();
const updateBookingSettings = vi.fn();

vi.mock('@/services/bookingSettingsService', () => ({
  getBookingSettings: (): unknown => getBookingSettings(),
  updateBookingSettings: (...args: unknown[]): unknown => updateBookingSettings(...args),
}));

const { useBusinessSettings, resetBusinessSettingsStore } =
  await import('@/hooks/useBusinessSettings');

const ROW = { id: true, timezone: 'Europe/London', max_horizon_days: 90 };

describe('useBusinessSettings', () => {
  beforeEach(() => {
    resetBusinessSettingsStore();
    getBookingSettings.mockReset();
    getBookingSettings.mockResolvedValue(ROW);
    updateBookingSettings.mockReset();
  });

  it('fetches the row once no matter how many callers mount', async () => {
    const a = renderHook(() => useBusinessSettings());
    const b = renderHook(() => useBusinessSettings());
    const c = renderHook(() => useBusinessSettings());

    await waitFor(() => expect(a.result.current.settings).toEqual(ROW));

    expect(getBookingSettings).toHaveBeenCalledTimes(1);
    expect(b.result.current.settings).toEqual(ROW);
    expect(c.result.current.settings).toEqual(ROW);
  });

  it('serves a later mount from cache without a second request', async () => {
    const first = renderHook(() => useBusinessSettings());
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const later = renderHook(() => useBusinessSettings());

    expect(getBookingSettings).toHaveBeenCalledTimes(1);
    expect(later.result.current.settings).toEqual(ROW);
    expect(later.result.current.loading).toBe(false);
  });

  it('publishes a successful update to every caller', async () => {
    const saver = renderHook(() => useBusinessSettings());
    const reader = renderHook(() => useBusinessSettings());
    await waitFor(() => expect(reader.result.current.settings).toEqual(ROW));

    const saved = { ...ROW, max_horizon_days: 30 };
    updateBookingSettings.mockResolvedValue(saved);

    await act(async () => {
      await saver.result.current.update({ max_horizon_days: 30 });
    });

    // The card that did not do the saving must not keep rendering the old row.
    expect(reader.result.current.settings).toEqual(saved);
    expect(reader.result.current.timezone).toBe('Europe/London');
  });

  it('refresh forces a refetch and shares the new row', async () => {
    const a = renderHook(() => useBusinessSettings());
    const b = renderHook(() => useBusinessSettings());
    await waitFor(() => expect(a.result.current.settings).toEqual(ROW));

    const changed = { ...ROW, timezone: 'UTC' };
    getBookingSettings.mockResolvedValue(changed);

    await act(async () => {
      await a.result.current.refresh();
    });

    expect(getBookingSettings).toHaveBeenCalledTimes(2);
    expect(b.result.current.timezone).toBe('UTC');
  });

  it('surfaces a failure and falls back to the default timezone', async () => {
    getBookingSettings.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useBusinessSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('offline');
    expect(result.current.settings).toBeNull();
    expect(result.current.timezone).toBe('Europe/London');
  });
});
