import { useCallback, useEffect, useSyncExternalStore } from 'react';
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

interface StoreState {
  settings: BookingSettings | null;
  loading: boolean;
  error: Error | null;
}

/**
 * One row, one fetch, one shared copy.
 *
 * Forty-one components call this hook, and it used to hold its state in
 * `useState` per caller. Every one of them fetched the same single row on
 * mount, so a page load fired the query once per mounted caller: three
 * identical `booking_settings?select=*&id=eq.true` requests were measured on
 * `/services` alone, and the owner dashboard mounts more than that. Each cost
 * roughly 0.8s warm and closer to 3s on a cold connection, in series with
 * first paint.
 *
 * The staleness was worse than the waste. `/dashboard/settings` renders five
 * cards that each own a private copy of the same row, so saving the booking
 * rules in one card left the other four rendering the values they had read
 * before the write, with nothing to tell them otherwise.
 *
 * A module-level store fixes both: concurrent mounts share one in-flight
 * request, later mounts read the cached row with no request at all, and a
 * successful `update()` publishes the row the database returned to every
 * subscriber at once.
 */
let state: StoreState = { settings: null, loading: true, error: null };

const listeners = new Set<() => void>();

function setState(next: StoreState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  return state;
}

/** In-flight load, shared by every caller that mounts while it is running. */
let inFlight: Promise<void> | null = null;

function load(force: boolean): Promise<void> {
  if (inFlight) return inFlight;
  // A row already read successfully is reused. `refresh()` passes force.
  if (!force && state.settings && !state.error) return Promise.resolve();

  setState({ ...state, loading: true });

  const request = getBookingSettings()
    .then((settings) => {
      setState({ settings, loading: false, error: null });
    })
    .catch((e: unknown) => {
      setState({
        settings: state.settings,
        loading: false,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    })
    .finally(() => {
      inFlight = null;
    });

  inFlight = request;
  return request;
}

/**
 * Test-only. The store outlives a single test because it is module state, so a
 * suite that renders this hook twice would otherwise see the first test's row.
 * Nothing in `src/` outside a test may call this.
 */
export function resetBusinessSettingsStore(): void {
  state = { settings: null, loading: true, error: null };
  inFlight = null;
  listeners.clear();
}

/** The single `booking_settings` row. Public-readable; owner-writable. */
export function useBusinessSettings(): UseBusinessSettings {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void load(false);
  }, []);

  const update = useCallback(async (patch: BookingSettingsUpdate): Promise<void> => {
    // Optimism is wrong here: these values govern what can be booked, so the
    // UI should show what the database actually accepted. Publishing the
    // returned row is also what keeps the other settings cards in step.
    const next = await updateBookingSettings(patch);
    setState({ settings: next, loading: false, error: null });
  }, []);

  const refresh = useCallback((): Promise<void> => load(true), []);

  return {
    settings: snapshot.settings,
    loading: snapshot.loading,
    error: snapshot.error,
    timezone: snapshot.settings?.timezone ?? DEFAULT_TIMEZONE,
    update,
    refresh,
  };
}
