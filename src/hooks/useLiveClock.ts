import { useEffect, useState } from 'react';

/**
 * The current time, refreshed while the screen stays open.
 *
 * 30s matches `useNowLine`'s interval — enough resolution for a minute-display
 * clock, and this screen (`TodayPage`) can sit open on a salon tablet for hours.
 */
export function useLiveClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
