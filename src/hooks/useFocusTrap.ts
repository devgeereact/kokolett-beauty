import { useEffect, type RefObject } from 'react';

/**
 * Selector for what a browser will actually stop on with Tab. Deliberately
 * excludes `[tabindex="-1"]`, which is focusable by script but not by keyboard.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside an open overlay and closes it on Escape.
 *
 * This loop existed three times, character for character, in `Modal`,
 * `ConfirmDialog` and `QuickActionLauncher`, each with its own copy of the
 * selector constant. Three copies of a keyboard trap is three places for the
 * behaviour to drift, and the whole point of a trap is that it behaves the
 * same everywhere: a keyboard user who learns the dialog in one screen should
 * not find it different in the next.
 *
 * The caller keeps ownership of what "closed" means, and of where focus goes
 * afterwards, because those differ (Modal returns focus to its trigger,
 * ConfirmDialog focuses Cancel first). Only the trapping is shared.
 */
export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
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
  }, [open, panelRef, onEscape]);
}

/** Exported for the one caller that needs to focus a panel's first control itself. */
export { FOCUSABLE_SELECTOR };
