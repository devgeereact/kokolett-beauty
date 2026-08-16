import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  NewBookingPanel,
  type PrefilledCustomer,
} from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { MarkCompletedStep } from '@/components/dashboard/quickActions/MarkCompletedStep';
import { OfferSlotStep } from '@/components/dashboard/quickActions/OfferSlotStep';
import { RebookSearchStep } from '@/components/dashboard/quickActions/RebookSearchStep';
import { ITEM_BUTTON_CLASS } from '@/components/dashboard/quickActions/shared';
import { useToast } from '@/context/ToastContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { setAppointmentStatus } from '@/services/appointmentService';
import type { QueuedRequest } from '@/services/requestService';
import { errorMessage } from '@/lib/errors';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, Customer } from '@/types';

/**
 * The cross-nav quick-action launcher.
 *
 * Deliberately narrow: exactly 4 actions, each with its
 * own scoped search rather than one combined index across appointments,
 * customers and requests — built out in `./quickActions/*Step.tsx`. Mounted
 * once inside `DashboardLayout`, next to the Notifications link — every
 * owner route renders through that layout, so a single instance here (not
 * one per page) covers Cmd+K everywhere.
 *
 * Self-contained: owns its own open/step state rather than being controlled
 * by `DashboardLayout`, exposing neither props nor a ref. The trigger button
 * and the modal live in the same component so the "next to Notifications"
 * placement and the Cmd+K listener can't drift out of sync with each other.
 *
 * This file keeps orchestration only — state, keyboard/focus management, and
 * routing between steps. Each step's own search/fetch logic and markup lives
 * in its own file under `./quickActions/`.
 */

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Whether Cmd+K/Ctrl+K landed on something the owner is actively typing
 * into. Checks the `contenteditable` attribute directly rather than relying
 * solely on `Element.isContentEditable` — jsdom (the test environment) does
 * not implement that getter, so a check that only used it would pass in a
 * real browser but silently do nothing under test.
 */
function isEditableTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  const attr = target.getAttribute('contenteditable');
  return attr === '' || attr === 'true';
}

type Step =
  | { kind: 'menu' }
  | { kind: 'new-booking' }
  | { kind: 'mark-completed' }
  | { kind: 'rebook-search' }
  | { kind: 'rebook-booking'; prefill: PrefilledCustomer }
  | { kind: 'offer-slot' };

type ActionId = 'new-booking' | 'mark-completed' | 'rebook-search' | 'offer-slot';

/**
 * The dialog's accessible name per step — read by a screen reader the moment
 * focus enters it, so it should say what's actually showing rather than
 * "Quick actions" throughout (the menu step is the only one where that's
 * literally true). The two `NewBookingPanel` steps reuse its own on-screen
 * heading ("Take a booking") rather than inventing a second name for the
 * same form.
 */
function dialogLabel(step: Step): string {
  switch (step.kind) {
    case 'menu':
      return 'Quick actions';
    case 'new-booking':
    case 'rebook-booking':
      return 'Take a booking';
    case 'mark-completed':
      return 'Mark completed';
    case 'rebook-search':
      return 'Rebook customer';
    case 'offer-slot':
      return 'Offer slot to request';
  }
}

const ACTIONS: { id: ActionId; label: string; hint: string }[] = [
  {
    id: 'new-booking',
    label: 'New booking',
    hint: 'Take a booking by phone or in person.',
  },
  {
    id: 'mark-completed',
    label: 'Mark completed',
    hint: 'Find a live appointment and close it off.',
  },
  {
    id: 'rebook-search',
    label: 'Rebook customer',
    hint: 'Find a customer and book their next visit.',
  },
  {
    id: 'offer-slot',
    label: 'Offer slot to request',
    hint: 'Find a waiting request and jump to it in the queue.',
  },
];

