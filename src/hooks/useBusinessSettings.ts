import { useCallback, useEffect, useState } from 'react';
import {
  getBookingSettings,
  updateBookingSettings,
} from '@/services/bookingSettingsService';
import { DEFAULT_TIMEZONE } from '@/lib/format';
import type { BookingSettings, BookingSettingsUpdate } from '@/types';

interface UseBusinessSettings {
  settings: BookingSettings | null;
  loading: boolean;
  error: Error | null;
  /** Salon timezone, with a safe fallback while settings are loading. */
  timezone: string;
  update: (patch: BookingSettingsUpdate) => Promise<void>;
  refresh: () => Promise<void>;
}

/** The single `booking_settings` row. Public-readable; owner-writable. */
export function useBusinessSettings(): UseBusinessSettings {
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setSettings(await getBookingSettings());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(async (patch: BookingSettingsUpdate): Promise<void> => {
    // Optimism is wrong here: these values govern what can be booked, so the
    // UI should show what the database actually accepted.
    const next = await updateBookingSettings(patch);
    setSettings(next);
  }, []);

  return {
    settings,
    loading,
    error,
    timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
    update,
    refresh: load,
  };
}
