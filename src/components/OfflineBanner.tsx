import { useRef, type JSX } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useBottomNotice } from '@/hooks/useBottomNotice';

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
  const ref = useRef<HTMLDivElement>(null);
  /* Sits ABOVE the consent banner rather than on top of it — both used to be
     `bottom-0`, so a first visit while offline stacked one exactly over the
     other (docs/DESIGN.md §16.9). */
  const bottom = useBottomNotice('offline', ref, !online);
  if (online) return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      style={{ bottom }}
      className="fixed inset-x-0 z-toast animate-fade-up border-t border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
    >
      You&rsquo;re offline. You can browse, but nothing can be booked or changed until you
      reconnect.
    </div>
  );
}
