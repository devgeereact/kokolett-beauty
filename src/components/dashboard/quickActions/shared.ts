import { cn } from '@/lib/utils';

/**
 * Shared between `QuickActionLauncher` and its three search steps
 * (`MarkCompletedStep`, `RebookSearchStep`, `OfferSlotStep`).
 */

/** How many rows a scoped search shows — enough to recognise the right one,
 * short enough to stay "quick". */
export const MAX_RESULTS = 8;

/**
 * Every result `<button>` in every step carries a literal `data-quicklauncher-item`
 * attribute (not exported as a constant — JSX `data-*` props must be static
 * identifiers, so a shared name here couldn't be spread onto them any more
 * conveniently than just writing it). `QuickActionLauncher` queries that
 * attribute generically, via `panel.querySelectorAll('[data-quicklauncher-item]')`,
 * so arrow-key focus works the same way for the 4 menu actions and every
 * step's search results without the parent needing to know which step
 * rendered them.
 */

export const ITEM_BUTTON_CLASS = cn(
  'w-full rounded-lg border border-border p-3 text-left transition-colors',
  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:pointer-events-none disabled:opacity-60',
);
