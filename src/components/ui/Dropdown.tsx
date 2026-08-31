import { type JSX, type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * KOKO_GAP.md P3: the "…" quick-actions menu was hand-rolled three times
 * (`AppointmentRowMenu.tsx`, `CustomerDetailPanel.tsx`, `CustomerCard.tsx`)
 * — same trigger button, same absolutely-positioned popover, same
 * outside-pointerdown/Escape close logic, each copy free to drift from the
 * others. This is that one implementation, extracted.
 *
 * A plain popover, not a portal: every current call site renders inside a
 * `Card`/panel with no `overflow-hidden`/`backdrop-filter` ancestor between
 * it and the viewport edge, so there is nothing to escape yet. If a future
 * call site needs one, that's the moment to add a portal, not before.
 */
export interface DropdownItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  className,
}: {
  /** Receives `open` so the trigger can reflect state (e.g. rotate a chevron). */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: DropdownItem[];
  /** Which side of the trigger the menu hangs from. */
  align?: 'start' | 'end';
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-dropdown mt-1 w-52 rounded-xl border border-border bg-popover p-1 shadow-popover',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                item.destructive ? 'text-destructive' : 'text-foreground',
                item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
