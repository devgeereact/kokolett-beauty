import { useEffect, useState } from 'react';
import { minutesSinceMidnight } from '@/lib/format';

/**
 * Minutes since local midnight, refreshed while the calendar stays open.
 *
 * 30s is enough resolution for a line on an hour-tall grid row — tighter
 * repaints for no visible difference, and this screen can sit open on a
 * salon tablet for hours.
 */
export function useNowLine(timezone: string): number {
  const [minutes, setMinutes] = useState(() => minutesSinceMidnight(new Date(), timezone));

  useEffect(() => {
    const sync = (): void => setMinutes(minutesSinceMidnight(new Date(), timezone));
    sync();
    const timer = window.setInterval(sync, 30_000);
    return () => window.clearInterval(timer);
  }, [timezone]);

  return minutes;
}
