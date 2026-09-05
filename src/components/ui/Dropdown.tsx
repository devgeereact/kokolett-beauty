import {
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
 *
 * The `role="menu"` contract is implemented rather than merely claimed
 * (2026-09-05). It used to open with focus left on the trigger, which means
 * a screen reader announced a menu and then read nothing in it, and the only
 * way in was Tab — through the rest of the page, since the menu is the last
 * thing in the DOM order of its row. Now: opening moves focus to the first
 * enabled item, Arrow/Home/End move between items and skip disabled ones,
 * and closing — by Escape, by choosing, or by clicking away — puts focus
 * back on the trigger so the row does not lose the keyboard's place.
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
  /** Names the menu for assistive tech, e.g. "Appointment actions". */
  label,
}: {
  /** Receives `open` so the trigger can reflect state (e.g. rotate a chevron). */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: DropdownItem[];
  /** Which side of the trigger the menu hangs from. */
  align?: 'start' | 'end';
  className?: string;
  label?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /* Whether the close should hand focus back. A close caused by clicking
     somewhere else must NOT, or the click's own target loses focus the
     instant it gets it. */
  const returnFocusRef = useRef(false);

  const close = useCallback((returnFocus: boolean): void => {
    returnFocusRef.current = returnFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      if (returnFocusRef.current) {
        returnFocusRef.current = false;
        rootRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
      return undefined;
    }
    const onPointerDown = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    const onKeyDown = (e: KeyboardEvent<never> | globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  /* Opening focus. `role="menu"` promises the arrow keys work, and they can
     only work once focus is inside. */
  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
  }, [open]);

  const moveFocus = (from: HTMLElement, delta: number): void => {
    const menu = menuRef.current;
    if (!menu) return;
    const focusable = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (focusable.length === 0) return;
    const index = focusable.indexOf(from as HTMLButtonElement);
    const next = focusable[(index + delta + focusable.length) % focusable.length];
    next?.focus();
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const menu = menuRef.current;
    if (!menu) return;
    const focusable = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(e.target as HTMLElement, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(e.target as HTMLElement, -1);
        break;
      case 'Home':
        e.preventDefault();
        focusable[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        focusable[focusable.length - 1]?.focus();
        break;
      case 'Tab':
        /* Tab out is a dismissal, not a trap: this is a menu on a row, not a
           dialog, so the rest of the page must stay reachable. */
        close(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      {trigger({ open, toggle: () => (open ? close(true) : setOpen(true)) })}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
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
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                close(true);
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
