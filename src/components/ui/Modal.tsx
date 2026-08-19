import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FOCUSABLE_SELECTOR, useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

/**
 * A reusable accessible dialog — portal, backdrop, focus trap, Escape to
 * close, focus returned to the trigger on close. Extracted from
 * `QuickActionLauncher`'s own dialog (the one other place in this codebase
 * that already needed exactly this), rather than duplicating that logic a
 * second time for the Calendar's New booking / Edit appointment popups.
 *
 * Portaled to `document.body`, not rendered in place, for the same reason
 * `QuickActionLauncher` does it: an ancestor with `backdrop-filter`
 * establishes a new containing block for `position: fixed` descendants in
 * Chromium, which would clip a fixed-position dialog rendered inside
 * `DashboardLayout`'s blurred header.
 */
export function Modal({
  open,
  onClose,
  ariaLabel,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      returnFocusRef.current?.focus();
    };
  }, [open]);

  useFocusTrap(open, panelRef, onClose);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-start justify-center overflow-y-auto p-4 pt-[8vh] md:items-center md:pt-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="overlay-backdrop fixed inset-0"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        // modal-md (520px) is the default width (§18) — call sites pass
        // `max-w-modal-sm`/`-lg` to override, never an ad-hoc max-w-*.
        className={cn('relative w-full max-w-modal-md shadow-modal', className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
