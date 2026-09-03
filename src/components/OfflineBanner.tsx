import type { JSX } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Fixed bottom banner shown only while the device is offline.
 *
 * The copy used to promise "Showing cached content", which was never quite
 * true and is now plainly not: the service worker precaches the app shell and
 * caches four public tables, so what an offline visitor sees is the salon's
 * opening hours and service list, not their own bookings, and nothing can be
 * booked or changed. Saying so is more use than a reassurance that does not
 * hold.
 */
export function OfflineBanner(): JSX.Element | null {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-toast animate-fade-up bg-card px-4 py-3 text-center text-sm text-muted-foreground border-t border-border"
    >
      You&rsquo;re offline. You can browse, but nothing can be booked or changed until you
      reconnect.
    </div>
  );
}
