import { useEffect, useMemo, useState } from 'react';
import { salonDayRange, toSalonDate } from '@/lib/format';

interface SalonToday {
  /** `yyyy-mm-dd` in the salon's timezone. */
  date: string;
  /** Midnight at the start of that salon day, as an instant. */
  start: Date;
  /** The instant the salon day ends. */
  end: Date;
}

/**
 * Today's salon day, kept current while the screen stays open.
 *
 * `salonToday()` on its own is a snapshot. Computing it in a `useMemo` keyed
 * only on the timezone froze the window at mount, which is fine for a laptop
 * session and wrong for the device this dashboard is actually used on: a salon
 * tablet or phone left on the Today screen overnight went on showing yesterday's
 * appointments under a header rendering `new Date()` fresh on every render, so
 * the date above the list disagreed with the list. Worse, the realtime handler
 * re-queried the same stale window, so a booking taken for the new day never
 * appeared.
 *
 * Rollover is detected three ways because none alone is sufficient: a timer
 * (a screen left visible and untouched), `visibilitychange` (a tablet woken from
 * sleep, where timers were throttled or suspended), and `focus` (a backgrounded
 * tab returned to). Each only sets state when the salon date string actually
 * changes, so the common case is a cheap string compare and no re-render.
 */
export function useSalonToday(timezone: string): SalonToday {
  const [date, setDate] = useState(() => toSalonDate(new Date(), timezone));

  useEffect(() => {
    const sync = (): void => {
      const current = toSalonDate(new Date(), timezone);
      setDate((previous) => (previous === current ? previous : current));
    };

    // Re-sync immediately: the timezone may have just loaded from settings.
    sync();

    const timer = window.setInterval(sync, 60_000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [timezone]);

  // Derived from the tracked `date` rather than by calling `salonToday()` again.
  // Re-reading the clock inside the memo would make `date` look like a spurious
  // dependency to the exhaustive-deps rule while actually being the only thing
  // driving recomputation — the kind of dependency someone later deletes.
  return useMemo(() => ({ date, ...salonDayRange(date, timezone) }), [date, timezone]);
}
