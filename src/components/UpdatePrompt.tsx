import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Button } from '@/components/ui/Button';

/**
 * Registers the service worker and surfaces a non-destructive
 * "new version available" prompt. With skipWaiting:false the new SW
 * waits until the user opts in, so we never interrupt their work.
 */
export function UpdatePrompt(): JSX.Element | null {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setUpdate(() => () => updateSW(true));
        setNeedRefresh(true);
      },

      /**
       * Ask the server for a new service worker every hour.
       *
       * With `registerType: 'prompt'` the update prompt only ever appears after
       * the browser has noticed a new worker, and the browser checks on
       * navigation. An installed standalone PWA can go days without one, so a
       * customer whose install predates a fix would keep the broken build and
       * never be offered the prompt. The server already sends `no-cache` for
       * `sw.js`, so this check is cheap and always sees the truth.
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

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-toast mx-auto flex max-w-md animate-fade-up items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-popover">
      <p className="text-sm text-foreground">A new version is available.</p>
      <Button size="sm" onClick={() => void update?.()}>
        Reload
      </Button>
    </div>
  );
}
