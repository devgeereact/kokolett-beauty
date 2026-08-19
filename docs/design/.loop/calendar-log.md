# Calendar (CalendarPage.tsx) — design-match log

Ref: `docs/design/calendar.png`. Route: `/dashboard/calendar`.

## Baseline

Already substantially built: Day/Week/Month/Agenda views, drag-to-reschedule,
appointment detail rail, mini month calendar, filters card, status legend, AI
advisory panels (Schedule conflicts, Reschedule suggestions). Refinement, not a
from-scratch build.

## Iteration 1 (light, desktop, 1536×1024)

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

## Dark theme (desktop)

Screenshot: `calendar-dark-1.png`. Clean — tokens resolve correctly, all status
tints and the active-tab tint fix read fine on the dark surface. No changes needed.

## Mobile (390×844, light + dark)

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

## Iteration 4 — user request: remove extra content, fit to one screen

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

## Stop

Converged after 4 iterations on desktop light/dark. Mobile has the one flagged,
deliberately-unfixed Week-view-cramped issue from iteration 3.