export function QuickActionLauncher(): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { timezone } = useBusinessSettings();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'menu' });
  const [completingId, setCompletingId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Also what Cmd+K/Ctrl+K calls, including while the launcher is already
  // open mid-search — deliberately: it resets to the top-level menu rather
  // than toggling closed or leaving an in-progress step untouched. A second
  // "open" press is rare (there's no reason to press it again once the
  // panel is already showing), and when it does happen — a habitual
  // reflex-press, or genuine uncertainty about what's currently on
  // screen — landing back on the known 4-action menu is a safer, more
  // orientating default than silently doing nothing to whatever step
  // happened to be open.
  const openLauncher = useCallback((): void => {
    setStep({ kind: 'menu' });
    setOpen(true);
  }, []);

  const close = useCallback((): void => {
    setOpen(false);
  }, []);

  const goToStep = useCallback((id: ActionId): void => {
    setStep({ kind: id });
  }, []);

  const backToMenu = useCallback((): void => {
    setStep({ kind: 'menu' });
  }, []);

  /** Action 2: no confirmation needed, matching `AppointmentCard`'s own
   * "mark complete" behaviour everywhere else in the app. */
  const completeAppointment = async (appointment: AppointmentDetailed): Promise<void> => {
    setCompletingId(appointment.id);
    try {
      await setAppointmentStatus(appointment.id, 'completed');
      showToast({
        message: `Marked ${appointment.customer_name}'s appointment as completed.`,
      });
      close();
    } catch (e) {
      showToast({ message: errorMessage(e) });
    } finally {
      setCompletingId(null);
    }
  };

  const selectCustomerToRebook = (customer: Customer): void => {
    setStep({
      kind: 'rebook-booking',
      prefill: {
        fullName: customer.full_name,
        email: customer.email,
        mobile: customer.mobile ?? '',
      },
    });
  };

  /**
   * The actual "offer a slot" interaction (date/time picker, fairness
   * warnings, mandatory override reason) lives entirely inside
   * `RequestDetailPanel.tsx` and isn't a separable component — reimplementing
   * it here would duplicate DB-enforced, fairness-critical business logic.
   * This is a "find the right request, jump straight to it" shortcut, not a
   * second way to answer one. Scrolling to / highlighting the specific
   * request once there would require `RequestsQueue` to accept a highlight
   * prop, which touches its internals — explicitly out of scope, so this
   * only navigates.
   */
  const jumpToRequest = (_request: QueuedRequest): void => {
    close();
    void navigate(`${routes.owner.inbox}?tab=requests`);
  };

  /* --------------------------------------------- keyboard & focus --- */

  // Global Cmd+K / Ctrl+K — mounted unconditionally (not just while open), so
  // it works from every dashboard route without a per-page listener. Ignored
  // while focused in a text input, textarea or contenteditable element so an
  // owner typing into any of the app's search/note fields never has it
  // hijacked.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      if (isEditableTarget(e.target as HTMLElement | null)) return;
      e.preventDefault();
      openLauncher();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openLauncher]);

  // Focus moves into the dialog on open, and back to whatever triggered it on
  // close — same contract as ConfirmDialog.
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      returnFocusRef.current?.focus();
    };
  }, [open]);

  // Escape always closes the whole launcher, at every step — including while
  // NewBookingPanel is showing. It doesn't "step back" first: two of the four
  // actions (New booking, Rebook) already wire NewBookingPanel's own
  // `onClose` straight to closing the launcher per the brief, so a
  // step-dependent Escape (back here, close there) would make the same key
  // mean two different things depending on which action is active. A visible
  // "← Back to quick actions" link handles the step-back case instead. Tab
  // cycling is trapped inside the panel, matching ConfirmDialog.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
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
  }, [open, close]);

  // Initial focus per step: the search box for a search step (so typing can
  // start immediately), the first navigable item for the menu, or — for the
  // two NewBookingPanel steps, which have no `[data-quicklauncher-item]`s of
  // their own — the panel's first focusable control generally.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (
      step.kind === 'mark-completed' ||
      step.kind === 'rebook-search' ||
      step.kind === 'offer-slot'
    ) {
      searchInputRef.current?.focus();
      return;
    }
    if (step.kind === 'menu') {
      panel.querySelector<HTMLElement>('[data-quicklauncher-item]')?.focus();
      return;
    }
    panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [step, open]);

  /**
   * Arrow keys move real DOM focus between whichever `[data-quicklauncher-item]`
   * buttons the current step rendered — the 4 actions, or a step's search
   * results. Because those are real `<button>`s, Enter needs no handling of
   * its own: it activates the focused button natively. From the search
   * input (not itself an item), ArrowDown enters the list at the first
   * result; nothing renders any items during the two NewBookingPanel steps,
   * so arrow keys there fall through to native input/control behaviour
   * untouched (no items found → no `preventDefault`).
   */
  const handleArrowKeys = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>('[data-quicklauncher-item]'),
    );
    if (items.length === 0) return;
    const active = document.activeElement;
    const currentIndex = active ? items.indexOf(active as HTMLElement) : -1;
    e.preventDefault();
    let nextIndex: number;
    if (currentIndex === -1) {
      nextIndex = e.key === 'ArrowDown' ? 0 : items.length - 1;
    } else if (e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % items.length;
    } else {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }
    items[nextIndex]?.focus();
  };

  const trigger = (
    <button
      type="button"
      onClick={openLauncher}
      aria-haspopup="dialog"
      aria-expanded={open}
      // Visible copy reads as a search box (the familiar Cmd+K pattern —
      // VS Code, Notion, Linear all style their command launcher this way),
      // but the accessible name stays "Quick actions" so it doesn't drift
      // from what dialogLabel/the tests below actually expect: this opens
      // the 4-action launcher, not a live-filtering search field.
      aria-label="Quick actions"
      className={cn(
        'inline-flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-border px-3 text-sm md:w-64',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        open ? 'bg-muted text-foreground' : 'bg-input text-muted-foreground hover:bg-muted',
      )}
    >
      <Search aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span className="flex-1 truncate text-left">Search anything…</span>
      <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
        ⌘K
      </kbd>
    </button>
  );

  if (!open) return trigger;

  return (
    <>
      {trigger}

      {/*
       * Portaled to `document.body` rather than rendered in place. The
       * trigger button lives in `DashboardLayout`'s header, which has
       * `backdrop-blur` (`backdrop-filter`) — and in Chromium, an ancestor
       * with a filter/backdrop-filter establishes a new containing block for
       * `position: fixed` descendants, the same way `transform` does. Left
       * in place, this modal's `fixed inset-0` resolved against that ~70px
       * header instead of the real viewport, rendering the panel's top
       * clipped above the visible page. A portal escapes the header
       * entirely, so `fixed` means the viewport again.
       *
       * No `overflow-y-auto` on this wrapper — only the panel itself
       * scrolls. A second scrollable ancestor around it made the browser's
       * implicit scroll-into-view (from the initial-focus effect below)
       * sometimes scroll *this* wrapper instead of the panel.
       */}
      {createPortal(
        <div className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[8vh] md:items-center md:pt-4">
          <button
            type="button"
            aria-label="Close quick actions"
            tabIndex={-1}
            className="overlay-backdrop fixed inset-0"
            onClick={close}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel(step)}
            onKeyDown={handleArrowKeys}
            className={cn(
              'relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto shadow-modal',
              // The two NewBookingPanel steps render their own Card chrome
              // (border/shadow/background) — giving this wrapper the same
              // chrome around it would nest one card inside another instead
              // of the single clean surface every other popup shows.
              step.kind === 'new-booking' || step.kind === 'rebook-booking'
                ? undefined
                : 'rounded-xl border border-border bg-popover p-5 text-popover-foreground',
            )}
          >
            {step.kind === 'menu' && (
              <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-foreground">
                      Quick actions
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Jump straight to the 4 things you do most.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={close}>
                    Close
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      data-quicklauncher-item
                      onClick={() => goToStep(action.id)}
                      className={ITEM_BUTTON_CLASS}
                    >
                      <p className="font-medium text-foreground">{action.label}</p>
                      <p className="text-sm text-muted-foreground">{action.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step.kind === 'new-booking' && (
              <div>
                <button
                  type="button"
                  onClick={backToMenu}
                  className="mb-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  ← Back to quick actions
                </button>
                <NewBookingPanel
                  onBooked={(reference) => {
                    showToast({ message: `Booked. Reference ${reference}.` });
                    close();
                  }}
                  onClose={close}
                />
              </div>
            )}

            {step.kind === 'mark-completed' && (
              <MarkCompletedStep
                timezone={timezone}
                searchInputRef={searchInputRef}
                completingId={completingId}
                onSelect={(appointment) => void completeAppointment(appointment)}
                onBack={backToMenu}
                onClose={close}
              />
            )}

            {step.kind === 'rebook-search' && (
              <RebookSearchStep
                searchInputRef={searchInputRef}
                onSelect={selectCustomerToRebook}
                onBack={backToMenu}
                onClose={close}
              />
            )}

            {step.kind === 'rebook-booking' && (
              <div>
                <button
                  type="button"
                  onClick={backToMenu}
                  className="mb-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  ← Back to quick actions
                </button>
                <NewBookingPanel
                  prefill={step.prefill}
                  onBooked={(reference) => {
                    showToast({
                      message: `Booked ${step.prefill.fullName}'s next visit. Reference ${reference}.`,
                    });
                    close();
                  }}
                  onClose={close}
                />
              </div>
            )}

            {step.kind === 'offer-slot' && (
              <OfferSlotStep
                searchInputRef={searchInputRef}
                onSelect={jumpToRequest}
                onBack={backToMenu}
                onClose={close}
              />
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
