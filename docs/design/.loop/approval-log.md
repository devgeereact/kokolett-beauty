# Approvals screen — design-match log

Target: `InboxPage.tsx` (`tab=approvals`), route `/dashboard/inbox?tab=approvals`.
Ref: `docs/design/approval.png`.

Components already existed (`ApprovalCard`, `ApprovalDetailPanel`,
`ApprovalStats`, `ApprovalPolicyFooter`, `demoApprovals.ts`) — this loop found
and closed the remaining gaps rather than building from scratch.

**Shell divergence, not fixed (per `build-loop.md`: shell already shipped).**
The reference's sidebar (flat list, dark charcoal, profile card, salon footer
card, theme toggle) and top bar (contextual search placeholder, no Refresh
button, notification badge) reflect the _old_ pre-rebuild mockup. The shipped
`DashboardLayout` (grouped nav sections, global ⌘K command palette with a
fixed "Search anything…" placeholder, Refresh button, bell badge wired only
on Today) is deliberately different and consistent across every already-built
screen (Dashboard, Calendar, Appointments). Not re-litigated here.

## Iteration 1 — baseline screenshot

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

## Iteration 2 — fixed the three gaps above

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

## Iteration 3 — stat tile icon

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

## Iteration 4 — dark theme + mobile breakpoint pass

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

## Stop

Converged after 4 iterations. Nothing left that's fixable from code:

- Reference customer photos aren't fixable — `Avatar` deliberately renders a
  tinted initials/silhouette tile everywhere in the app (no customer-photo
  field exists in the schema; see the comment in `Avatar.tsx`), not
  something to special-case for this one screen.
- The reference's dark-charcoal flat sidebar and the top bar's
  contextual-search/badge/no-Refresh chrome are the pre-rebuild mockup; the
  shipped grouped-nav shell (`docs/planning/owner-console-rebuild-plan.md`)
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
