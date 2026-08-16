# Availability requests screen — design-match log

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

## Iteration 1 — baseline screenshot, real data

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

## Iteration 2 — fixed gap #1

`RequestDetailPanel.tsx`: `setSelectedSlot((prev) => prev ?? found[0] ?? null)`
after slots load — pre-selects the top suggestion without ever overwriting a
selection the owner already made (guards on `prev ?? …`, so "View more
slots" re-fetching with a higher limit can't yank the selection away).

Build clean. Verified: first slot now shows the red selected border and
"Offer this slot" renders solid/enabled by default, matching the reference.

## Iteration 3 — fixed gap #2 (data + component)

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

## Iteration 4 — label styling pass

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

## Iteration 5 — dark theme + mobile breakpoint pass

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

## Stop

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
