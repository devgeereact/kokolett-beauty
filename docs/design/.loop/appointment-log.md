# Appointments (AppointmentsPage.tsx) — design-match log

Ref: `docs/design/appointment.png`. Route: `/dashboard/appointments`.

## Baseline

Already substantially built: tabs (All/Upcoming/Today/In service/Completed/
Cancelled-No-show) with counts, search + date/service toolbar, full table (Time/
Client/Service/Staff/Status/Reference/Actions), right-rail Filters card, pagination.
Refinement, not a from-scratch build.

## Iteration 1 (light, desktop, 1536×1024)

Screenshot: `appointment-1.png`.

Diff found and fixed:
1. **Date-range toolbar select had no icon** — ref shows a small calendar icon
   inside the "Date: This week" box. Added a `Calendar` icon (lucide-react),
   matching the same icon-inside-input pattern already used by the search box
   right next to it.

Diffs found and deliberately left alone (log only, all pre-existing documented
decisions, same pattern as the Calendar screen):
- **No Staff/Location dropdowns** in the toolbar or the Filters rail. Documented
  in `AppointmentsFilterPanel.tsx`: single-owner, single-site salon — a picker
  offering exactly one choice would be a fake control, already dropped from
  Calendar's own filters for the same reason.
- **No "Save as view" / "Apply filters" buttons**. Documented: every filter here
  is live (changes the list immediately) rather than staged, so a button that
  only confirms what already happened would be decorative.
- **"More filters" only appears on mobile/`lg:hidden`**, not in the desktop
  toolbar. Correct — it's the trigger that opens the always-visible desktop rail
  as a panel on narrow screens where that rail isn't shown inline; duplicating it
  in the desktop toolbar next to the already-visible rail would be redundant.
