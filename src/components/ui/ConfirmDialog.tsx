import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

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
 *
 * Portaled to `document.body` rather than rendered in place. Every current
 * call site happens to render under `DashboardLayout`'s `<main>`, a sibling
 * of the `<header>` that carries `backdrop-blur` — so today, nothing sits
 * under that filter. But that's incidental, not structural: in Chromium, an
 * ancestor with `backdrop-filter`/`filter`/`transform` establishes a new
 * containing block for `position: fixed` descendants, so a call site added
 * anywhere under such an ancestor (a page's `actions` prop, which does
 * render inside the blurred header; a future glassmorphism card) would clip
 * this dialog off-screen with no jsdom test able to catch it — the exact bug
 * `QuickActionLauncher.tsx` hit and fixed the same way. Portaling here closes
 * that gap for all 19 real call sites at once instead of leaving it latent.
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
  useFocusTrap(open, panelRef, onCancel);

  if (!open) return null;

  // z-layer-popover (90): above Modal's z-modal (80) — several call sites
  // (AppointmentDetailModal) nest this inside a Modal, and both portal to
  // document.body as siblings, so a lower z-index here would paint the
  // confirm dialog underneath it.
  return createPortal(
    <div className="fixed inset-0 z-layer-popover flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="overlay-backdrop absolute inset-0"
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
          'text-popover-foreground shadow-modal',
        )}
      >
        <h2 id={titleId} className="font-serif text-lg font-semibold text-foreground">
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
    </div>,
    document.body,
  );
}
