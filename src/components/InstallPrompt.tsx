import { type JSX, useState } from 'react';
import { X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/Button';

/** Remembers a dismissal, so declining once is not asked again next visit. */
const DISMISSED_KEY = 'kb.install-prompt-dismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    // Private mode and blocked storage both throw. Showing the banner is the
    // safer failure: an extra offer beats a control that cannot be dismissed.
    return false;
  }
}

/**
 * Dismissible banner offering to install the PWA when eligible.
 *
 * It said "dismissible" before there was anything to dismiss it with. A fixed
 * banner sat over the bottom of every page, on every visit, until the customer
 * either installed the app or gave up on the page underneath, and on a phone
 * that band is where the booking call to action lives. It also shared the
 * bottom of the viewport with `OfflineBanner`, so an offline customer got both,
 * stacked on top of each other.
 *
 * It now sits above `OfflineBanner` rather than on it, and a dismissal is
 * remembered.
 */
export function InstallPrompt(): JSX.Element | null {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!isInstallable || dismissed) return null;

  const dismiss = (): void => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* the banner is gone for this visit either way */
    }
  };

  /* The browser's own prompt can be declined too, and that answer counts.
     Discarding it meant a customer who said no to Chrome still saw this banner
     again on their next visit. */
  const install = async (): Promise<void> => {
    const outcome = await promptInstall();
    if (outcome === 'dismissed') dismiss();
  };

  return (
    <div className="fixed inset-x-4 bottom-20 z-toast mx-auto flex max-w-md animate-fade-up items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-popover">
      <div>
        <p className="font-semibold text-foreground">Install this app</p>
        <p className="text-sm text-muted-foreground">Faster, offline-ready, no store.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={(): void => void install()}>
          Install
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the install offer"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