- **Reference format differs** (`KB-6YMHUH` vs ref's `KBUK-210525-012`) — real
  business data/reference-generation logic, not a template issue.
- Ref shows two "Export" buttons (one inline in the toolbar, one detached above
  the Filters card) — almost certainly a mockup artifact, not two distinct
  actions. Kept the single toolbar Export already implemented.

Build clean. Screenshot after fix: `appointment-2.png`.

## Dark theme (desktop)

Screenshot: `appointment-dark-1.png`. Clean — table, tabs, filter rail, status
pills all resolve correctly on the dark surface. No changes needed.

## Mobile (390×844, light)

Screenshot: `appointment-mobile-light-1.png`. Tabs wrap to multiple rows, toolbar
wraps, "More filters" button appears (as intended, see above). The table itself
only shows Time/Client/Service in the initial viewport — checked whether this was
the same cramped-column bug as Calendar's Week view: it is not. Confirmed via
`browse js` (`scrollWidth` 757 vs `clientWidth` 356) that
`AppointmentsTable.tsx` already wraps the table in `overflow-x-auto` — Staff/
Status/Reference/Actions are reachable by horizontal scroll, not lost. This is
the correct responsive pattern (the one Calendar's Week view is missing).
Dark mobile not separately screenshotted — same table/CSS path as light mobile,
and desktop dark already confirmed no token issues.

## Iteration 3 — user request: fit to screen, no dead space at bottom

The two-column area (table + Filters rail) was `lg:h-[calc(100vh-19rem)]` (720px
at 1024 viewport height) with `items-stretch` — sized to give the table a
generous scroll budget so the page fits one screen. Filters' real content is only
~578px (no Staff/Location/Save-view — dropped earlier as fake single-choice
controls). Measured via `browse js` bounding rects: Filters card ended 142px
above the table/pagination bottom — a visibly lopsided gap under the shorter
column, even though technically it was just page background (the `<aside>`
wrapper itself has no border/shadow, only the `Card` inside it does).

Fix: dropped the viewport-derived fixed height from the row entirely, and
instead capped the table's own scroll wrapper at `lg:max-h-[34rem]` — a fixed
budget close to the Filters rail's natural height, rather than a much taller
one sized for the whole remaining viewport. Re-measured: Filters bottom 808,
pagination bottom 838 — 30px apart, both columns now end near the same point
instead of 142px apart. Page still fits exactly one screen
(`document.documentElement.scrollHeight === window.innerHeight`, 1024 = 1024) —
no page-level scroll, same as before. The table now shows ~5 rows before its
own internal scroll kicks in (down from ~7) — a reasonable trade for the
balanced layout.

Verified light + dark desktop (`appointment-3.png`, `appointment-dark-2.png`).
Mobile unaffected — the changed classes are all `lg:`-scoped; mobile already had
no height cap and stacks the full table with normal page scroll
(`appointment-mobile-light-2.png`). Build clean.

## Iteration 4 — user request: remove remaining bottom space; static, non-scrolling sidebar

User annotated a screenshot: a large gray gap below the table/pagination and
Filters card (full-width, page bottom), and the sidebar's account/business-info
block + theme toggle, asking to remove both and make the sidebar static.

**Main content:** iteration 3's fix (cap table to `34rem` to roughly match
Filters' height) balanced the two columns but still reserved more vertical
space than either needed — any fixed-budget/magic-number approach leaves some
residual gap. Removed the height cap and internal scroll entirely
(`lg:max-h-[34rem] lg:overflow-y-auto`, the `lg:items-stretch`/`lg:h-full` on
the row and aside) — the table and Filters card now render at their own
natural height, full page flow, no artificial reserved space. Page now scrolls
normally past one viewport when content needs it (1238px content vs 1024px
viewport) instead of forcing everything into a fixed budget with leftover gap.
This is a deliberate trade: honest natural-height content over a "fits exactly
one screen" guarantee that kept producing gaps whenever real content didn't
match the guessed budget.

**Sidebar (`DashboardLayout.tsx` — shared shell, affects every dashboard
page):** removed the owner-profile link (avatar/name/"Owner"), the
"Kokolett Beauty UK" business-info block (address/phone/email/"View public
site"), and the light/dark `ThemeToggle` from the sidebar footer — kept only
"Sign out". Verified before removing: Profile is still reachable from Settings
(`AccountSummaryCard`/`SecurityCard` both link `routes.owner.profile`), and
`ProfilePage.tsx` has its own `ThemeToggle` — nothing lost, just relocated to
where it already lived. Removed now-unused imports (`splitAddressLines`,
`ThemeToggle`) and the `settings` destructure from `useBusinessSettings`
(still used for `timezone`).

With the footer down to one button, dropped the nav's own `overflow-y-auto`
scroll region on desktop — nav + footer now fit statically in one viewport,
footer pinned to the bottom via `mt-auto` (was `border-t` + `shrink-0` before,
same visual anchor, no longer needs its own scroll to stay reachable). Mobile
drawer keeps a scroll fallback at the outer drawer level (not the old
split-scroll) for shorter phone viewports — verified by scrolling: Settings and
Sign out both remain reachable there.

Verified: build clean; Appointments light/dark desktop
(`appointment-4.png`, `appointment-dark-3.png`); Dashboard and Calendar screens
re-checked with the new shared sidebar (`dashboard-shell-check.png`,
`calendar-shell-check.png`) — both still render correctly, calendar still fits
one screen; mobile drawer scrolled to confirm Settings/Sign out reachable
(`appointment-mobile-drawer-scrolled.png`).

## Iteration 5 — user correction: static full screen, exact alignment (not natural scroll)

Iteration 4 traded the fixed-height/scroll approach for natural content flow,
which let the page scroll ~214px past the viewport. User clarified that's not
what they wanted — they want the whole screen static (no scroll, like
Calendar) with the dead space gone and the two columns actually aligned, not
approximated.

Measured precisely via `browse js`: Filters card's natural height is exactly
578px. Table column = scrollable table area + `gap-4` (16px) + Pagination
(48px) → table's own scroll area needs to be exactly 578 − 16 − 48 = 514px to
match. Set `lg:max-h-[514px] lg:overflow-y-auto` on the table wrapper (an
exact figure this time, not an approximation like iteration 3's `34rem`), and
restored `lg:items-stretch` on the row as a safety net for any 1-2px rounding.

Re-measured after: Filters card bottom = 808, table column bottom = 808 —
exact match, 0px apart. `document.documentElement.scrollHeight ===
window.innerHeight` (1024 = 1024) — static, no page scroll. Table now shows
~5 rows before its own internal scroll, same trade as iteration 3.

Verified light + dark desktop (`appointment-5.png`, `appointment-dark-4.png`).
Mobile unaffected — `lg:`-scoped change only; mobile still shows the full
table with normal page scroll (`appointment-mobile-light-3.png`). Build clean.

## Iteration 6 — user correction: the gap was to the window bottom, not between columns

"Still not fixed." Asked a clarifying question rather than guess a third time:
the gap iteration 5 left (808px content, 1024px viewport) was still a full-width
band from the aligned content down to the actual bottom of the window — I'd
fixed column-to-column alignment but never addressed that the whole block was
shorter than the available viewport.

Reverted to the viewport-derived height (`lg:h-[calc(100vh-19rem)]`,
`lg:items-stretch`, table's inner scroll area back to `min-h-0 flex-1
lg:overflow-y-auto`, aside back to `lg:h-full lg:overflow-y-auto` — same shape
as the very first version) — but this time also made `AppointmentsFilterPanel`'s
own `Card` `flex h-full flex-col` (it previously only had `p-5`, sizing to its
own short content regardless of what the invisible `aside` wrapper around it
did — which is *why* iterations 1–4 could never visually close this gap no
matter what the aside's height was: the visible card never stretched, only its
invisible wrapper did). Now the Filters card's own visible border stretches to
match the table column, so both are one uniform block reaching the same real
height budget — not matched to each other at a short, arbitrary figure.

Re-measured: Filters card and table column both 720px (top 230, bottom 950),
`document.documentElement.scrollHeight === window.innerHeight` (1024 = 1024).
Remaining margin from content-bottom to window-bottom is 74px — the same
`main` padding-bottom every other screen has (matches Calendar's own residual
margin, already accepted there). Table now shows ~7 rows before its internal
scroll, real content filling real space instead of a fixed 5-row guess.

Verified light + dark desktop (`appointment-6.png`, `appointment-dark-5.png`).
Mobile unaffected (`lg:`-scoped changes only; `h-full` on the Card is inert in
mobile's normal document flow) — `appointment-mobile-light-4.png`. Build clean.

## Iteration 7 — user request: match the table card to the (now-good) Filters card

Filters card confirmed good. The table still looked unfinished next to it: its
scroll was applied from *outside* (`min-h-0 flex-1 lg:overflow-y-auto` wrapping
`AppointmentsTable`), which clipped the table's own bordered/rounded box along
with the rows — the box's natural content (918px) was taller than the clip, so
its bottom border and rounded corners rendered below the visible line and never
showed. Confirmed via a tight crop (`appointment-table-bottom-crop.png` before
the fix showed no visible bottom edge at all).

Fix: moved the scroll inside `AppointmentsTable`'s own root div —
`h-full overflow-auto rounded-xl border ...` there instead of on the page's
wrapper (which is now just `min-h-0 flex-1`, sizing the space without clipping
it). Added `sticky top-0 z-10 bg-card` to `<thead>` while touching this, so the
column headers stay visible while the body scrolls, matching the Filters card's
un-scrolled fully-visible feel as closely as a taller dataset allows.

Result: the table box now renders as a complete, closed card — visible border
and rounded corners on all four sides at all times — same as Filters, verified
by cropping the exact boundary (`appointment-table-bottom-crop.png`, after).
Table box itself ends 64px above Filters' bottom (886 vs 950) because
Pagination sits below it as its own element, same as the reference's own
layout (pagination outside the table card) — table box + gap + Pagination
still reaches the same 950 line Filters does.

Verified light + dark desktop (`appointment-7.png`, `appointment-dark-6.png`).
Mobile unaffected — the `h-full`/`overflow-auto` only constrains anything once
the `lg:`-scoped height budget upstream exists; below that breakpoint the box
just sizes to its natural content and shows every row
(`appointment-mobile-light-5.png`). Build clean.

## Iteration 8 — user correction: pagination shouldn't share the card's height budget

Clarified: they didn't want Pagination folded into the table column's height
(which is why the table card was 64px shorter than Filters — it was reserving
room for Pagination beneath it inside the same flex column). They want the
table *card* to match Filters exactly, and Pagination to live below the whole
row as its own element, not something that needs to align with either card.

Restructured: `AppointmentsTable` is now the sole content of the table column
(no more inner `flex flex-col` wrapper splitting scroll-area vs pagination) —
it's a direct `h-full` sibling of the Filters `aside`, so `items-stretch`
sizes both identically off the same row height with nothing else competing for
that space. `Pagination` moved outside the two-column row entirely, rendered
as its own block underneath.

That pushed total page height slightly past the viewport (1046 vs 1024 — the
row's existing `calc(100vh-19rem)` budget didn't leave room for the now-external
Pagination row). Tightened: row height to `calc(100vh-21rem)` and the gap
before Pagination from `mt-6` to `mt-4`. Re-measured: Filters card and table
card both exactly 230–918, Pagination 934–982, `scrollHeight === innerHeight`
(1024 = 1024) — both cards pixel-identical, Pagination a clean separate row
below, page still fits one screen.

Verified light + dark desktop (`appointment-9.png`, `appointment-dark-7.png`).
Mobile unaffected — no `lg:` height constraints apply below that breakpoint, so
the table just shows all rows with Pagination following naturally in normal
page flow (`appointment-mobile-light-6.png`). Build clean.

## Iteration 9 — user request: replace Filters rail with Appointment Details, default to next appointment, drop the view popup

Two screenshots: a crop of the aligned card borders (asked to "clean up the
border line... make it all look professional"), and Calendar's
`AppointmentDetailPanel` as the spec for what should replace the Filters rail.
Asked one clarifying question first, since this removes real functionality:
Status/Payment-status filtering only exists in that rail today (the toolbar
only has Date range/Service). Confirmed: drop them entirely, per the request.

**Replaced the rail.** `AppointmentsFilterPanel` → `AppointmentDetailPanel`
(reused directly from `components/dashboard/calendar/`, same component
Calendar already uses — not a duplicate). Added the same
`selected`/`defaultAppointment`/`displayed`/`displayedContextLabel` pattern
Calendar's page uses: nothing explicitly clicked → prefer whichever
appointment is `in_service` right now, else the soonest upcoming one within
the loaded window ("Currently in service" / "Next up" label); a row click
overrides that via `selectedId`, with a close (✕) button to return to the
default. Passed `className="h-full"` so the card matches the table's height
exactly, same as Filters did (verified: both 230–918px, page still fits one
screen).

**Dropped the popup.** Row click / eye icon now sets `selectedId` (updates the
side panel in place) instead of opening a view modal. "Edit appointment" /
"Reschedule" inside the panel still open `AppointmentEditModal` — that's the
real editing surface (status actions, notes, payment, follow-up), now opened
via a separate `editing`/`moving` state instead of being tied 1:1 to
`viewing`. Verified: clicking a row updates the panel with no modal, "Edit
appointment" opens the full modal correctly, closing it returns to the panel.

**Removed as dead code**: `AppointmentsFilterPanel.tsx` (no other consumer),
`paymentStatus` state + its filter branch (no UI could ever set it once the
rail was gone), `categoryCounts` and `toggleCategory` (rail-only), `clearAll`
(rail-only "Clear all" handler), `filtersOpen` state and the mobile "More
filters" toggle button (`AppointmentDetailPanel` just stacks full-width on
mobile with no toggle needed, matching Calendar's own rail), `anchor` state
(dead once its only setter — the rail's prev/next stepper — was gone; date
range now just uses `today` directly).

**Border/radius**: reviewed the actual rendered corners at the boundary the
screenshot highlighted (`appointment-corner-crop.png`) — both cards already
use the same `rounded-xl` + `border-border` token, render as clean closed
boxes with no double-border or mismatch. Did not change the radius to a
literal 1px as phrased — that would break consistency with every other Card
in the app (Dashboard, Calendar all use the same `rounded-xl` token) — flagged
this instead of silently applying a global design-system change.

Verified: build clean; light/dark desktop
(`appointment-panel-1.png`/`-selected`/`-dark.png`); mobile
(`appointment-panel-mobile.png`) — table stacks above the details card,
"Export" survives without "More filters"; row-click and Edit-appointment flows
tested end-to-end in the browser, not just visually.

## Iteration 10 — user bug report: default appointment was stale, not "today"

Panel was defaulting to a 13 Aug appointment marked `in_service` even though
"today" (per the system clock, confirmed via `new Date()`) is 15 Aug — the
`defaultAppointment` logic scanned *all* loaded appointments (the whole "This
week" window) for anything `in_service`, so a demo row that was never marked
completed on an earlier day kept winning regardless of date.

Fixed: scoped the whole default-selection algorithm to `today` specifically
(`toSalonDate(a.starts_at, timezone) === today`) before applying the
in-service → next-upcoming priority. Added the behaviour asked for
explicitly: once today's list has no more upcoming appointments, fall back to
today's *last* appointment (`.sort(byStartsAt).at(-1)`) instead of drifting to
nothing or to a different day. Label now has three states instead of two:
"Currently in service", "Today's next appointment" (starts_at still ahead of
now), or "Today's last appointment" (today's list exhausted).

Verified live: real system date is 15 Aug 2026 (`new Date()` in-browser), panel
now shows a 15 Aug appointment labelled "Today's next appointment" — the 13th's
stale in-service row no longer wins. Checked light + dark
(`appointment-default-fix.png`, `appointment-default-fix-dark.png`). Did not
mock the system clock to exercise the "no more upcoming today" branch — logic
mirrors the same shape already proven working for the in-service/upcoming
branches, but flagging that the exhausted-day fallback specifically wasn't
clock-simulated. Build clean.

## Iteration 11 — user request: panel polish, pagination placement, button consolidation, global border/shadow restyle

Five asks in one message:

1. **"Remove the scroll"** on Appointment details — removed `lg:overflow-y-auto`
   from the Appointments page's `aside`. Safe because the content shrank
   enough (see #4) to fit its `h-full` box with room to spare — verified via
   `scrollHeight === clientHeight` on the card (686 = 686), not just visually.
2. **"Move pagination to the card that uses it"** — `Pagination` had been
   pulled *out* to a separate block below the row (iteration 8, to fix a
   height mismatch). Reversed that: `AppointmentsTable` now takes
   `page`/`pageSize`/`totalItems`/`onPageChange` directly and renders
   `Pagination` as its own footer, inside the same bordered box, below a
   `flex-1 overflow-auto` wrapper around the `<table>` — rows scroll, the
   card border and the pagination footer don't. `AppointmentsPage` no longer
   renders `Pagination` itself.
3. **"Confirmed button under the name, make Name readable"** — in
   `AppointmentDetailPanel.tsx` (shared with Calendar): header changed from
   name+badge on one row (name truncating to make room) to stacked —
   `StatusChip` now sits under the full, un-truncated name.
4. **"Reschedule and Cancel should be moved inside Edit Appointment"** —
   checked first that they're not being lost: `AppointmentCard` (rendered
   inside `AppointmentEditModal`) already has its own "Change time" and
   "Cancel" controls, wired independently of the panel's shortcuts. Removed
   the panel's separate Reschedule/Cancel buttons, the `RESCHEDULABLE`/
   `CANCELLABLE` sets, the `confirmingCancel` state and `ConfirmDialog`, and
   the `onMove`/`onStatusChange` props entirely — "Edit appointment" is now
   the panel's only button. Cleaned up both call sites (Calendar and
   Appointments): removed the now-pointless `moving`/`setMoving` page state
   and `initialMoving` wiring, since nothing sets it `true` anymore (the
   modal's own internal "Change time" step doesn't depend on it — confirmed
   by reading `AppointmentEditModal.tsx`, which keeps its own local `moving`
   state separate from the page's). Verified live: "Edit appointment" opens
   the modal with "Change time" and "Cancel" both present and working.
5. **"border-radius: 1px", "border-style: solid", drop `.shadow-card` if
   unprofessional"** — this is the second near-identical ask; taken literally
   this time rather than substituted for a "reasonable" value. Global design
   token (`--radius` in `src/index.css`), so it's an app-wide change, not
   scoped to this page — flagged and re-verified Dashboard and Calendar
   render correctly after, since both were previously signed off:
   - `--radius: 0.75rem` → `1px`. The scale is derived (`sm`/`md` subtract
     from base, `xl`/`2xl` add), so `sm`/`md` clamp to 0 (negative radius is
     invalid CSS) and read as square; `rounded-xl` — what `Card` and the
     table box actually use — comes out to 5px, a small, deliberate curve.
     `border-style: solid` needed no change — Tailwind's preflight already
     sets it as the base default for every bordered element.
   - Removed `shadow-card` from the shared `Card` component only (flat,
     border-only now) — did *not* touch the other seven files that use
     `shadow-card` directly (`ConfirmDialog`, `DatePicker`, `Toast`,
     `QuickActionLauncher`, `AppointmentRowMenu`, `CalendarCapacityTabs`,
     `BookPage`). Those are floating/overlay surfaces (dialogs, dropdowns,
     toasts) where a shadow signals elevation above other content — a
     different design justification than a static page card, and not what
     "cards look unprofessional" was about.
   - Updated `docs/DESIGN.md` §5 to match (radius scale figures, elevation
     rule now "flat cards, shadow only on things that float").

Verified: build clean; light + dark Appointments
(`appointment-restyle-1.png`, `appointment-restyle-dark.png`) — both cards
230–918, `scrollHeight === clientHeight` on all three boxes (table, details,
aside); Dashboard and Calendar re-checked after the global token change
(`dashboard-restyle-check.png`, `calendar-restyle-check.png`) — both still
render correctly, Calendar still fits one screen, and its own detail panel
picked up the same name/badge stacking + single-button footer as a side
effect of the shared component (not separately requested for Calendar, but
correct given it's the same component, not a duplicate); mobile
(`appointment-restyle-mobile.png`) — pagination inside the table card,
details card readable, no regressions. Row-click → Edit appointment → Change
time/Cancel flow smoke-tested live in the browser.

## Stop

Converged after 11 iterations: one shared-shell change (sidebar), one
feature-level change (Filters → Appointment Details), and one global
design-token change (radius/shadow), all requested directly by the user.
