import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ToastItem } from '@/types';

/** Matches `TodayPage`'s prior hand-rolled undo banner (8s auto-dismiss). */
const DEFAULT_DURATION_MS = 8000;

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}): JSX.Element {
  const duration = toast.duration ?? DEFAULT_DURATION_MS;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const armTimer = (): void => {
    clearTimer();
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
  };

  // Re-armed only when the toast's identity changes, not on every render — the
  // timer must survive re-renders caused by, say, a parent state update
  // elsewhere in the tree.
  useEffect(() => {
    armTimer();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      // Pausing on hover/focus, not just cancelling outright, is what "unless
      // the owner interacts with it" means here: move the pointer or tab away
      // and the countdown picks back up rather than staying dismissed forever.
      onMouseEnter={clearTimer}
      onMouseLeave={armTimer}
      onFocus={clearTimer}
      onBlur={armTimer}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border',
        'bg-popover p-4 text-popover-foreground shadow-card sm:w-96',
      )}
    >
      <p className="flex-1 text-sm">{toast.message}</p>
      <div className="flex shrink-0 items-center gap-1">
        {toast.action && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </Button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onDismiss(toast.id)}
          className={cn(
            'rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * The toast stack: fixed to a corner, newest at the bottom, closest to the
 * action that triggered it. Rendered once by `ToastProvider` — nothing else
 * should mount this directly.
 */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}): JSX.Element | null {
  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        // z-[60], not z-50: QuickActionLauncher's portal is also z-50, and
        // when its panel is open the toast stack must render above it (e.g.
        // an error toast fired by a launcher action) — otherwise it's
        // painted behind the launcher's backdrop and invisible.
        'pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2',
        'sm:inset-x-auto sm:right-4',
      )}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
