import type { JSX } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/Button';

/** Dismissible banner offering to install the PWA when eligible. */
export function InstallPrompt(): JSX.Element | null {
  const { isInstallable, promptInstall } = usePWAInstall();
  if (!isInstallable) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-toast mx-auto flex max-w-md animate-fade-up items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-popover">
      <div>
        <p className="font-semibold text-foreground">Install this app</p>
        <p className="text-sm text-muted-foreground">Faster, offline-ready, no store.</p>
      </div>
      <Button size="sm" onClick={() => void promptInstall()}>
        Install
      </Button>
    </div>
  );
}
