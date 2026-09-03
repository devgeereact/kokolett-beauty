import { type JSX, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker.
 *
 * `registerType: 'autoUpdate'` (vite.config.ts) means a new SW activates and
 * takes over immediately, with no opt-in — that is deliberate, see the
 * comment there for the incident that made an opt-in prompt unacceptable.
 * `onNeedReload` intercepts the reload vite-plugin-pwa would otherwise fire
 * silently (see node_modules/vite-plugin-pwa/dist/client/build/register.js,
 * the `auto` branch), so the customer sees a brief notice instead of the tab
 * just vanishing under them mid-booking. The reload itself is still
 * non-cancellable: an update she has to notice and accept is not an update.
 */
export function UpdatePrompt(): JSX.Element | null {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    registerSW({
      onNeedReload() {
        setUpdating(true);
        setTimeout(() => window.location.reload(), 1200);
      },

      /**
       * Ask the server for a new service worker every hour.
       *
       * An installed standalone PWA can go days without checking on its own —
       * the browser only checks on navigation. The server already sends
       * `no-cache` for `sw.js`, so this check is cheap and always sees the
       * truth.
       */
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        setInterval(
          () => {
            void registration.update();
          },
          60 * 60 * 1000,
        );
      },
    });
  }, []);

  if (!updating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-toast mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 shadow-popover"
    >
      <p className="text-sm text-foreground">Updating to the latest version…</p>
    </div>
  );
}
