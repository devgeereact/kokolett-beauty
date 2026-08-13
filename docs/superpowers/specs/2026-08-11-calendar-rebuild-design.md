# Calendar rebuild — design spec

**Date:** 2026-08-11
**Status:** Approved, pending implementation plan
**Scope:** Phase 1 of the owner-dashboard redesign (see `PROJECT-MEMORY.md` /
session notes for the full 9-piece decomposition: Calendar → Nav/Today,
Appointment merge, Customer card, Services polish → Settings redesign →
Booking success screen + date picker).

## 1. Why this is Phase 1

`docs/ARCHITECTURE.md` already documents `/dashboard/calendar` as "Day / week
/ month / agenda, drag-to-reschedule." The shipped `CalendarPage.tsx` only
implements a month grid plus a flat per-day list of published start times —
no week view, no day view, no time axis, no drag. This spec finishes what
was already the documented target, driven by a fresh ask to make it look
and feel like Apple Calendar / the FullCalendar reference demo
(`demo.fulleventcalendar.com`). It is Phase 1 because every later
owner-dashboard screen (Appointment merge, Customer card) touches or
references the calendar.

`docs/DESIGN.md` §7 already states: "The calendar is a table with proper
headers, plus an agenda list as the accessible alternative to
drag-and-drop," and §6 already budgets "slot selection and calendar drag"
motion. Accessibility parity with drag is existing policy, not new scope.

## 2. Non-goals

- No change to the availability data model. A day is still exactly its
  list of published `availability_slots` start times (migration `0011`'s
  model). This spec adds a _visualisation_ layer and one new _write_ path
  (owner drag), not a new availability concept.
- No multi-service / multi-duration calendar. One active `Hair Appointment`
  service, one fixed duration, as today.
- No change to `Appointments` / `Approvals` / `Requests` pages — that merge
  is Phase 2.
