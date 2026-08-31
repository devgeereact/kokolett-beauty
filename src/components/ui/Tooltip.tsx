import { type JSX, type ReactElement, cloneElement, useId, useState } from 'react';
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

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': visible ? id : undefined })}
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
