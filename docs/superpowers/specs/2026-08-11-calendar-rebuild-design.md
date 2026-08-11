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
  model). This spec adds a *visualisation* layer and one new *write* path
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

### `reschedule_appointment_as_owner(p_appointment_id uuid, p_new_starts_at timestamptz)`

`security definer`, `is_owner()` guarded, `execute` revoked from `anon` —
same pattern as the other `0003` owner RPCs.

- **In-place `UPDATE`** of `starts_at`/`ends_at` on the existing row — not
  the retire-and-recreate pattern `customer_reschedule_appointment` uses.
  That pattern exists to preserve a customer-facing move history ("she
  moved twice, the second time at short notice"); an owner nudging her own
  day by dragging a card is a correction, not an event worth a new booking
  reference every time.
- **Only `confirmed` and `pending_approval`** are reschedulable this way.
  `checked_in` / `in_service` / any terminal status raises
  `ILLEGAL_TRANSITION` (reusing the existing error-code convention from
  `set_appointment_status`).
- Still governed by `appointments_no_overlap` — a drop onto a taken time
  fails with the same `exclusion_violation` → `SLOT_TAKEN` mapping
  `book_appointment` already uses. The frontend snaps the block back and
  shows a toast; nothing about the constraint changes.
- **Auto-publishes the destination time** if it isn't already on that day's
  published list (writes into `availability_slots` in the same
  transaction). This was the one open product decision in the brainstorm —
  going with auto-publish because it matches the existing precedent that
  `create_appointment_as_owner` already bypasses the approval gate: the
  owner looking at her own calendar and moving a card *is* the owner
  declaring her availability, the same way typing in a new booking is.
- **Requeues reminders.** The insert trigger only fires on `INSERT`; an
  in-place `starts_at` update needs its own logic to cancel the
  now-wrong queued 24h/2h `email_messages` rows and insert fresh ones,
  reusing the "no reminders in the past" guard from migration `0010` (a
  same-day drag must not queue a 24h reminder for a time already gone).
- **Notifies the customer.** Dispatches the existing `appointment/rescheduled`
  Inngest event (already wired for customer-initiated reschedule per
  `docs/ARCHITECTURE.md` §6a) so the customer gets told through the same
  email plumbing — a drag that silently moves someone's appointment without
  telling them is a support ticket waiting to happen.

**Migration safety:** validated against the live Supabase project inside a
rolled-back transaction before it ships (per this repo's standing rule on
testing SQL against live data with no side effects) — not just checked
against a local/empty schema.

## 5. Frontend architecture

New directory `src/components/dashboard/calendar/`:

| File              | Purpose                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `CalendarShell.tsx` | View-mode tabs (Week/Day/Month) + shared header/nav, replaces the top of `CalendarPage.tsx` |
| `MonthView.tsx`     | The current month-grid JSX, moved here unchanged in behaviour, pills added (§6)            |
| `WeekView.tsx`      | New — 7-day hour-axis grid                                                                 |
| `DayView.tsx`       | New — single-day hour-axis grid + `AgendaList` + relocated `DayPanel`                      |
| `EventBlock.tsx`    | One appointment or one open-slot ghost, positioned by time                                 |
| `NowLine.tsx`       | The live red time indicator                                                                |
| `AgendaList.tsx`    | Accessible list view — every action available with zero drag, zero mouse                   |

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
- `AgendaList` is a parallel, fully-functional interaction — every action
  including "Move" (opens a modal: pick a new date + time from that
  service's currently-published free times, same data
  `available_slots()`/`owner_day_slots()` already expose) works with no
  drag and no mouse.
- Touch targets ≥ 44×44px on every interactive block, per the existing
  rule that already governs slot buttons.
- `prefers-reduced-motion` — the now-line's position update is not an
  animation (no easing, it just moves), so it isn't gated by the global
  reduced-motion rule; nothing else on the grid animates beyond the
  existing 150–300ms state-change transitions already used elsewhere.

## 8. Error handling & edge cases

| Case                                             | Behaviour                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Drop onto a time already taken                    | RPC returns `SLOT_TAKEN`; block snaps back; toast, same copy pattern as `book_appointment`'s error mapping |
| Drag a non-draggable status                       | Block isn't draggable at all (no drag handle rendered)                     |
| Drag to a past time                                | Rejected client-side before the RPC call; block snaps back                 |
| Realtime update arrives mid-drag                   | Drag is authoritative until drop; a concurrent external change is caught by the same exclusion constraint at commit time (existing pattern, `book_appointment` already races this way) |
| Owner has published nothing for the visible range | Grid renders with the 08:00–20:00 fallback range, empty of ghosts, no error |

## 9. Testing

- **`lib/calendar.ts` additions** — pure-function unit tests for
  `hourRange`/`timeToOffset`, same style as existing `monthGrid`/`gridRange`
  coverage in `src/test`.
- **`rescheduleAppointmentAsOwner` service wrapper** — mocked Supabase RPC
  call, following this repo's existing service-test conventions (tests run
  without a `.env`, per this repo's standing rule — no live client at
  module scope).
- **Migration `0024`** — exercised against the live Supabase project inside
  a rolled-back transaction before merge: overlap rejection, auto-publish
  on an unpublished drop target, reminder requeue, `ILLEGAL_TRANSITION` on
  a non-reschedulable status.
- **Manual / E2E-by-hand:** drag a confirmed appointment onto an open cell
  (moves, customer emailed); drag onto an occupied cell (rejected, toast);
  complete the same move via `AgendaList`'s "Move" button with a
  keyboard-only pass, screen reader on.

## 10. Suggested build order (for the implementation plan)

Not a commitment, just the shape that lets something real appear on
localhost early rather than only at the very end:

1. `WeekView` / `DayView` / `MonthView` rendering real data, **no drag
   yet** — this alone is visually the whole ask and is safe to look at
   immediately.
2. `AgendaList` + the "Move" modal (keyboard-operable reschedule, no drag
   required) — this is also what ships the accessible path.
3. Migration `0024` + `rescheduleAppointmentAsOwner`, validated live in a
   rolled-back transaction.
4. Pointer-based drag wired to (3).
