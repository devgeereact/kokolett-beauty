import {
  type JSX,
  type ReactElement,
  cloneElement,
  useEffect,
  useId,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * KOKO_GAP.md P3: no dedicated Tooltip component — icon-only controls
 * (the sidebar collapse toggle, row action buttons) relied on the native
 * `title` attribute, which is slow to appear, inconsistently styled across
 * browsers, and invisible to keyboard focus. This shows on hover *and*
 * focus, styled like the rest of the design system, and is announced via
 * `aria-describedby` rather than duplicating the label into `aria-label`.
 *
 * Wraps its single child rather than rendering its own trigger element, so
 * it can attach to any existing button/icon without changing that
 * element's semantics.
 *
 * Two WCAG 1.4.13 details, both added 2026-09-05:
 *
 *  - **The child's own `aria-describedby` is preserved.** It used to be
 *    overwritten, so wrapping a control that already pointed at a hint
 *    silently deleted the hint.
 *  - **Escape dismisses it** without moving focus, which 1.4.13 requires of
 *    any content that appears on hover or focus — a tooltip covering the
 *    thing underneath it must be dismissable without leaving the control.
 */
export function Tooltip({
  label,
  children,
  side = 'bottom',
}: {
  label: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: 'top' | 'bottom';
}): JSX.Element {
  const [visible, setVisible] = useState(false);
  const id = useId();

  const show = (): void => setVisible(true);
  const hide = (): void => setVisible(false);

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (e: globalThis.KeyboardEvent): void => {
      /* Not `preventDefault`: Escape may also mean something to a dialog
         further up, and dismissing a tooltip should not swallow that. */
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  const existing = children.props['aria-describedby'];
  const describedBy = visible ? [existing, id].filter(Boolean).join(' ') : existing;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute left-1/2 z-toast -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-popover',
            side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
