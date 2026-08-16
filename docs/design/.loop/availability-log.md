# Availability screen — design-match log

Target: `WeeklyDefaultPage.tsx`, route `/dashboard/weekly`. Ref:
`docs/design/avalability.png`. Owner also asked upfront for no-scroll,
fit-to-screen.

## The real gap: reference assumes a richer availability model than this app has

Investigated before touching layout, since the reference is unusually
information-dense (a table with 6 columns, 4 tabs, a closures list) and the
existing page's docstring already explained a deliberate, documented
architecture decision. Confirmed via `docs/SCHEMA.md` and the migrations:

- **Migration 0011 ("slots are the model") deliberately deleted**
  `availability_rules` and `availability_exceptions` — a day is *only* a flat
  list of published start times (`availability_slots`). There is no
  continuous "opening hours" range, no separate "breaks" entity, and no
  per-day-of-week cap or toggle. `DayPanel.tsx`'s own doc comment: *"blocking
  out an hour is simply not putting it on the list."*
- `max_appointments_per_day` is one **global** `booking_settings` value, not
  per-weekday — the reference shows 8/8/8/10/10/6/0, implying a per-day
  figure that doesn't exist.
- No per-day "online booking" toggle exists anywhere in schema or services.
- The reference's "Booking settings" tab would duplicate `SettingsPage.tsx`
  → Business tab, which already fully owns every one of those fields
  (advance window, minimum notice, buffer, max/day, approval window) as the
  single editable source — this screen already has a read-only mirror of
  that (`BookingRulesCard`, pre-existing) with an edit link, same pattern
  the reference itself uses via its own sidebar "Booking rules" card.
- No stored date-*range* closure entity exists (no "Summer Break: 11–15 Aug"
  row) — closing a run of days means clearing each date individually via
  `DayPanel`.

Given this, matching the reference's literal 6-column table + 4 tabs would
mean fabricating 3 columns of data with no backing store and inventing a
duplicate settings-editing surface. Instead, matched the reference's real
*intent* — a compact per-day row, a closures list, a rules sidebar — using
only what's genuinely real, same standard as every other screen in this
loop (Customers' tags, Services' categories).

## What was built

- **Weekly schedule**: restyled from stacked accordion rows (`space-y-4`,
  `py-3`) into a tight single-line-per-day table (`py-1`), each row
  reading exactly what's true: Day · Open/Closed badge · derived hours
  range (first–last published time) · time count · the one real global
  max/day figure · Edit. Clicking a row still expands the existing
  chip-based time editor in place — that mechanism was already correct,
  just needed a denser default state.
- **"Adjust a single day"** moved from an always-rendered `Card` (with its
  own accordion toggle, ~90px even collapsed) to a button that opens
  `DayPanel` in a `Modal` — positioned where the reference puts
  "+ Add special hours", bottom-left under the table.
- **New `SpecialHoursClosuresCard`**: since there's no stored closure
  entity, this *derives* real exceptions — any date in the generator's
  filled horizon where actual published slots disagree with the weekly
  pattern (normally-open-but-empty = closed override; normally-closed-but-
  published = extra hours). Bounded to `status.filled_to` specifically
  because beyond that horizon an empty day means "not generated yet," not
  "closed" — comparing past the horizon would have manufactured false
  closures out of the nightly fill job simply not having reached that far.
  Capped display to 4 rows with an honest "+N more — view full calendar"
  link rather than silently truncating. Each row is clickable and opens the
  same single-day `Modal`, pre-set to that date.
