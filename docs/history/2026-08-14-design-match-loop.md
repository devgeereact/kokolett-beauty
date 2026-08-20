# Design-match loop — the per-screen owner-console rebuild

**Archived 2026-08-20.** This is the record of a completed piece of work, not a plan.
Every screen below was matched against an owner-supplied mockup and shipped; the loop
prompt that drove it, and the fourteen per-screen logs it produced, are merged here.

The reference PNGs (`docs/design/dashboard.png`, `calendar.png`, …) and the ~187
iteration screenshots under `docs/design/.loop/` were working artefacts and have been
deleted — they were never tracked in git, so nothing here can be re-rendered from the
repo. What survives is the reasoning: what was changed on each screen, and why.

`AppointmentTypePage.tsx` was deliberately outside the loop — it has no reference
mockup and no nav row of its own (reached only through `CalendarCapacityTabs`).

## Screens

| Screen                                        | Component                                    | Route                            |
| --------------------------------------------- | -------------------------------------------- | -------------------------------- |
| [dashboard](#dashboard)                       | `TodayPage.tsx`                              | `/dashboard`                     |
| [calendar](#calendar)                         | `CalendarPage.tsx`                           | `/dashboard/calendar`            |
| [appointment](#appointment)                   | `AppointmentsPage.tsx`                       | `/dashboard/appointments`        |
| [approval](#approval)                         | `InboxPage.tsx (tab=approvals)`              | `/dashboard/inbox?tab=approvals` |
| [availability-request](#availability-request) | `InboxPage.tsx (tab=requests)`               | `/dashboard/inbox?tab=requests`  |
| [customer](#customer)                         | `CustomersPage.tsx`                          | `/dashboard/customers`           |
| [service](#service)                           | `ServiceMenuPage.tsx`                        | `/dashboard/services`            |
| [availability](#availability)                 | `WeeklyDefaultPage.tsx`                      | `/dashboard/weekly`              |
| [reports](#reports)                           | `ReportsPage.tsx`                            | `/dashboard/reports`             |
| [assistant](#assistant)                       | `AssistantPage.tsx`                          | `/dashboard/assistant`           |
| [notification](#notification)                 | `NotificationsPage.tsx`                      | `/dashboard/notifications`       |
| [email](#email)                               | `EmailPage.tsx`                              | `/dashboard/email`               |
| [templates](#templates)                       | `TemplatesPage.tsx + TemplateEditorPage.tsx` | `/dashboard/templates`           |
| [settings](#settings)                         | `SettingsPage.tsx`                           | `/dashboard/settings`            |

---

<a id="dashboard"></a>

## dashboard — `TodayPage.tsx`

Ref: `docs/design/dashboard.png`. Route: `/dashboard`.

#### Baseline

`TodayPage.tsx` was already substantially built (schedule, next up, glance grid,
approvals queue, bookings chart, availability requests, recent activity, assistant
insights row) — this loop is refinement, not a from-scratch build.

#### Iteration 1 (light, desktop, 1536×1024)

Screenshot: `dashboard-1.png`.

Diffs found vs ref:

1. **"New booking" button had no leading `+` icon** — ref shows `+ New booking ⌄`.
   Fixed: added a `Plus` icon (`lucide-react`, `h-4 w-4`) before the label in
   `TodayPage.tsx`. Did **not** add the trailing chevron/dropdown — ref implies a
   split-button with variant options that don't exist as a spec'd feature; inventing
   dropdown behaviour would violate "don't invent a different layout." Logged as
   inferred/skipped.
2. **Sidebar/top-bar chrome is flat-dark in ref, grouped-light in the shipped app.**
   Out of scope — `docs/design/build-loop.md` and recent commits
   (`feat(dashboard): rebuild sidebar nav onto the grouped Owner Console IA`)
   establish the shell as already shipped and deliberately superseding this static
   mockup. Not touched.
3. **Top bar has a clock / "Live" connection indicator / Refresh button** that ref's
   static mockup doesn't show. These are real `TodayPage`-owned functionality
   (realtime connection status, manual refresh), not decorative — kept, not removed.
4. **"Today's schedule" header action is a plain text link ("View calendar"), ref
   shows it as a bordered button.** Already a documented, deliberate prior decision
   (see inline comment in `TodayPage.tsx`: bordered button "sat heavier than its
   siblings and squeezed the title onto two lines"). Left as-is — reverting would
   undo an intentional consistency fix for a cosmetic ref mismatch.
5. **Avatars are tinted silhouette placeholders, not photos.** Also documented and
   intentional (`Avatar.tsx`: "No customer photo exists anywhere in the schema...
   without fabricating anyone's likeness"). Left as-is.
6. **"Next up" card's client-notes callout (⭐ box) never renders** in the current
   demo data — the component (`NextUpCard.tsx`) already conditionally renders it
   from `appointment.customer_note`, matching ref exactly when that field is set.
   The two demo appointments picked as "next up" today simply have no
   `customer_note`. This is a data gap, not a code defect — did not touch the live
   Supabase demo data to force it (out of scope: seeding/editing live rows is a
   separate, higher-blast-radius action from a per-screen visual-match pass).

Inferred values used: none new — button icon sized to existing `Button` icon-gap
convention (`gap-2` from the shared component), not a fabricated token.

#### Iteration 2 (light, desktop) — verify fix

Screenshot: `dashboard-2.png`. Build clean (`npm run build`). Plus icon renders
correctly; button now matches ref's weight/shape. No new diffs found — layout,
spacing, card grid (schedule spans 2 rows col 1 · next-up/glance row 1 col 2-3 ·
bookings-overview row 2 col 2-3 · approvals/requests/notifications stacked col 4),
typography (sans throughout per `docs/DESIGN.md` §4 "dashboard leans utilitarian",
correcting my own initial misread of serif in the stat numbers), status colours,
radii, shadows, and icon set all resolve to existing tokens already.

Light/desktop: **converged after iteration 2.**

#### Iteration 3 — user-reported bug (light + dark, desktop)

User flagged unusual dead space at the bottom of "Today's schedule" and "Bookings
overview". Measured via `browse js` bounding rects rather than guessing:

- **Today's schedule**: the `Card` was `flex h-full flex-col` inside a grid with
  `lg:items-stretch`, forced to stretch across both grid rows (`lg:row-span-2`) to
  match the taller neighbouring column. `ScheduleTimeline` itself is deliberately
  fixed-height ("does not stretch to match a neighbouring card" — its own comment).
  Stretching the _card_ while the _timeline_ refused to stretch left ~240px of blank
  space trailing after the "3 appointments / View full day" footer.
- **Bookings overview**: same root cause. The chart's `flex-1 justify-center` wrapper
  was centering correctly (measured: 137px equal padding top and bottom) — not a bug
  in that component — but the card was stretched to match the tall Availability
  requests + Recent activity stack beside it, so a small fixed 160px chart sat in a
  ~434px pocket, reading as wasted space even though it was technically centered.

Fix: both grid items now use `lg:self-start` instead of `h-full`/stretch — same grid
placement (columns/rows unchanged), but sized to their own content instead of the
row track's height. Removed the now-dead `h-full` from `BookingsOverviewChart`'s
`Card` and the `flex-1 justify-center` wrapper around its chart (no longer needed
once the card stops stretching). Comments updated to match.

Screenshots: `dashboard-3.png` (light), `dashboard-dark-2.png` (dark). Both cards now
end right after their content — no dead space. Mobile unaffected (single-column
stack was never stretched). Build clean.

#### Iteration 4 — user request: remove Recent notifications, align all cards

Removed `RecentActivityCard` ("Recent notifications") from the dashboard entirely —
deleted `src/components/dashboard/today/RecentActivityCard.tsx` (only consumer was
this page) and its usage/import in `TodayPage.tsx`. The header bell badge count
(`getRecentActivity` call for `recentNotificationCount`) is independent and stays.

That removal collapsed col4/row2 from a 2-card stack down to a single
`AvailabilityRequestsCard` (added a `className` prop to it, matching the pattern
already used by `ApprovalsQueueCard`/`GlanceGrid`/`NextUpCard`).

With the stack gone, re-measured (`browse js` bounding rects) instead of guessing:
row2's tallest natural card is now `Availability requests` at 347px vs `Bookings
overview`'s 330px — only 17px apart (previously the 2-card stack made this ~250px+).
`Today's schedule`'s own natural content height (769px) turned out to already equal
row1 (406) + gap (16) + row2 (347) exactly — the fixed-hour timeline for today's real
opening hours (08:00–17:00) coincidentally sums to the same figure.

Given the gap is now small either way, switched back from the iteration-3 `self-start`
fix to real grid stretch (`h-full` on the schedule Card and the Bookings-overview
wrapper, `flex-1 justify-center` restored around the chart) — CSS grid now guarantees
exact alignment rather than relying on matching content coincidentally, and the
stretch is small enough (≤17px) to be invisible rather than the old multi-hundred-px
dead zone. Verified via bounding rects: all of schedule/bookings/availreq bottom at
y=880, nextUp/glance/approvals bottom at y=517, col4 right edge at x=1512 — everything
lines up.

Screenshots: `dashboard-4.png` (light desktop), `dashboard-dark-3.png` (dark desktop),
`dashboard-mobile-light-2.png` (mobile, unaffected — single column). Build clean.

---

<a id="calendar"></a>

## calendar — `CalendarPage.tsx`

Ref: `docs/design/calendar.png`. Route: `/dashboard/calendar`.

#### Baseline

Already substantially built: Day/Week/Month/Agenda views, drag-to-reschedule,
appointment detail rail, mini month calendar, filters card, status legend, AI
advisory panels (Schedule conflicts, Reschedule suggestions). Refinement, not a
from-scratch build.

#### Iteration 1 (light, desktop, 1536×1024)

Screenshot: `calendar-1.png` / `calendar-1-rail-scrolled.png` (right rail scrolls
internally past the viewport — confirmed `Filters` card renders correctly, just
below the fold at this data state).

Diffs found and fixed:

1. **Active view tab (Week) used a neutral white/shadow pill** (`CalendarShell.tsx`)
   instead of ref's tinted-orange active state. Changed to `bg-tint-primary
text-primary`.
2. **Name + status badge wrapped onto two lines** in `AppointmentDetailPanel.tsx`
   instead of sitting on one row with the name truncating — the `<p>` lacked
   `min-w-0 flex-1` inside its `flex justify-between` row, so the browser refused
   to shrink it below intrinsic content width. Added `min-w-0 flex-1`, matching
   ref's "name truncates, badge pinned right" layout.
3. **"Time" column header was `sr-only`** (screen-reader only) — ref shows a
   visible "Time / GMT+1" label. Added a `gmtOffsetLabel()` helper to
   `src/lib/format.ts` (reuses the existing private `zoneOffsetMs`, BST-aware) and
   made the header visible in `WeekView.tsx`.

Diffs found and deliberately left alone (log only):

- **Today/prev/next duplicated in ref's page header row**, absent from this app's
  header (`DashboardLayout`'s `actions` slot only holds "New booking"). Already a
  documented decision in `CalendarPage.tsx`: "the header row above only starts a
  booking, so Today/prev/next isn't shown twice." Not touched — shell-level,
  consistent with the Dashboard screen's precedent of treating header chrome as
  out of scope.
- **"More actions ⋯" button** in ref's detail panel has no equivalent here.
  Documented reason in `AppointmentDetailPanel.tsx`: "Edit appointment" already
  opens the full `AppointmentCard` (status actions, note, payment, follow-up) —
  adding a second "more actions" entry point with no defined menu would be
  inventing UI the ref doesn't specify. Not added.
- **"Show waitlist" checkbox** next to "View settings" in ref's footer — no
  waitlist concept exists anywhere in this app's schema or booking policy
  (`docs/SCHEMA.md`/`docs/planning` describe first-come-first-served booking, not
  a waitlist). No feature to build against; not fabricated.
- **Ref number shown as "Ref: KBUK-…"** (text label) vs this app's `# KB-WJ74GC`
  (hash icon + mono reference). Equivalent meaning, pre-existing pattern, not
  changed.
- **Status filter is an always-expanded checkbox list**, ref shows a collapsed
  "All status (6) ⌄" dropdown, and ref has an "All staff (you) ⌄" dropdown with
  no equivalent here. Single-owner salon (`CLAUDE.md`) means a staff filter has
  exactly one option — not worth building a dropdown for. The status
  checkbox-list is a pre-existing, already-functional interaction pattern;
  redesigning it into a collapsed dropdown is a UI-pattern change beyond a
  visual-match pass, not attempted.

Build clean. Screenshot after fixes: `calendar-2.png`, `calendar-3.png`.

#### Dark theme (desktop)

Screenshot: `calendar-dark-1.png`. Clean — tokens resolve correctly, all status
tints and the active-tab tint fix read fine on the dark surface. No changes needed.

#### Mobile (390×844, light + dark)

Screenshots: `calendar-mobile-light-1.png`, `calendar-mobile-dark-1.png`.

**Known issue, not fixed here:** Week view's 7-day grid squeezes into the 390px
viewport — each day column shrinks to ~48px, appointment blocks show only a
truncated time ("09", "11") with no name. This is pre-existing table behaviour
(`WeekView.tsx`'s `<table className="w-full">`), not something introduced this
pass, and `calendar.png` has no mobile reference to match against. A proper fix
(horizontal scroll with a per-column min-width, or defaulting to Day view on
mobile) touches the same table that drives drag-to-reschedule's pixel-position
math — real behavioural risk, not a safe drive-by CSS tweak inside a pixel-match
loop. Flagging for a dedicated follow-up rather than patching blind. Day view
(untouched, not in this ref) is the likely intended mobile path already.

#### Iteration 4 — user request: remove extra content, fit to one screen

Ref (`calendar.png`) has nothing below the legend row. This build had two extra
AI-advisory cards below the calendar — "Schedule conflicts"
(`ConflictDetectionPanel`) and "Reschedule suggestions" (`RescheduleSuggestionsPanel`)
— not present in the reference at all, pushing the page well past one viewport.

Removed both from `CalendarPage.tsx` (usage + imports) and deleted the two
component files (`ConflictDetectionPanel.tsx`, `RescheduleSuggestionsPanel.tsx`) —
only consumer was this page. Kept `AdvisorySection` (the wrapper) and
`assistantService`'s `getScheduleConflicts`/`suggestOpenSlots` — both used
elsewhere (`AssistantPage.tsx` and other dashboard pages).

Verified: `document.documentElement.scrollHeight === window.innerHeight` (1024 = 1024) at 1536×1024 — the page now fits one screen exactly, no scroll, matching
the reference's own single-screen layout. Screenshot: `calendar-4.png`. Build
clean.

Mobile (390×844) still scrolls (2296px content) — expected and out of scope here:
ref has no mobile variant, and stacking this much real content vertically on a
narrow phone viewport is normal, not "extra" content to cut.

#### Stop

Converged after 4 iterations on desktop light/dark. Mobile has the one flagged,
deliberately-unfixed Week-view-cramped issue from iteration 3.

---

<a id="appointment"></a>

## appointment — `AppointmentsPage.tsx`

Ref: `docs/design/appointment.png`. Route: `/dashboard/appointments`.

#### Baseline

Already substantially built: tabs (All/Upcoming/Today/In service/Completed/
Cancelled-No-show) with counts, search + date/service toolbar, full table (Time/
Client/Service/Staff/Status/Reference/Actions), right-rail Filters card, pagination.
Refinement, not a from-scratch build.

#### Iteration 1 (light, desktop, 1536×1024)

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

#### Dark theme (desktop)

Screenshot: `appointment-dark-1.png`. Clean — table, tabs, filter rail, status
pills all resolve correctly on the dark surface. No changes needed.

#### Mobile (390×844, light)

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

#### Iteration 3 — user request: fit to screen, no dead space at bottom

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

#### Iteration 4 — user request: remove remaining bottom space; static, non-scrolling sidebar

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

#### Iteration 5 — user correction: static full screen, exact alignment (not natural scroll)

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

#### Iteration 6 — user correction: the gap was to the window bottom, not between columns

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
did — which is _why_ iterations 1–4 could never visually close this gap no
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

#### Iteration 7 — user request: match the table card to the (now-good) Filters card

Filters card confirmed good. The table still looked unfinished next to it: its
scroll was applied from _outside_ (`min-h-0 flex-1 lg:overflow-y-auto` wrapping
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

#### Iteration 8 — user correction: pagination shouldn't share the card's height budget

Clarified: they didn't want Pagination folded into the table column's height
(which is why the table card was 64px shorter than Filters — it was reserving
room for Pagination beneath it inside the same flex column). They want the
table _card_ to match Filters exactly, and Pagination to live below the whole
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

#### Iteration 9 — user request: replace Filters rail with Appointment Details, default to next appointment, drop the view popup

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

#### Iteration 10 — user bug report: default appointment was stale, not "today"

Panel was defaulting to a 13 Aug appointment marked `in_service` even though
"today" (per the system clock, confirmed via `new Date()`) is 15 Aug — the
`defaultAppointment` logic scanned _all_ loaded appointments (the whole "This
week" window) for anything `in_service`, so a demo row that was never marked
completed on an earlier day kept winning regardless of date.

Fixed: scoped the whole default-selection algorithm to `today` specifically
(`toSalonDate(a.starts_at, timezone) === today`) before applying the
in-service → next-upcoming priority. Added the behaviour asked for
explicitly: once today's list has no more upcoming appointments, fall back to
today's _last_ appointment (`.sort(byStartsAt).at(-1)`) instead of drifting to
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

#### Iteration 11 — user request: panel polish, pagination placement, button consolidation, global border/shadow restyle

Five asks in one message:

1. **"Remove the scroll"** on Appointment details — removed `lg:overflow-y-auto`
   from the Appointments page's `aside`. Safe because the content shrank
   enough (see #4) to fit its `h-full` box with room to spare — verified via
   `scrollHeight === clientHeight` on the card (686 = 686), not just visually.
2. **"Move pagination to the card that uses it"** — `Pagination` had been
   pulled _out_ to a separate block below the row (iteration 8, to fix a
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
     border-only now) — did _not_ touch the other seven files that use
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

#### Stop

Converged after 11 iterations: one shared-shell change (sidebar), one
feature-level change (Filters → Appointment Details), and one global
design-token change (radius/shadow), all requested directly by the user.

---

<a id="approval"></a>

## approval — `InboxPage.tsx (tab=approvals)`

Target: `InboxPage.tsx` (`tab=approvals`), route `/dashboard/inbox?tab=approvals`.
Ref: `docs/design/approval.png`.

Components already existed (`ApprovalCard`, `ApprovalDetailPanel`,
`ApprovalStats`, `ApprovalPolicyFooter`, `demoApprovals.ts`) — this loop found
and closed the remaining gaps rather than building from scratch.

**Shell divergence, not fixed (per the loop brief: shell already shipped).**
The reference's sidebar (flat list, dark charcoal, profile card, salon footer
card, theme toggle) and top bar (contextual search placeholder, no Refresh
button, notification badge) reflect the _old_ pre-rebuild mockup. The shipped
`DashboardLayout` (grouped nav sections, global ⌘K command palette with a
fixed "Search anything…" placeholder, Refresh button, bell badge wired only
on Today) is deliberately different and consistent across every already-built
screen (Dashboard, Calendar, Appointments). Not re-litigated here.

#### Iteration 1 — baseline screenshot

Loaded the live page. Structure already close: stats row, amber policy
banner, demo-data notice, card list + detail panel, policy footer + "need a
different time" card all present and reading correctly.

Real gaps found (page content, not shell):

- `ApprovalCard` was missing the "Requested {date}" line the reference shows
  as a 4th line under the customer's phone number.
- The date/time block had no calendar/clock icons — reference pairs each
  line with one, and `ApprovalDetailPanel`'s own booking-details block
  already established that icon pairing for this exact data (Calendar/Clock
  from `lucide-react`), so reusing it was the design-system move rather than
  inventing new iconography.
- Header actions had `Refresh` but no `+ New booking` — every other content
  page (Today, Appointments, Calendar) carries this button via a shared
  `NewBookingPanel` in a `Modal`; Approvals had never been wired up to it.

#### Iteration 2 — fixed the three gaps above

- `ApprovalCard.tsx`: added `Requested {formatDateTime(row.created_at,
timezone)}` (reusing the exact helper + phrasing already used by
  `ApprovalDetailPanel` and `RequestDetailPanel`'s own "Requested:" lines —
  not the reference's literal "22 May 2025 at 09:40" wording, which isn't
  this app's date format anywhere else). Added `Calendar`/`Clock` icons
  (14px, muted) before the date and time lines.
- `InboxPage.tsx`: added `booking` state + a `New booking` button + `Modal`
  wrapping `NewBookingPanel`, matching the exact pattern in `AppointmentsPage`
  / `TodayPage` / `CalendarPage`. `onBooked` just closes the modal and calls
  the existing `refreshActive()` — no prefill, no post-booking banner (this
  page isn't a search-filterable list like Appointments, so there's nothing
  useful to prefill/highlight afterwards).
- Build clean (`tsc --noEmit && vite build`).

Verified via screenshot: all three present and reading correctly.

#### Iteration 3 — stat tile icon

Sampled the 4th stat tile ("This week"): reference uses a download-tray glyph
(arrow into a tray), current used `Inbox` (envelope). Swapped to `Download`
from `lucide-react`. Left the tile's **tone** as `neutral` (grey) rather than
matching the reference's reddish icon colour — this app's `Tone` system
(`src/lib/tone.ts`) reserves red/`urgent` for cancelled/no-show status
semantics; recolouring a plain historical count red would contradict that
convention elsewhere (Dashboard, Appointments), so treating the reference's
red as a decorative, non-semantic choice and keeping grey. Logged as a
deliberate inferred deviation.

Sampled badge/countdown-chip/button colours (`(253,230,208)` vs `(249,235,218)`
for the pending tint, `(211,75,46)` vs `(224,93,56)` for primary) — within
JPEG/sampling-point noise of the same shared tokens already verified correct
on Dashboard/Calendar/Appointments; not re-tuned per-screen.

Build clean. Screenshot confirms icon swap, structure otherwise unchanged
from iteration 2.

#### Iteration 4 — dark theme + mobile breakpoint pass

No reference image exists for dark mode or mobile (`approval.png` is
light/desktop only), so these were judged against the design-system tokens
and the pattern already established on Dashboard/Calendar/Appointments,
rather than a pixel target.

- Dark desktop (`approval-dark-1.png`): all tints, borders, and text contrast
  correctly via the shared token set — no page-specific dark-mode overrides
  needed.
- Mobile light/dark (`approval-mobile-light-1.png`,
  `approval-mobile-dark-1.png`, 390×844): cards and the detail panel stack
  correctly full-width, the `Approvals`/`Requests` pill switcher (hidden on
  desktop, where the sidebar already carries both rows) appears as designed,
  no overflow or clipped buttons. The subtitle truncates with an ellipsis at
  this width — confirmed that's `DashboardLayout`'s shared `truncate` class
  on every page's subtitle, not specific to this screen.

Build clean on every iteration.

#### Stop

Converged after 4 iterations. Nothing left that's fixable from code:

- Reference customer photos aren't fixable — `Avatar` deliberately renders a
  tinted initials/silhouette tile everywhere in the app (no customer-photo
  field exists in the schema; see the comment in `Avatar.tsx`), not
  something to special-case for this one screen.
- The reference's dark-charcoal flat sidebar and the top bar's
  contextual-search/badge/no-Refresh chrome are the pre-rebuild mockup; the
  shipped grouped-nav shell (`docs/history/2026-08-14-owner-console-rebuild-plan.md`)
  superseded it before this loop started, and every other completed screen
  in this loop already carries the new shell — not re-litigated per-screen.

Inferred/deliberate values (not read directly off the reference):

- "Requested {date}" line reuses the app's existing `formatDateTime` output
  and phrasing (already used twice elsewhere) instead of the reference's
  one-off "22 May 2025 at 09:40" format.
- "This week" stat tile keeps `tone="neutral"` (grey) rather than matching
  the reference's reddish icon — red is reserved for cancelled/urgent
  semantics elsewhere in `lib/tone.ts`; only the icon glyph (`Download`) was
  matched, not the colour.

---

<a id="availability-request"></a>

## availability-request — `InboxPage.tsx (tab=requests)`

Target: `InboxPage.tsx` (`tab=requests`) → `RequestsQueue.tsx` +
`RequestRow.tsx` + `RequestDetailPanel.tsx`. Route
`/dashboard/inbox?tab=requests`. Ref: `docs/design/availability-request.png`.

Unlike Approvals, this component's own docstring already says it was
"rebuilt onto `docs/design/availability-request.png`" — tabs with counts,
filter toolbar (search/date/service/priority/more filters), row list +
decision panel, suggested slots, custom-offer/decline actions, internal
notes all pre-existed and matched structurally on the first screenshot. This
loop found and closed the real remaining gaps rather than building from
scratch.

#### Iteration 1 — baseline screenshot, real data

Loaded live (real DB rows, not demo fallback — `[DEMO]` seed customers).
Structure matched closely. Two real gaps found:

1. **Suggested slots defaulted to nothing selected.** Reference shows the
   top suggestion pre-selected (red border, solid enabled "Offer this slot"
   button) — one click to accept the obvious case. Current code required an
   explicit click first; `selectedSlot` started `null`, so the primary
   button rendered disabled/pale on every fresh selection.
2. **Converted/declined rows showed stale data.** `RequestRow`'s date/time
   column always rendered the original `preferred_dates` + `flexibility`,
   regardless of status. For a `converted` row the reference instead shows
   what actually happened — "Offered {when}" / "Booked {when}" — and for
   `declined` it shows "Requested {when}" only. Current build showed
   "preferred dates" on resolved rows either way, which reads as if the
   request is still open.

#### Iteration 2 — fixed gap #1

`RequestDetailPanel.tsx`: `setSelectedSlot((prev) => prev ?? found[0] ?? null)`
after slots load — pre-selects the top suggestion without ever overwriting a
selection the owner already made (guards on `prev ?? …`, so "View more
slots" re-fetching with a higher limit can't yank the selection away).

Build clean. Verified: first slot now shows the red selected border and
"Offer this slot" renders solid/enabled by default, matching the reference.

#### Iteration 3 — fixed gap #2 (data + component)

Gap #2 needed real data that wasn't being fetched, not just a template
change. Checked `supabase/migrations/0002_salon.sql`:
`availability_requests` has `responded_at` (set when the owner answers) and
`converted_appointment_id` (FK → `appointments.id`) — both already existed,
just weren't selected.

- `requestService.ts`: added `responded_at` and an `appointments(starts_at)`
  embed to `REQUEST_COLUMNS` (the FK is 1:1 and unambiguous — no other FK
  from `availability_requests` to `appointments` — so the embed resolves
  without needing an explicit constraint name). Extended `QueuedRequest`
  with `responded_at` and `converted_starts_at`.
- `RequestRow.tsx`: the date/time column now branches on lane — open rows
  keep "Preferred {dates}" / "{flexibility}"; `converted` rows show
  "Offered {responded_at}" then "Booked {converted_starts_at}" (new
  `CalendarCheck` icon in the `completed` tone, matching the reference's
  green check-calendar glyph); `declined`/`expired` rows show "Requested
  {created_at}" only.

Verified live against the real DB (not demo data) — the `appointments()`
embed resolved with no PostgREST/RLS errors, converted rows now show real
offered/booked timestamps pulled from the actual resulting appointment.

#### Iteration 4 — label styling pass

First pass used a small-caps uppercase caption style for "Offered"/"Booked"/
"Requested". Sampled the reference crop directly: those labels are normal
case, medium weight, same size as the date value — closer to the row's
"Preferred" style than a caption. Rewrote all three lane variants
(`Preferred`/`Offered`+`Booked`/`Requested`) to the same pattern: icon +
medium-weight label on its own line, value indented below in muted text —
consistent across every lane now, including the open-lane block, which
previously combined icon+value on one line with no label at all.

Build clean. Screenshot confirms all three lane styles read correctly and
consistently.

#### Iteration 5 — dark theme + mobile breakpoint pass

No reference exists for dark mode or mobile. Judged against tokens and the
pattern from Approvals/Dashboard/Calendar (already converged in this loop).

- Dark desktop: clean, all badge tones (pending/completed/urgent) and the
  new `CalendarCheck`/`completed`-tone icon read correctly against dark
  surfaces.
- Mobile light/dark (390×844): filter toolbar wraps to stacked rows (no
  horizontal scroll — same `flex flex-wrap` pattern as the rest of the app),
  cards and detail panel stack full width, all four lane label styles
  render correctly at narrow width.

Build clean on every iteration.

#### Stop

Converged after 5 iterations. Nothing left that's fixable from code:

- Same shell divergence as Approvals (sidebar/top-bar chrome is the
  pre-rebuild mockup) — not re-litigated.
- Reference customer photos — same `Avatar` placeholder-tile decision as
  every other screen.
- Live data only has 5 requests, 4 already `converted`, 0 `declined` — the
  `declined` row style (verified only in isolation, not against a live
  declined row) is exercised by the same code path as `converted`'s
  "Requested"-only branch, so it's trusted rather than independently
  screenshotted with real data.
- Pagination controls don't render — `Pagination` hides itself under 7
  rows (`PAGE_SIZE`), and live data has 5; correct behaviour, just not
  visually verified against the reference's 2-page state.

Inferred/deliberate values:

- "Offered"/"Booked"/"Requested" timestamps use the app's existing
  `formatDateTime` phrasing, consistent with Approvals' "Requested" line —
  not the reference's literal date format.
- "Booked" uses `TONE_TEXT.completed` (teal, this app's existing "done"
  semantic) rather than picking a new green to match the reference's exact
  hue.

---

<a id="customer"></a>

## customer — `CustomersPage.tsx`

Target: `CustomersPage.tsx`, route `/dashboard/customers`. Ref:
`docs/design/customer.png`.

**Explicit deviation from the reference, requested by the user up front:**
the reference is a table (rows). The owner asked for a card grid instead.
Followed that instruction over the reference — everything else (tokens,
detail panel, header actions) still targets the reference as closely as
possible.

#### Iteration 1 — table → card grid

- New `CustomerCard.tsx`: same fields the old `CustomerTable.tsx` row
  carried (avatar, name + "New" badge, email/mobile, last visit, total
  visits, active/inactive badge, favourite-service badges, "…" menu),
  restyled as a `Card` following the exact pattern already established by
  `ApprovalCard`/`RequestRow` (selected state via `border-primary
ring-1 ring-primary`, hover via `hover:border-foreground/20`) rather than
  inventing a new card shape.
- `CustomersPage.tsx`: swapped the `<CustomerTable>` for a
  `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4` of `CustomerCard`s.
- Deleted `CustomerTable.tsx` — grepped first, confirmed no other importer.

Build clean. Screenshot: 14 real customers render as cards, 3 columns at
desktop width, all data present and correct.

#### Iteration 2 — header action gap

Real gap independent of the cards-vs-table change: `Export` was inline
above the grid, and there was no `New booking` button at all — every other
finished screen (Approvals, Availability requests, Today, Appointments,
Calendar) puts both in `DashboardLayout`'s `actions` (top bar), matching the
reference's top-right `Export` + `+ New booking` placement here too.

- Moved `Export` into `actions`, added `New booking` (same `NewBookingPanel`
  in a `Modal` pattern used everywhere else).
- The existing booking modal only rendered `NewBookingPanel` when a customer
  was `selected` (it was wired for "book a follow-up for this specific
  customer" from the detail panel). Made `prefill` nullable so the header
  button can open a blank booking with no customer context — `onBooked`
  branches: reload that customer's detail if one was selected, otherwise
  just reload the list.

Build clean. Verified live: header `New booking` opens a genuinely blank
form (empty name/email, not stale prefill); clicking a card still opens its
detail modal with working "Book again" → prefilled modal, unchanged.

#### Not implemented — reference features with no backing data

- **"All tags" filter + tag chips** ("Loyal client", "Blonde tones" in the
  reference's detail panel/toolbar): no `tags` column exists on `customers`
  in the schema (`supabase/migrations/0002_salon.sql` — checked directly,
  full column list has no tags/labels field of any kind). Implementing this
  for real needs a migration, which is a data-model decision, not a
  design-match one. Left out rather than fabricating a fake tag list.
- **"All time"/"All services"/"More filters"** toolbar richness: the
  reference's filter row has 5 controls, current build has 2 (search +
  status). Status/date/service filtering is all technically feasible today
  without schema changes, but the user's ask this round was specifically
  "change list to cards" — treated the fuller filter bar as separate scope
  rather than smuggling it in unasked. Flagging here so it's a known gap,
  not a missed one, if the next pass wants it.

#### Iteration 3 — dark theme + mobile breakpoint pass

No reference for dark/mobile. Judged against tokens and the pattern already
converged on Approvals/Availability requests.

- Dark desktop: clean, card borders/badges/tokens all read correctly.
- Mobile light/dark (390×844): grid collapses to a single column, each card
  full width, all content fits with no overflow or clipped buttons.

Build clean on every iteration.

#### Stop (first pass)

Converged after 3 iterations for what was in scope. Outstanding, logged
above rather than guessed at: tags (no schema), and toolbar filter richness
(separate scope from the requested list→cards change).

#### Iteration 4 — follow-up request: move messages into the profile, drop two sections

Owner asked to (1) move "Customer messages" into the customer profile for
easy per-customer replying, (2) remove "Cancellation risk" outright — not
needed for this app, (3) stop showing "Repeat customers" for now but keep
it for a future priority pass.

- `CommunicationAssistancePanel.tsx`: added an optional `customerEmail`
  prop. When set, filters `getRecentMessages()`'s results to that one
  customer (case-insensitive match on `customerEmail`) and auto-selects the
  top message so there's a draft ready immediately — scoped to one person,
  the old "pick a message first" step was pure friction. Empty-state copy
  branches on whether it's scoped ("Nothing from them yet…") vs salon-wide.
- `CustomerDetailPanel.tsx`: added a 4th tab, "Message", rendering
  `<CommunicationAssistancePanel timezone={timezone}
customerEmail={customer.email} />`. Verified live against real data:
  Bianca Chukwu (2 real notes) shows exactly her 2, correctly filtered out
  of the other 12 customers' notes; Funmi Ade (0 notes) shows the scoped
  empty state; both read/act correctly in dark mode too.
- **Cancellation risk — deleted, not hidden**, per "not needed for this
  app": `CancellationForecastingPanel.tsx`, `getCancellationForecast()`
  (`assistantService.ts`), `forecastCancellationRisk()` +
  `CancellationRisk` type (`lib/insights.ts`), and its test suite
  (`insights.test.ts`) are all gone. Also dropped the PRD's mention of it
  (`docs/PRD.md` §AI assistant) so the docs don't describe a feature that no
  longer exists. Checked first that `CancellationRisk`/
  `forecastCancellationRisk` weren't used anywhere outside this cluster —
  they weren't.
- **Repeat customers — kept, just unmounted**, per "noted for someday":
  `RepeatCustomerInsightsPanel.tsx` is untouched on disk. Removed the
  `<AdvisorySection>` that rendered it on this page and left an inline
  comment at the removal site pointing at the file and explaining it's
  deprioritised for a single-owner salon today, not gone — the way back is
  re-adding one `<AdvisorySection>` line, not rebuilding anything.
- Removed the now-empty `AdvisorySection`/`CommunicationAssistancePanel` /
  `RepeatCustomerInsightsPanel` / `CancellationForecastingPanel` imports
  from `CustomersPage.tsx`.

Build clean. Full test suite run (`npx vitest run`) — 154/154 passing,
including the trimmed `insights.test.ts`. Verified live: Customers page now
ends right after the card grid, no trailing advisory sections; a customer's
own Message tab works standalone. Also reconfirmed the login session
(browse daemon had restarted and dropped it mid-session) using the
Keychain-stored owner credential, per [[kokolett-accounts]] — piped inline,
never printed standalone.

#### Iteration 5 — follow-up request: 9 per page, no scroll

Owner asked for 9 cards per page, fit to screen with no scroll (same ask as
Services, different number — 3×3 here vs 4×4 there, since this card
carries more fields).

- Added real pagination — there wasn't any before, `filtered.map()` just
  rendered every match. Added `page`/`PAGE_SIZE=9` state, a `pageCustomers`
  slice, a `<Pagination>` (same component `ServicesCatalogue`/
  `RequestsQueue` already use), and a `useEffect` resetting to page 1 on
  search/status-filter change — otherwise changing a filter could strand
  the view on a now-out-of-range page.
- Compacted `CustomerCard.tsx`: `p-5`→`p-3`, avatar `md`→`sm`, every
  internal gap/margin tightened (`gap-4`→`gap-1.5`, `pt-3`→`pt-1.5`, etc).
- **Capped the favourite-services row to one line unconditionally**
  (`flex-wrap`→`flex-nowrap overflow-hidden`, `shrink-0` on each badge,
  slice 3→2 before the "+N" badge). This one isn't just cosmetic: with
  `flex-wrap` a customer with 3 favourite services could wrap that row to 2
  lines, and since CSS grid sizes each row to its tallest cell, one such
  customer landing in the visible 9 would blow the fit budget for the whole
  row of cards — capped it so the card height is that same regardless of
  data instead of being a happy accident of the current 14 demo rows never
  triggering the wrap.
- Tightened the toolbar: `mb-4`→`mb-2` on the count line, `mb-6`→`mb-3` on
  the search/filter row.

Measured `document.body.scrollHeight` vs `window.innerHeight` at 1440 wide,
same method as Services:

| height | fit?                |
| ------ | ------------------- |
| 1024px | yes                 |
| 900px  | yes (900/900 exact) |
| 800px  | 836/800 (36px over) |

Stopped at 900px as the practical baseline rather than chasing 800px like
Services did — this card carries meaningfully more content (2 contact
lines, a stats row, a favourites row vs Services' 2 lines total), and
compacting further started to feel cramped. 900px covers real laptop/
desktop use; 800px is an unusually short viewport.

Build clean. Full test suite: 154/154 passing. Verified live: pagination
count text ("Showing 1 to 9 of 14 customers"), page 2 navigation, and both
themes all correct.

#### Stop

---

<a id="service"></a>

## service — `ServiceMenuPage.tsx`

Target: `ServiceMenuPage.tsx` → `ServicesCatalogue.tsx`, route
`/dashboard/services`. Ref: `docs/design/service.png`.

Owner asked for this screen to be "rebranded" the same way Customers was —
cards, not the reference's table. Unlike Customers, this was **already**
built as a card grid (its own docstring even predates this request) —
someone had already made the same call here. This loop verified that and
closed the real remaining gaps rather than redoing a conversion that was
already done.

#### Iteration 1 — baseline screenshot

Loaded live: 49 real seeded services (6 real categories from migration
0018: Braids, Twists and locs, Weaves/wigs/extensions, Natural hair and
styling, Colour, Treatments — matches the reference's "Categories 6" count
exactly, just different category names since this is a real African hair
salon's menu, not the reference's generic one), card grid, tabs
(All/Active/Archived), pagination. Structure already close.

Real gaps found:

1. **"Add new service" was inline in the content**, not the header actions
   bar — every other finished screen (Approvals, Availability requests,
   Customers, Today, Appointments, Calendar) puts its primary action there,
   matching the reference's top-right placement here too.
2. **Every category badge used the same fixed `tone="cancelled"`** (a
   red/pink tint) regardless of which of the 6 real categories a service
   belonged to. The reference colour-codes categories distinctly; this
   build had one static colour for all of them — and `cancelled` is a
   confusing choice to reuse for something that isn't a cancelled-anything.
3. **No path for a real service photo to render**, even though it's
   fully wired everywhere else: `service_menu.image_path` (migration
   0031), the edit form's own "Image path" field, and `buildImageKitUrl()`
   in `lib/imagekit.ts` all exist — but nothing ever read `image_path` to
   render an `<img>`. Confirmed via the seed migration that every one of
   the 49 real rows has `image_path = null` today (never wired anywhere,
   including the public site's own "What we do" section), so this wasn't
   visibly broken — just dead plumbing that would silently do nothing the
   day someone actually uploads a photo through that same form field.

#### Iteration 2 — fixed all three

- `ServicesCatalogue.tsx` → `ServiceMenuPage.tsx`: forwarded a ref
  (`ServicesCatalogueHandle.openNew`), same `useImperativeHandle` pattern
  already used by `RequestsQueueHandle`. `ServiceMenuPage` now owns the
  "Add new service" button in `DashboardLayout`'s `actions`, calling
  `catalogueRef.current?.openNew()`. Removed the component's own inline
  button (and the empty-state's own "Add new service" CTA stayed — that's
  a normal empty-state affordance, not a duplicate of the header one).
- Added `toneForCategory()`: a fixed map for the 6 known real categories to
  6 distinct `Tone`s (`primary`/`pending`/`in_service`/`confirmed`/`urgent`/
  `completed`), with a stable hash fallback for a category the owner might
  type fresh later so a 7th one never crashes or defaults to one flat
  colour. Sampled two adjacent badges' pixels to confirm they're genuinely
  distinct hues, not just close in a small screenshot: Braids
  `(240,174,156)` vs Twists and locs `(240,200,153)`.
- Added `ServiceThumb`: renders a real ImageKit-optimised `<img>` when
  `item.image_path` is set, falling back to the same tinted `Avatar`
  placeholder used everywhere else (Customers, Approvals, Requests) when
  not. Used in both the card and the edit modal's header. With all 49 real
  rows still `image_path: null`, this is a no-visible-change fix today —
  verified the fallback still renders correctly — but the day the owner
  fills in a path through the form that's already there, it now actually
  shows.

Build clean. Full test suite: 154/154 passing (no test file existed for
this component specifically; ran the whole suite since the `forwardRef`
refactor touches how the component is called).

#### Not implemented — reference feature with no backing model

The reference's **"Categories" tab + header button** (a dedicated
categories management surface, "6" shown as its own filter lane) was not
built. `group_name` on `service_menu` is a free-text column with no
category table behind it — there IS a `service_categories` table in the
schema, but it belongs to the separate single bookable `services` row
(`category_id` FK), not to `service_menu`'s free-text groups. Building a
real categories CRUD surface would mean either wiring two unrelated data
models together or inventing a new one, which is a data-model decision, not
a design-match one. The existing "pick an existing category or type a new
one" combo in the item form already covers the actual need (grouping/
filtering) without that surface. Logged rather than guessed at, same
reasoning as Customers' tags gap.

#### Iteration 3 — dark theme + mobile breakpoint pass

No reference for dark/mobile. Judged against tokens and the pattern already
converged on Approvals/Availability requests/Customers.

- Dark desktop: clean, all 6 category tones read correctly against dark
  surfaces, header button and card grid unchanged in shape.
- Mobile light/dark (390×844): grid collapses to one column, header actions
  wrap correctly (Add new service full-width, bell beside it), pagination
  and tabs remain usable.

Build clean on every iteration.

#### Iteration 4 — follow-up request: search onto the tab row

Owner asked to move the search bar onto the same line as the
All/Active/Archived tab row, aligned. Restructured the wrapping
`<div>`: the `border-b` moved from the tabs' own div to the shared row
container (`flex justify-between items-center`), tabs left, search right
(`w-64` at `sm:` and up, full-width and dropping below with `mb-3` under
that — same wrap behaviour already used elsewhere for toolbar rows).
Shrunk the input from `h-11` to `h-9` to sit level with the tab row instead
of towering over it. Verified live: search still filters correctly
("cornrow" → just Cornrows), wraps cleanly under the tabs at 390px mobile
width, both themes checked visually.

Build clean.

#### Iteration 5 — follow-up request: 16 per page, no scroll

Owner asked for 16 cards per page, fit to screen with no scroll.

- `PAGE_SIZE` 8 → 16.
- Grid forced to 4 columns from `md:` up (`grid-cols-2 md:grid-cols-4`,
  was `sm:2 lg:3 xl:4`) so 16 always lays out as 4×4, not a ragged 3-wide
  block.
- Compacted the card: `p-4`→`p-2.5`, avatar `md`→`sm` (added an `sm` size
  to `ServiceThumb`/`THUMB_PX`/`THUMB_CLASS`, previously only `md`/`lg`
  existed), tightened every internal margin (`mb-3`→`mb-1.5` etc.), dropped
  the optional description/note line entirely (kept in the edit modal;
  none of the 49 real rows have one set, and a 2-line note would blow the
  row-height budget unpredictably since CSS grid rows size to their
  tallest cell).
- Tightened the tab-row bottom margin `mb-4`→`mb-3`.

Measured `document.body.scrollHeight` vs `window.innerHeight` at three
viewport heights (1440 wide) rather than eyeballing:

| height | before | after                              |
| ------ | ------ | ---------------------------------- |
| 1024px | fit    | fit                                |
| 900px  | —      | fit (900/900)                      |
| 800px  | —      | 802/800 (2px over — imperceptible) |

Screenshotted at 800px to confirm it's not cramped despite the tight
budget — still legible, matches the "not too dense" bar `service-16-fit-800.png`
sets.

Build clean.

#### Stop

Converged after 5 iterations. Nothing left that's fixable from code beyond
what's logged above (categories management surface — separate scope/data
model decision).

---

<a id="availability"></a>

## availability — `WeeklyDefaultPage.tsx`

Target: `WeeklyDefaultPage.tsx`, route `/dashboard/weekly`. Ref:
`docs/design/avalability.png`. Owner also asked upfront for no-scroll,
fit-to-screen.

#### The real gap: reference assumes a richer availability model than this app has

Investigated before touching layout, since the reference is unusually
information-dense (a table with 6 columns, 4 tabs, a closures list) and the
existing page's docstring already explained a deliberate, documented
architecture decision. Confirmed via `docs/SCHEMA.md` and the migrations:

- **Migration 0011 ("slots are the model") deliberately deleted**
  `availability_rules` and `availability_exceptions` — a day is _only_ a flat
  list of published start times (`availability_slots`). There is no
  continuous "opening hours" range, no separate "breaks" entity, and no
  per-day-of-week cap or toggle. `DayPanel.tsx`'s own doc comment: _"blocking
  out an hour is simply not putting it on the list."_
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
- No stored date-_range_ closure entity exists (no "Summer Break: 11–15 Aug"
  row) — closing a run of days means clearing each date individually via
  `DayPanel`.

Given this, matching the reference's literal 6-column table + 4 tabs would
mean fabricating 3 columns of data with no backing store and inventing a
duplicate settings-editing surface. Instead, matched the reference's real
_intent_ — a compact per-day row, a closures list, a rules sidebar — using
only what's genuinely real, same standard as every other screen in this
loop (Customers' tags, Services' categories).

#### What was built

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
  entity, this _derives_ real exceptions — any date in the generator's
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

#### Not implemented — logged, not guessed at

- Per-day-of-week max-bookings column, per-day online-booking toggle,
  editable breaks-as-a-range field, a duplicate "Booking settings" tab, a
  stored date-range closure entity — see the schema reasoning above. All
  would require either fabricating data or a real migration/product
  decision, neither of which is a design-match call.

#### No-scroll fit — measured, not eyeballed

Same method as Services/Customers: `document.body.scrollHeight` vs
`window.innerHeight` at 1536 wide (the layout is `min-h-screen`, so a
reading equal to `innerHeight` only proves "fits or shorter," not "exactly
fits" — cross-checked with screenshots too).

| height | before restyle             | after                  |
| ------ | -------------------------- | ---------------------- |
| 1024px | scrolled (~1090px content) | fits, real headroom    |
| 900px  | —                          | fits exactly (900/900) |
| 800px  | —                          | 878/800 (78px over)    |

Stopped at the 900px baseline — same bar the [customer](#customer) section settled on for
its own content-heavy screen. This page is the densest yet in the loop (a
7-row table + a 4-row closures list + 4 sidebar cards), so 900px is a
reasonable floor rather than chasing 800px and making the table
uncomfortably tight.

Verified interactions post-tightening: day-row expand/collapse, single-day
modal (both entry points), "Show advanced options" reveal — all still
read correctly at the tightened spacing, not just measuring right.

#### Dark theme + mobile breakpoint pass

No reference for either. Judged against tokens and the pattern already
converged on every other screen in this loop.

- Dark desktop: clean, status badges (Open/Closed, Closed all day, Live)
  and the calendar dot colours all read correctly.
- Mobile light/dark (390×844): everything stacks single-column, hours
  range hides at narrow width (existing `hidden sm:inline`, not new),
  scrolling is expected and fine here — the no-scroll ask was about
  desktop fit, not mobile.

Build clean on every iteration. Full test suite: 154/154 passing.

#### Iteration — follow-up request: professional polish pass

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
  _right_ sidebar column (900px), not the _left_ schedule column, was the
  actual height constraint — so the left column's cards (`p-3.5`→`p-4`)
  could regain some breathing room for free, with zero risk to the fit
  budget. Re-verified: still 900/900 exact fit, unchanged from before this
  pass.

Re-measured the full fit table after every change — unchanged from the
previous pass (900px exact, 878/800 at the unusually short baseline),
confirming the polish additions cost nothing toward the no-scroll
requirement. Re-verified dark theme and reran the full test suite:
154/154 passing.

#### Stop

Converged. The screen matches the reference's real intent as closely as
this app's deliberately simpler availability model allows, fits without
scrolling down to 900px viewport height, every number/date shown is real,
and every interactive element now carries the same hover/focus language
already established everywhere else in the app.

---

<a id="reports"></a>

## reports — `ReportsPage.tsx`

Target: `ReportsPage.tsx`, route `/dashboard/reports`. Ref:
`docs/design/reports.png`.

#### Already built

Unlike most rows in the screen table above, this page's own docstring (predating
this pass) already documented a deliberate, largely-complete rebuild onto
this exact reference: real stat tiles with trend arrows, real appointments/
revenue line charts, a real status donut, a real service breakdown, a real
recent-bookings table, real top customers, and a real insights panel — all
computed live from `appointments_detailed`, verified against real data (16
real appointments, £255 real revenue) on first screenshot.

The reference's other six tabs (Appointments/Revenue/Customers/Services/
Staff/Availability) are deliberately not built — documented reasoning
already in the file: this salon has one staff member and one bookable
service, so most of that tab set would either duplicate the Overview tab
shown here or have nothing real to show (e.g. a "Staff" tab for a
single-owner salon).

#### Iteration 1 — the one real gap: no way to change the period

Everything matched except: the reference's date-range control ("26 May –
22 Jun 2025 ▾") implies it's interactive — clicking it changes what period
is analysed. The existing build had `const [range] = useState(...)` fixed
to "last 28 days" forever, rendered as plain text with no control at all.

`getReportsOverview(timezone, fromDate, toDate)` was already fully generic
in the service layer — nothing about the fix touched data fetching, only
wiring a real control to it:

- Added a `rangeDays` state (7/14/28/90) and a compact `<select>` in the
  header actions, positioned before the resolved-date text exactly where
  the reference puts its range control, styled to match every other inline
  filter select in the app (`Customers`/`Services`/`InboxPage`'s status
  filters — `h-9 rounded-lg border border-border bg-input`), with a
  `Calendar` icon prefix matching the search-input icon-inset pattern used
  throughout.
- Did **not** build a full custom calendar-range picker widget — no
  precedent component for one exists anywhere in this codebase (only a
  single-date `DatePicker`), and a preset dropdown is both simpler and
  covers the real need (comparing different windows) without inventing a
  new design-system primitive for one screen.

Verified live: switching "Last 28 days" → "Last 7 days" correctly
re-fetches and updates every stat tile, both charts' X-axis, the donut
total, recent bookings, and top customers (14 appointments, £170, 2 top
customers instead of 3) — a real, functional control, not decoration.

#### Not implemented — logged, not guessed at

- The six extra tabs (Appointments/Revenue/Customers/Services/Staff/
  Availability) — pre-existing, documented reasoning: single staff member,
  single bookable service (the `service_menu` catalogue is display-only,
  not separately bookable — see `docs/SCHEMA.md`/CLAUDE.md), so most of
  that tab set has nothing distinct to show beyond the Overview already
  here.
- "Appointments by service" is a single bar ("Hair Appointment," 100%) —
  correct given the single-bookable-service reality, not a bug; the
  reference's multi-service breakdown assumes a salon with several
  separately-bookable services, which this app deliberately doesn't have.

#### Verification

Dark theme and mobile (390×844) both checked — clean, charts and tables
reflow correctly, no changes needed beyond the range selector.
`npx vitest run`: 154/154 passing. Build clean.

#### Stop

Converged after 1 iteration — the page was already close to the reference;
this pass found and closed the one real interactive gap (the date range)
rather than rebuilding what already worked.

---

<a id="assistant"></a>

## assistant — `AssistantPage.tsx`

Target: `AssistantPage.tsx` → `AssistantChatTab.tsx`, route
`/dashboard/assistant`. Ref: `docs/design/ai.png`.

#### Already built

Like Reports, this page's own docstring already documented a real,
complete rebuild onto this reference — a real Claude-backed chat
(`supabase/functions/ai-assistant-chat`), real category cards, real
suggestion chips, real quick-action buttons, real popular prompts, and
real conversation history persisted to `localStorage`. Matched the
reference almost exactly on the first screenshot.

**Advisory-only framing kept, not traded for pixel-matching.** CLAUDE.md is
explicit and binding: _"The AI assistant is advisory only and cannot mutate
business data."_ The reference has no such disclaimer — this build carries
it twice (header subtitle, footer note under the chat) and that stays.
Every "quick action" here fills the chat input with a prompt for the model
to respond to in the transcript; none of them performs a real write
directly.

#### Iteration 1 — two real gaps

1. **No "New booking" button in the header actions.** Every other finished
   screen in this loop (Approvals, Requests, Customers, Services) carries
   one; this page didn't. Added it — same `Modal` + `NewBookingPanel`
   pattern used everywhere else, `prefill={null}`.
2. **Missing the sidebar's 4th card** ("Smarter business. More time for
   you."). Reference's version ends in an "Explore AI features" button —
   **dropped the button, kept the message.** This page _is_ the AI
   features; there's no separate features page to send someone to, so a
   button here would be decorative and point nowhere real. Rebuilt as a
   plain tinted info card (icon + heading + description, no action),
   matching the no-CTA card shape `ReportsPage`'s own Insights cards
   already use elsewhere in this app.

#### Not implemented — logged, not guessed at

- "View all" links on Quick actions (5 shown, all of them) and Recent
  conversations (already capped and shown at 5) — no separate "all quick
  actions" or "all conversations" page exists, and both lists already show
  everything they have. Adding non-functional links would be worse than
  omitting them.
- The reference's rich assistant reply (a rendered data table of top 5
  customers) — the current chat renders plain text/markdown-style replies
  from the real model; building a structured-table-response renderer is a
  chat-protocol feature, not a static design-match change, and the model's
  own text formatting already covers the same information.
- **Recent conversations showing "Nothing yet"** — correct, honest empty
  state for this browser's real `localStorage`, not a bug. Didn't fabricate
  fake conversation history to match the reference's populated list, and
  didn't trigger a real call to the live Claude backend just to seed a
  screenshot (that's a real external API call with a real cost, not a free
  visual affordance).

#### Verification

Tested the new "New booking" button live — modal opens, form is genuinely
blank (no stale prefill). Dark theme and mobile (390×844) both checked —
clean; card titles truncate at narrow width via the same `truncate` pattern
used everywhere else in the app, not a new issue. `npx vitest run`:
154/154 passing. Build clean.

#### Stop

Converged after 1 iteration — same story as Reports: already close, this
pass found and closed the two real gaps (header action, sidebar card)
without touching what already matched or fabricating what shouldn't exist.

---

<a id="notification"></a>

## notification — `NotificationsPage.tsx`

Target: `NotificationsPage.tsx`, route `/dashboard/notifications`. Ref:
`docs/design/notification.png`.

#### Already built

Same story as Reports and AI Assistant: already a real, complete rebuild
onto this reference — real activity events (bookings, availability
requests, completions), grouped by day, All/Unread/Archived tabs, a
category filter sidebar, a real notification-preferences panel
(`localStorage`-backed, genuinely functional), and a status card. Verified
against real data on first screenshot: 43 real events, all derived from
actual bookings — no stored `notifications` table exists (documented in the
file's own comment), by design.

#### Iteration 1 — one real gap: no unread-count badge on the header title

The reference shows a small red circular badge with the unread count next
to the "Notifications" H1. The build had a plain string title with no
badge anywhere on the page itself (the badge exists on the sidebar nav
row and the bell icon elsewhere in the shell, but not here).

- `DashboardLayout`'s `title` prop already accepted `ReactNode` — no shell
  change needed. Replaced the plain string with a `<span>` wrapping the
  text and a conditional badge, reusing the exact pill classes already
  used for the sidebar nav's own unread badges
  (`inline-flex min-w-5 items-center justify-center rounded-full bg-primary
px-1.5 py-0.5 text-xs font-semibold text-primary-foreground`) rather than
  inventing new badge styling.
- Verified live: badge reads "43" on load, clicking a notification marks it
  read and the badge live-updates to "42" in the same render as the tab
  count and the bottom "Stay on top of things" card — one source of truth
  (`unreadCount`), not three separately-tracked numbers that could drift.

#### Blocked briefly by unrelated pre-existing breakage

`npm run build` failed on `src/components/dashboard/calendar/DayView.tsx`
— pre-existing, uncommitted, unrelated to this task (confirmed via `git
status`: that file was already modified before this session's Notifications
work started, matching the `RESCHEDULABLE is not defined` /
`moving is not defined` HMR errors flagged earlier this session on the
Calendar/Appointments pages). Did not touch or fix it — not this task's
file, and altering someone else's in-progress uncommitted edit without
being asked isn't this session's call to make. Confirmed
`NotificationsPage.tsx` itself is clean by running `tsc --noEmit` and
filtering out `DayView.tsx`'s pre-existing errors — zero remaining.
Verified via the dev server (which serves routes independently) instead of
the full production build for this screen.

**This still needs the user's attention** — `npm run build` is currently
broken repo-wide until `DayView.tsx` is fixed or its in-progress change is
finished/reverted.

#### Verification

Dark theme and mobile (390×844) both checked — clean. `npx vitest run`:
154/154 passing (this suite doesn't depend on the broken `DayView.tsx`
build path). Full production build blocked by the unrelated issue above,
not by anything in this change.

#### Stop

Converged after 1 iteration — already close; this pass closed the one real
gap (header unread badge) and verified the rest matches.

---

<a id="email"></a>

## email — `EmailPage.tsx`

Target: `EmailPage.tsx`, route `/dashboard/email`. Ref: `docs/design/email.png`.

The loop brief flagged this as "currently an EmptyState stub" — stale.
Like Reports/Assistant/Notifications, it's already a real, complete
rebuild, with the exact architectural reasoning already documented in the
file.

#### Already built — and a real, deliberate scope cut

The reference is a full two-way email client: Inbox/Sent/Drafts/Scheduled/
Archived/Trash folders, Compose, Reply/Forward, star/archive/delete, and a
contact sidebar with open/click engagement tracking, related bookings,
notes and tags.

None of that is real here, and the file's docstring says exactly why:
`email_messages` is a **one-way transactional log** — a Postgres trigger queues
the row and the `drain-email-queue` `pg_cron` job hands it to the `send-emails`
Edge Function (there is no Inngest, and never was in the shipped build) — so
confirmations/reminders/receipts go out that way; nobody composes, receives, or
replies to mail inside this dashboard. So the build is a list-and-detail
_view_ over that log — All mail/Sent/Queued/Failed lanes (matching the real
`email_status` enum, not invented folders), no Compose, no Drafts/Trash/
Archived (nothing populates them), no reply/forward, no star (no schema
column for it). Verified against real data: 136 real outbox rows, several
genuinely `Failed` (real SMTP `550` bounces against `*.invalid` demo
addresses — honest failure data, not styled as fake).

#### Iteration 1 — one real gap: no link back to the customer

The reference's contact sidebar has "View customer profile." The rebuild
dropped the whole sidebar (open/click tracking, related bookings, notes,
tags all have no backing data) but also dropped this one link along with
it — even though `email_messages.customer_id` is a real column.

- Added a "View customer →" link next to the status badge in the detail
  header, shown only when `customer_id` is present, pointing to
  `${routes.owner.customers}?customer=${id}` — `CustomersPage.tsx` already
  handles that exact query param (built for this same cross-link pattern
  elsewhere). Verified live: click opens Customers, lands directly on
  Adaeze Okonkwo's real profile modal, matching data.

Considered also linking `appointment_id` (also a real column, would match
the reference's "Related bookings → View booking") but `AppointmentsPage.tsx`
has no query-param deep-link handling for a specific appointment id — unlike
Customers, that plumbing doesn't exist yet on the receiving page. Building
it would mean changing a second, unrelated page as a side effect of this
one; left it out and logged it here as a reasonable follow-up rather than
scope-creeping into another screen.

#### Not implemented — logged, not guessed at

- Compose / reply / forward / star / archive / delete — no real capability
  behind any of them (no inbound mail, no engagement tracking, no
  soft-delete column on `email_messages`).
- Contact-details sidebar's "Email activity" (Opened/Clicked/Replied
  timeline) — would need open-tracking pixels and link-redirect tracking,
  neither of which this transactional sender implements.
- Prev/next navigation within the detail view ("1 of 24" in the
  reference's toolbar) — the list-to-detail click already does this job;
  adding a second redundant nav control wasn't judged worth the space.

#### Verification

Dark theme and mobile (390×844) both checked — clean, reflows correctly.
`npx vitest run`: 154/154 passing. `tsc --noEmit` clean for every file this
change touched (pre-existing, unrelated `DayView.tsx` errors excluded — see
the [notification](#notification) section for that issue, still unresolved and not this
task's).

#### Stop

Converged after 1 iteration — closed the one real gap (customer link) on
top of an already-complete, honestly-scoped rebuild.

---

<a id="templates"></a>

## templates — `TemplatesPage.tsx + TemplateEditorPage.tsx`

Targets: `TemplatesPage.tsx` (`docs/design/templetes.png`) and
`TemplateEditorPage.tsx` (`docs/design/Email-Template-Editor.png`), routes
`/dashboard/templates` and `/dashboard/templates/:key/edit`.

#### Already built — and unusually complete

Both screens were already real, working, DB-backed builds, closely
matching both references. `TemplatesPage.tsx`: a real catalogue (18 fixed
transactional templates, hard-coded in
`supabase/functions/_shared/templates.ts` — not user-creatable, matching
the file's own honest comment), category tabs, search, and a detail view
showing real usage counts + the most recent real send example pulled from
`email_messages`. `TemplateEditorPage.tsx`: a real `contentEditable`
rich-text editor (bold/italic/underline/strike/lists/align/link, variable
insertion, paragraph-style select), backed by a genuinely editable
`email_templates` DB row (`getEmailTemplate`/`updateEmailTemplate`), a live
preview pane substituting sample values for `{{tokens}}`, an Email/Mobile
preview toggle, and the three settings toggles (Active/Allow editing before
sending/Include in automation) all wired to real columns. Verified Save
live — "Template saved." toast, real persistence.

This reconciles what first looked like a contradiction: the catalog
(_which_ templates exist) is fixed and hard-coded; each template's
_content_ (subject/body/settings) is a real, separately editable DB row.
Both facts are true at once, and the build already reflected that
correctly.

#### Iteration 1 — one real accuracy bug: the preview lied in dark mode

The Preview pane used this app's own theme tokens (`bg-card`,
`text-foreground`, `bg-tint-pending`, etc.), so switching the _dashboard_
into dark mode also darkened the _email preview_ — but the real email
(`supabase/functions/_shared/templates.ts`) hardcodes its own colours with
no dark-mode branch at all (`<meta name="color-scheme" content="light">`,
literal hex throughout: `PAPER #e8ebed`, `INK #333333`, `MUTED #6b7280`,
`LINE #dcdfe2`, `BRAND #e05d38`). Transactional email has no concept of the
owner's dashboard theme — a customer's inbox renders it light regardless.
So a token-based preview doesn't just look different, it actively
misrepresents what gets sent whenever the owner happens to be in dark mode.

Fixed by hardcoding the preview pane to those exact literal hex values
(sourced directly from the real template file, not invented) via inline
`style`, with a comment explaining why raw hex is deliberately correct here
— the one place in this app where matching a design token would be the
wrong call, because the thing being previewed exists entirely outside this
app's theme system.

While fixing this, corrected the masthead itself to match the real
template's actual structure — it was showing an invented centred
"Kokolett / BEAUTY UK" band with no basis in the real HTML; the real
masthead is left-aligned "Kokolett **Beauty** UK" (brand-orange highlight
on the middle word only) with a right-aligned "Women's hair salon" label,
white background, bottom border. Verified against
`supabase/functions/_shared/templates.ts:159-167` directly rather than
guessing from the reference screenshot alone.

Verified live in both dashboard themes — the preview now renders
identically in each, as it should, matching the real masthead layout.

#### Not implemented — logged, not guessed at

- Reference's `TemplatesPage` sidebar "Template storage" quota card
  ("12 of 50 templates used") — no per-plan quota concept exists; the
  catalogue is a fixed, hard-coded 18 (not a limit that can be raised on a
  paid tier).
- "New template" / custom-template creation — no create path exists; the
  catalogue is fixed by what the send pipeline actually knows how to
  render.
- SMS channel badges — no SMS provider is wired into this app; every real
  template is Email.
- Image upload in the editor toolbar — already correctly disabled in the
  existing build (`title="Image upload isn't wired up yet"`), not
  something this pass needed to touch.

#### Verification

Dark theme and mobile (390×844) checked for both screens — clean.
`npx vitest run`: 154/154 passing. `tsc --noEmit` clean for every file this
change touched (pre-existing, unrelated errors in `DayView.tsx` and
`CustomersPage.tsx`/`customerService.ts` excluded — neither touched this
session, not this task's to fix).

#### Stop

Converged after 1 iteration — closed the one real gap (a preview that
actively misrepresented the real send in dark mode) on top of an
already-thorough, honestly-scoped build.

---

<a id="settings"></a>

## settings — `SettingsPage.tsx`

Target: `SettingsPage.tsx`, route `/dashboard/settings`. Ref:
`docs/design/settings.png`.

#### Already built — no code changes needed

The only screen in this whole build-loop pass that needed zero edits.
Six tabs (Organisation/Account/Business/Preferences/Security/Billing),
all real, all matching the reference or improving honestly on what it
implies:

- **Organisation**: real business name/category/country/timezone
  ("Hair Salon" — correctly the app's real scope, not the reference's
  generic "Beauty Salon"), real account details, real business-settings
  nav rows, real Preferences, real Security/Support cards.
- **Business** tab (not shown in the reference screenshot, but real and
  more thorough than the reference implies): salon details, DB-enforced
  booking rules, Google reviews config, an actual iCalendar subscription
  feed with an honest security/latency notice, share links, real mailing
  list count.
- **Preferences**: Theme is genuinely wired to `ThemeContext` app-wide
  (verified live — clicking Dark actually re-themes the whole dashboard,
  screenshot confirms the button's own selected state updates). Time
  format is genuinely wired into every `formatTime` call. Language is
  disabled with one option, honestly — no i18n system exists, and copy is
  British English everywhere per CLAUDE.md, so this isn't a real choice to
  offer. Date format saves a real preference but doesn't yet drive
  rendering — documented in the component's own comment as a deliberate
  choice, not an oversight.
- **Security**: real TOTP two-factor auth via Supabase's native MFA API —
  QR enrollment, verification, disable, and an honest, actionable error
  message if MFA isn't turned on at the Supabase project level yet (names
  the exact config path rather than a generic failure). "Login activity"
  shows the one real session fact the client SDK exposes
  (`last_sign_in_at`), not a fabricated session list.
- **Billing**: "This dashboard is your own — there's no subscription or
  invoice to manage." Correct — this is a bespoke single-owner app, not a
  multi-tenant SaaS product being resold to Kokolett; there's no real
  billing relationship to show.

#### Not implemented — logged, not guessed at

- Nothing found worth building. Every place the reference implies
  something this app doesn't have (a billing plan, multiple languages, a
  session-management admin list) already has an honest real answer rather
  than a fabricated one.

#### Verification

Clicked through all six tabs live. Dark theme and mobile (390×844) checked
on the Organisation tab (the one the reference depicts) — clean, all tabs
wrap correctly at narrow width. `npx vitest run`: 154/154 passing (no
changes made, confirming nothing needed touching).

#### Stop

Converged after 0 iterations of code change — verification only. This is
the most complete screen encountered in the whole pass.

---
