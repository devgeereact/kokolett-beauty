import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type DrawerWidth = 'sm' | 'md' | 'lg';

const WIDTH_CLASS: Record<DrawerWidth, string> = {
  sm: 'max-w-drawer-sm',
  md: 'max-w-drawer-md',
  lg: 'max-w-drawer-lg',
};

/**
 * The off-canvas counterpart to `Modal` — same portal/backdrop/focus-trap/
 * Escape wiring (docs/design/new-design-guideline.png global overlay rules
 * §16, §41), anchored to the right edge instead of centred (§23-25). Not yet
 * adopted by an existing screen — `AppointmentDetailPanel`/
 * `CustomerDetailPanel` are inline split-view panels, not overlay drawers,
 * so migrating them is a behaviour change outside a token/consistency pass.
 * This exists so the next screen that genuinely needs a slide-over reaches
 * for one shared component instead of hand-rolling another bespoke panel.
 */
export function Drawer({
  open,
  onClose,
  ariaLabel,
  header,
  children,
  footer,
  width = 'md',
  className,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: DrawerWidth;
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

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-drawer flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        className="overlay-backdrop fixed inset-0"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          'relative flex h-full w-full flex-col bg-card text-card-foreground shadow-modal',
          WIDTH_CLASS[width],
          className,
        )}
      >
        {header && <div className="shrink-0 border-b border-border p-5">{header}</div>}
        <div
          className={cn(
            'flex-1 overflow-y-auto p-5',
            // §25: reserve the sticky footer's height plus the standard
            // 24px gap so the last piece of body content never hides
            // beneath it.
            footer ? 'pb-24' : 'scroll-bottom-gap',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border p-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
