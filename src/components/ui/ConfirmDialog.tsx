import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` renders the confirm action in the destructive `Button` variant. */
  tone?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces `window.confirm(message)`. Controlled by a boolean `open` prop, the
 * same shape the rest of the dashboard already uses for panels toggled by
 * parent state (e.g. `NewBookingPanel`) — not an imperative `useConfirm()`
 * hook, since that pattern doesn't otherwise exist in this codebase.
 *
 * Renders via the same overlay/backdrop structure as `DashboardLayout`'s
 * mobile slide-over: `fixed inset-0`, a full-bleed backdrop `button` that
 * closes on click, then the panel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  // Focus moves into the dialog on open, and back to whatever triggered it on
  // close — so a boolean-toggled panel never leaves focus stranded on a
  // now-hidden trigger. Cancel gets initial focus rather than Confirm: several
  // of this dialog's destructive call sites (cancel, no-show, delete) make an
  // accidental stray Enter right after open more costly than a defensive
  // default.
  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      triggerRef.current?.focus();
    };
  }, [open]);

  // Escape closes (equivalent to Cancel); Tab is kept inside the dialog. Enter
  // activating a focused button needs no handler — that's native <button>
  // behaviour, and nothing here calls preventDefault on it.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className={cn(
          'relative w-full max-w-sm rounded-xl border border-border bg-popover p-5',
          'text-popover-foreground shadow-card',
        )}
      >
        <h2 id={titleId} className="font-display text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p
          id={messageId}
          className="mt-2 whitespace-pre-line text-sm text-muted-foreground"
        >
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