- No mobile-phone-first layout. Primary device is the salon tablet (see
  `TodayPage`'s own "left open on a salon tablet overnight" comment). Phone
  gets Day view + Agenda by default; Week/Month remain usable via
  horizontal scroll but aren't optimised for a 375px screen.

## 3. Approach

Custom, lightweight grid built on the existing hand-rolled `lib/calendar.ts`
— not a third-party calendar library (FullCalendar, react-big-calendar).

**Why not a library:** every option either fights the CSS-custom-property
token system in `index.css`/`tailwind.config.ts` (their own theming layers
would need overriding, and `bg-primary/50`-style opacity tricks already
don't work against `var()` colours per `DESIGN.md` §8), or assumes an
"events + resources" model that doesn't map cleanly onto "a day is a list
of exact start times." A custom grid keeps the codebase's existing pattern
(small typed components, no framework dependency for something this
codebase already partially hand-rolls) and keeps full control over the
Apple-style visual target.

**Why it's still feasible:** the live-appointment gist exclusion constraint
(`appointments_no_overlap`, `docs/SCHEMA.md` §3) guarantees no two live
appointments ever overlap in time. So the grid needs **no collision-layout
algorithm** — every day column is exactly one lane wide. That's the piece
that makes hand-rolling this reasonable instead of reaching for a library.

## 4. Data layer — migration `0024`

**Revised after implementation research (see below) — this section originally
specified an in-place `UPDATE`. That turned out to be the wrong call once the
actual trigger and email-template code was read; the design here is the
corrected one.**

### `reschedule_appointment_as_owner(p_appointment_id uuid, p_new_starts_at timestamptz)`

`security definer`, `is_owner()` guarded, `execute` revoked from `anon` —
same pattern as the other `0003` owner RPCs.

**Retire-and-recreate, mirroring `customer_reschedule_appointment`
(migration `0022`) almost exactly** — not the in-place `UPDATE` originally
specified here. Reasoning for the reversal:

- `notify_appointment_status_changed` only fires logic `if new.status <>
old.status` — an in-place `starts_at`-only update wouldn't fire it at
  all, so reminders and the customer notification would need to be
  hand-rolled a second time, duplicating logic that already exists,
  already handles the "no reminders in the past" guard (migration `0010`),
  and is already proven correct by `customer_reschedule_appointment`.
- The `booking_rescheduled` email template already exists in
  `supabase/functions/_shared/templates.ts` and is written for exactly
  the retire-and-recreate shape — it says _"this replaces your booking on
  [old date], which has been released"_ and _"your reference has changed
  to [new ref]"_. Nothing currently calls it with that template name
  (`notify_appointment_status_changed`'s `rescheduled` branch emails the
  **owner**, for the customer-initiated path — `owner_booking_moved`), but
  the copy is already right for the owner-initiated case once the
  notification target is the customer instead.
- Reusing the same shape means reusing the same proven safety property:
  the old row is retired _before_ the new one is inserted, and if the
  insert then fails on `exclusion_violation` (someone else's slot appeared
  in the gap), **the old booking is restored** rather than left cancelled
  with nothing in its place.

Differences from `customer_reschedule_appointment`:

- **Auto-publishes the destination time** if it isn't already on that
  day's published list (upserts into `availability_slots` in the same
  transaction, instead of raising `OUTSIDE_AVAILABILITY`). This was the
  one open product decision in the brainstorm — going with auto-publish
  because it matches the existing precedent that
  `create_appointment_as_owner` already bypasses the approval gate: the
  owner looking at her own calendar and moving a card _is_ the owner
  declaring her availability, the same way typing in a new booking is.
- **Only `confirmed` and `pending_approval`** are reschedulable this way
  (same restriction `customer_reschedule_appointment` already enforces);
  anything else raises `NOT_RESCHEDULABLE` (reusing that exact error code,
  not inventing a new one).
- **Notifies the customer, not the owner** — `queue_email('booking_rescheduled',
v_customer.email, …)` where `customer_reschedule_appointment`'s shared
  status-change trigger would instead have emailed the owner. The owner
  doesn't need telling; she just did it.
- No session token — takes `is_owner()` instead of resolving a customer
  session, same as every other `0003`/`0007` owner RPC.

Still governed by `appointments_no_overlap` exactly as `book_appointment`
and `customer_reschedule_appointment` already are — a drop onto a taken
time fails with `exclusion_violation` → `SLOT_TAKEN`, caught and mapped
the same way.

**No `SLOT_MISALIGNED` / `LEAD_TIME_VIOLATION` / `BEYOND_BOOKING_HORIZON`
checks.** `create_appointment_as_owner` (migration `0011`) already
establishes the precedent that owner-authenticated write paths skip the
customer-protection guards entirely and check only that the target service
exists and the overlap constraint holds — "the owner is looking at the
customer [or her own calendar]" is the same reasoning either way. The drag
UI snaps to the 15-minute grid visually before calling this function, so
server-side alignment enforcement would be redundant, not a safety net.
`NOT_RESCHEDULABLE`, `ALREADY_PASSED` and `SAME_TIME` are kept, reusing
`customer_reschedule_appointment`'s exact codes — these guard data
integrity (don't "reschedule" something that already happened, don't
silently no-op) rather than being customer-only courtesies.

**One side-effect of reusing the insert-trigger chain needs explicit
cleanup.** `notify_appointment_created` (fires on `INSERT`) unconditionally
queues an owner-facing `owner_new_booking` or `owner_approval_needed`
email whenever a live appointment row is inserted — correct when a
_customer_ reschedules (the owner should hear about it), wrong here (the
owner doesn't need to be told about her own action). After the insert,
this function marks that specific just-queued row `failed` (`template in
('owner_new_booking', 'owner_approval_needed') and status = 'queued' and
appointment_id = v_id`) — the same "retire an unwanted queued email"
pattern `notify_appointment_status_changed` already uses elsewhere, just
inline instead of trigger-driven.

**Known pre-existing gap, not this function's to fix:** the
`rescheudled_mail()` trigger that rewrites a freshly-queued customer email
to the `booking_rescheduled` template only matches `template in
('booking_confirmed', 'booking_approved')` — a `pending_approval` reschedule's
customer email stays `booking_held` ("we have your request") rather than
becoming the more precise "your appointment has moved" copy. Not wrong,
just less precise, and it's shared code this function isn't touching.

**Migration safety:** validated against the live Supabase project inside a
rolled-back transaction before it ships (per this repo's standing rule on
testing SQL against live data with no side effects) — not just checked
against a local/empty schema.

## 5. Frontend architecture

New directory `src/components/dashboard/calendar/`:

| File                | Purpose                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `CalendarShell.tsx` | View-mode tabs (Week/Day/Month) + shared header/nav, replaces the top of `CalendarPage.tsx` |
| `MonthView.tsx`     | The current month-grid JSX, moved here unchanged in behaviour, pills added (§6)             |
| `WeekView.tsx`      | New — 7-day hour-axis grid                                                                  |
| `DayView.tsx`       | New — single-day hour-axis grid + `AgendaList` + relocated `DayPanel`                       |
| `EventBlock.tsx`    | One appointment or one open-slot ghost, positioned by time                                  |
| `NowLine.tsx`       | The live red time indicator                                                                 |
| `AgendaList.tsx`    | Accessible list view — every action available with zero drag, zero mouse                    |

`lib/calendar.ts` gains the hour-axis math as pure functions (same style as
the existing `monthGrid`/`gridRange`):

- `hourRange(minStart, maxEnd)` — auto-fits the visible axis to the
  tightest published-or-booked span for the rendered range, ±1h padding,
  floored at 6h tall, falling back to 08:00–20:00 when a day has nothing
  published at all. (This range is a sensible default, not a setting yet —
  worth revisiting in the Settings redesign phase if the owner wants it
  fixed.)
- `timeToOffset(time, hourRange)` — pixel/percentage offset for positioning
  an `EventBlock` or `NowLine`.

`DayPanel`'s publish tooling (quick-fill, copy-from-day, add/remove time)
is **relocated, not rebuilt** — it renders inside a collapsed "Manage
published times" panel next to `DayView`'s grid.

Appointment detail: clicking (not dragging) an `EventBlock` opens the
existing `AppointmentCard` component in a popover — reused as-is from
Today/Appointments, not rebuilt for the calendar.

## 6. Interactions

- **Drag:** custom pointer-events (`pointerdown`/`pointermove`/`pointerup`),
  not the HTML5 Drag and Drop API — HTML5 DnD's touch support is
  unreliable, and the salon tablet is the real device this has to work on.
  Snaps to the `slot_granularity_min` (15-minute) grid. Only `confirmed`
  and `pending_approval` blocks are draggable, matching §4's RPC scope.
- **Click:** opens `AppointmentCard` popover for status changes / notes —
  no change to those actions, just a new entry point.
- **Month view pills:** each day cell shows up to 2 mini pills (time +
  first name, coloured by status token) plus a "+N more" overflow that
  opens that day in `DayView`. Replaces the current counts-only cells.
  Still shows the "X published · Y booked" summary line above the grid —
  that fact ("4 times · 1 booked") stays useful and isn't replaced by the
  pills, just supplemented.
- **Open-slot ghosts:** dashed-outline blocks for published-but-unbooked
  future times only. Past unbooked times are omitted rather than rendered
  faded, to cut clutter — this matches `owner_day_slots`'s existing
  `is_past` flag, no new query needed.
- **Live now-line:** rendered only on Week/Day views, only on today's
  column. Recomputed on an interval (not frozen at mount), following the
  same rollover-safe pattern `useSalonToday` already established.

## 7. Accessibility

Non-negotiable per `DESIGN.md` §7, not extra scope:

- The grid is a real `<table>` with proper headers (rows = times, columns =
  days), not a `<div>` soup with ARIA bolted on.
- `AgendaList` is a parallel, fully-functional interaction — every booked
  entry opens the same `AppointmentCard` detail the grid does, and from
  there "Move" (an inline panel on the card, not a floating modal — this
  codebase has no modal/dialog primitive and consistently uses inline-
  expanding panels instead, e.g. `AppointmentCard`'s own note editor,
  `DayPanel`'s fill-a-range panel) lets the owner pick a new date + time
  from that day's currently-published free times, same data
  `listDaySlots()`/`owner_day_slots()` already expose — works with no
  drag and no mouse.
- Touch targets ≥ 44×44px on every interactive block, per the existing
  rule that already governs slot buttons.
- `prefers-reduced-motion` — the now-line's position update is not an
  animation (no easing, it just moves), so it isn't gated by the global
  reduced-motion rule; nothing else on the grid animates beyond the
  existing 150–300ms state-change transitions already used elsewhere.

## 8. Error handling & edge cases

| Case                                              | Behaviour                                                                                                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drop onto a time already taken                    | RPC returns `SLOT_TAKEN`; block snaps back; toast, same copy pattern as `book_appointment`'s error mapping                                                                             |
| Drag a non-draggable status                       | Block isn't draggable at all (no drag handle rendered)                                                                                                                                 |
| Drag to a past time                               | Rejected client-side before the RPC call; block snaps back                                                                                                                             |
| Realtime update arrives mid-drag                  | Drag is authoritative until drop; a concurrent external change is caught by the same exclusion constraint at commit time (existing pattern, `book_appointment` already races this way) |
| Owner has published nothing for the visible range | Grid renders with the 08:00–20:00 fallback range, empty of ghosts, no error                                                                                                            |

## 9. Testing

- **`lib/calendar.ts` additions** — pure-function unit tests for
  `hourRange`/`timeToOffset`, same style as existing `monthGrid`/`gridRange`
  coverage in `src/test`.
- **`rescheduleAppointmentAsOwner` service wrapper** — no test, matching
  the rest of `appointmentService.ts` (nine existing exports, zero test
  file — this repo doesn't unit-test its thin RPC wrappers, confirmed
  during implementation research rather than assumed here).
- **Migration `0024`** — exercised against the live Supabase project inside
  a rolled-back transaction before merge: the success path (auto-publish
  on an unpublished target, old row retired, new row correct, owner
  spam-email suppressed, customer `booking_rescheduled` email queued),
  `SLOT_TAKEN` on a collision with restore of the original row, and
  `NOT_RESCHEDULABLE` on a non-reschedulable status.
- **Manual / E2E-by-hand:** drag a confirmed appointment onto an open cell
  (moves, customer emailed); drag onto an occupied cell (rejected, toast);
  complete the same move via `AppointmentCard`'s "Move" panel with a
  keyboard-only pass, screen reader on.

## 10. Suggested build order (for the implementation plan)

Not a commitment, just the shape that lets something real appear on
localhost early rather than only at the very end:

1. `WeekView` / `DayView` / `MonthView` rendering real data, **no drag
   yet** — this alone is visually the whole ask and is safe to look at
   immediately. (Shipped — `docs/superpowers/plans/2026-08-11-calendar-week-day-views.md`.)
2. Migration `0024` + `rescheduleAppointmentAsOwner`, validated live in a
   rolled-back transaction, **plus** the `AppointmentCard` "Move" panel in
   the same pass — the original draft of this list had the panel before
   the migration, which doesn't work: there is no write path for a modal
   to call until the RPC exists. Combined into one plan:
   `docs/superpowers/plans/2026-08-11-reschedule-as-owner-and-move-modal.md`.
   This is also what ships the accessible, keyboard-operable reschedule
   path — `AgendaList` already opens `AppointmentCard` for a booked entry,
   and `AppointmentCard` is where "Move" lives.
3. Pointer-based drag wired to (2)'s RPC.