- Verified live: clicking "Adjust a single day" opens today with real
  booked/free slots; clicking an exception row (e.g. "Sunday, 16 August
  2026") opens that exact date showing "No times published — nothing can
  be booked," confirming the derivation is accurate and actionable, not
  just decorative.
- The existing "Put it on the calendar" (apply pattern → real days) and
  "How this behaves" explainer stayed behind "Show advanced options",
  unchanged in that regard — already collapsed by default before this
  pass, so it cost nothing toward the fit-to-screen budget.
- Tightened every card's padding (`p-5`→`p-4`/`p-3.5`) and internal
  spacing across `OpeningHoursSummaryCard`, `NextWeeksGlanceCard`,
  `BookingRulesCard`, `BookingPageStatusCard` (all pre-existing, already
  real/polished per a prior pass — just compacted, not rebuilt).

## Not implemented — logged, not guessed at

- Per-day-of-week max-bookings column, per-day online-booking toggle,
  editable breaks-as-a-range field, a duplicate "Booking settings" tab, a
  stored date-range closure entity — see the schema reasoning above. All
  would require either fabricating data or a real migration/product
  decision, neither of which is a design-match call.

## No-scroll fit — measured, not eyeballed

Same method as Services/Customers: `document.body.scrollHeight` vs
`window.innerHeight` at 1536 wide (the layout is `min-h-screen`, so a
reading equal to `innerHeight` only proves "fits or shorter," not "exactly
fits" — cross-checked with screenshots too).

| height | before restyle | after |
|---|---|---|
| 1024px | scrolled (~1090px content) | fits, real headroom |
| 900px | — | fits exactly (900/900) |
| 800px | — | 878/800 (78px over) |

Stopped at the 900px baseline — same bar `customer-log.md` settled on for
its own content-heavy screen. This page is the densest yet in the loop (a
7-row table + a 4-row closures list + 4 sidebar cards), so 900px is a
reasonable floor rather than chasing 800px and making the table
uncomfortably tight.

Verified interactions post-tightening: day-row expand/collapse, single-day
modal (both entry points), "Show advanced options" reveal — all still
read correctly at the tightened spacing, not just measuring right.

## Dark theme + mobile breakpoint pass

No reference for either. Judged against tokens and the pattern already
converged on every other screen in this loop.

- Dark desktop: clean, status badges (Open/Closed, Closed all day, Live)
  and the calendar dot colours all read correctly.
- Mobile light/dark (390×844): everything stacks single-column, hours
  range hides at narrow width (existing `hidden sm:inline`, not new),
  scrolling is expected and fine here — the no-scroll ask was about
  desktop fit, not mobile.

Build clean on every iteration. Full test suite: 154/154 passing.

## Iteration — follow-up request: professional polish pass

Owner asked for a general polish pass. Rather than re-guess at the
reference, audited the shipped screen against the app's own established
interaction/hover/focus conventions (the exact classes already proven on
`ApprovalCard`/`RequestRow`/`CustomerCard`) and fixed the real gaps:

- **Weekly schedule day rows had zero hover/focus feedback.** The button
  wrapping each row was a bare `flex ... text-left` — clickable with no
  affordance that it was. Added `rounded-md p-2 -mx-2
  transition-colors hover:bg-muted focus-visible:ring-2
  focus-visible:ring-ring`, matching the row-highlight language every other
  clickable card/row in the app already uses. Verified visually
  (`availability-row-hover.png`) — the highlight now reads clearly and
  extends edge-to-edge.
- **`SpecialHoursClosuresCard` rows had a hover but no `transition-colors`
  or border-hover** — added `transition-colors hover:border-foreground/20`
  alongside the existing `hover:bg-muted`, matching the exact hover pattern
  every other card row (Approvals, Requests, Customers, Services) already
  uses, instead of a one-off variant.
- **"Show advanced options" toggle had no focus-visible ring** — added one,
  consistent with every other custom interactive element on the page.
- Considered recolouring the "Closed all day" badge to a stronger red for
  more visual differentiation from "Extra hours" — checked the actual
  token first (`--status-cancelled: #6b7280`, a neutral grey in this
  design system, not red — red lives on the `urgent`/no-show token
  instead). A closed day is normal, planned information, not an alarm —
  gray (`neutral`) is the semantically correct tone here, not a red one
  the reference's arbitrary mockup colour would have implied. Left as-is
  rather than force a mismatched semantic.
- **Loosened padding now that there was headroom to spare.** The prior
  pass compressed hard to guarantee no-scroll; re-measuring showed the
  *right* sidebar column (900px), not the *left* schedule column, was the
  actual height constraint — so the left column's cards (`p-3.5`→`p-4`)
  could regain some breathing room for free, with zero risk to the fit
  budget. Re-verified: still 900/900 exact fit, unchanged from before this
  pass.

Re-measured the full fit table after every change — unchanged from the
previous pass (900px exact, 878/800 at the unusually short baseline),
confirming the polish additions cost nothing toward the no-scroll
requirement. Re-verified dark theme and reran the full test suite:
154/154 passing.

## Stop

Converged. The screen matches the reference's real intent as closely as
this app's deliberately simpler availability model allows, fits without
scrolling down to 900px viewport height, every number/date shown is real,
and every interactive element now carries the same hover/focus language
already established everywhere else in the app.
