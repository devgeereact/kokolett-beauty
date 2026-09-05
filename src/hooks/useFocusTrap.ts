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
/**
 * Open focus traps, innermost last. Module-level on purpose: the whole point
 * is that separate `useFocusTrap` instances can see each other.
 */
const trapStack: object[] = [];

export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;

    // Register on the shared stack the moment this trap opens, so the layer
    // that opened LAST is the one Escape closes.
    //
    // Every trap binds its own listener to `document`, and Escape is not
    // stopped, so before this both listeners fired: pressing Escape on a
    // ConfirmDialog opened from inside a Modal closed the confirm AND the
    // modal behind it. On the appointment editor that meant changing your mind
    // about a delete also threw away the note you had just typed.
    //
    // A stack rather than `stopImmediatePropagation()` because these are
    // sibling listeners on the same node: dispatch order there is registration
    // order, and an ancestor that opened first always registers first, so it
    // would win regardless of what the inner one calls.
    const token = {};
    trapStack.push(token);

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (trapStack[trapStack.length - 1] !== token) return;
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      if (trapStack[trapStack.length - 1] !== token) return;

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
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const at = trapStack.indexOf(token);
      if (at !== -1) trapStack.splice(at, 1);
    };
  }, [open, panelRef, onEscape]);
}

/** Exported for the one caller that needs to focus a panel's first control itself. */
export { FOCUSABLE_SELECTOR };
