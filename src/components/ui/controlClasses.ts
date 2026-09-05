import { cn } from '@/lib/utils';

/**
 * Shared class strings for controls that are not components.
 *
 * Everything here describes a look that several call sites must agree on
 * while keeping their own, different, correct semantics — a route link
 * versus a toggle button, an icon button versus a labelled one. A component
 * would have to pick one set of semantics for all of them; a class string
 * does not.
 */

/**
 * The pill-in-a-tray segmented control, as shared class strings rather than a
 * shared component.
 *
 * Three places render this shape and each has different, correct semantics:
 * `CalendarCapacityTabs` is three real routes (`NavLink`), `CalendarShell` is
 * one page's view mode (`aria-pressed` toggles), and Inbox's queue switch is a
 * grouped set of route-changing buttons. Wrapping all three in one component
 * would mean either giving route links toggle semantics or giving toggles link
 * semantics; both are worse than the small duplication of a `<button>` versus
 * a `<NavLink>`.
 *
 * What they must share is the visual role: same tray, same item height, same
 * selected treatment. Until 2026-09-05 they did not — the tray was
 * `rounded-lg bg-muted p-1` in two of them and `rounded-lg border p-0.5` in
 * the third, items were 30px, 44px and 30px tall, and "selected" was a white
 * card, a brand tint and a solid primary fill respectively.
 *
 * Height is `min-h-touch` (44px) deliberately, not the dashboard's 36/40:
 * these switchers are the controls the owner taps most on the salon tablet,
 * and `CalendarShell` had already been raised to 44 for exactly that reason
 * (docs/DESIGN.md §10).
 */
export const segmentedTray = 'inline-flex gap-0.5 rounded-lg bg-muted p-1';

export function segmentedItem(active: boolean): string {
  return cn(
    'inline-flex min-h-touch items-center justify-center rounded-md px-3.5 text-sm font-medium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-tint-brand text-brand-ink'
      : 'text-muted-foreground hover:text-foreground',
  );
}

/**
 * The count that rides inside a segment ("Requests 3"). Reads on both the
 * selected and unselected item, so it is one tinted pill rather than an
 * inverted fill that only works on the selected one.
 */
export function segmentedBadge(): string {
  return 'ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground';
}

/**
 * The icon-only affordance in a dashboard row, card header or toolbar — a
 * row's "view details", a panel's close, an editor's toolbar button.
 *
 * Not a `Button` variant: these carry no label, no fill and no border, and
 * giving `Button` a fifth variant for "looks like nothing" would make the
 * component's contract worse rather than better. What they DO need to share
 * is the box, and they did not: 28, 32 and 36px squares with `rounded-md` or
 * `rounded-lg` were all in use side by side. One size — `--control-height-sm`,
 * the same 36px a `Button size="sm"` is — so an icon action and a labelled
 * action in the same row line up.
 *
 * 36 rather than 44: docs/DESIGN.md §10's dashboard density exception. The
 * public site's icon controls keep `min-h-touch`.
 */
export const iconButtonClass = cn(
  'inline-flex h-control-sm w-control-sm shrink-0 items-center justify-center rounded-md',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:pointer-events-none disabled:opacity-50',
);

/**
 * The public site's control shape, which is deliberately NOT the dashboard's.
 *
 * Marketing controls are 12px-radius and at least 44px tall: they are met
 * once, in a hurry, on a phone, by someone who has never seen the interface
 * (docs/DESIGN.md §10). The owner console is 4px-radius and 36-40px tall
 * because density is what makes a tool you use all day workable. Two
 * families, one rule each. The thing that was wrong was not the two numbers,
 * it was that the public one was retyped at thirteen call sites across
 * `ContactPage`, `BookPage`, `SiteShell`, `HomePage`, `AboutPage`,
 * `ServicesPage`, `SubscribePage`, `MyBookingsPage`, `UnsubscribePage` and
 * `TestimonialsGrid`, and had already drifted to 40, 44 and 48px.
 *
 * Geometry that genuinely differs stays at the call site: a header pill is
 * `px-4`, a form's submit is `w-full h-12`. What is shared is the shape, the
 * colour and the focus ring.
 */
export const publicField = cn(
  'w-full rounded-lg border border-border bg-input px-3.5 text-foreground',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
);

export function publicButton(tone: 'primary' | 'ghost' = 'primary'): string {
  return cn(
    'inline-flex min-h-touch items-center justify-center rounded-lg font-semibold',
    'transition-[filter,background-color] duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-60',
    tone === 'primary'
      ? 'bg-primary text-primary-foreground hover:brightness-110'
      : 'border border-border text-foreground hover:bg-muted',
  );
}

/**
 * A search or filter control in a dashboard toolbar: the row of inputs and
 * selects above a queue, a table or a list.
 *
 * These are not `Field` controls — they have no label above them, only an
 * `aria-label` — so they were hand-rolled sixteen times and had settled on
 * three heights for one job: `h-9` on Appointments and Requests, `h-10` on
 * Email and Audit, `h-11` on Customers and Templates. 36px is both the
 * majority and `--control-height-sm`, which is what the `Button size="sm"`
 * standing beside them in the same row already is.
 *
 * Local extras stay local: `w-full` on the one that fills its column,
 * `pl-9` on the ones with a leading search icon.
 */
export const toolbarControl = cn(
  'h-control-sm rounded-sm border border-border bg-input px-3 text-sm text-foreground',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

/**
 * The underline filter bar above a list: All / Upcoming / Today, or All / New /
 * Answered. Five of these were hand-built, four of them character-identical
 * and one (Appointments) drifted to a wider gap, a different padding, a bolder
 * selected weight and a count pill that stayed grey when selected.
 *
 * A filter is NOT a tab, and this is deliberately not `Tabs`. A tab switches
 * between panels and owes the user arrow-key navigation and a panel
 * relationship; these narrow one list that stays exactly where it is. Plain
 * buttons carrying `aria-pressed` describe that honestly, the same reasoning
 * `CalendarShell` uses for its view toggle. What they share with `Tabs` is only
 * the underline, which is the point: one selected treatment across the app.
 */
export const filterBar = 'flex flex-wrap items-center gap-1 border-b border-border';

export function filterTab(active: boolean): string {
  return cn(
    'flex min-h-control items-center gap-1.5 border-b-2 px-3 text-sm font-medium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'border-primary text-brand-ink'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  );
}

/** The count that rides inside a filter tab. */
export function filterCount(active: boolean): string {
  return cn(
    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold',
    active ? 'bg-tint-brand text-brand-ink' : 'bg-muted text-muted-foreground',
  );
}
