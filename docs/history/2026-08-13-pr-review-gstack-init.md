# Pre-Landing PR Review — `chore/gstack-init-and-plan-doc`

**Reviewed:** local `main` (`b01c8ad`) → `HEAD` (`4727434`), 26 files, +2,914/-2,417 (excluding the
generated `docs/fresh/*` skill artifacts, which aren't part of this branch's own diff).
Read-only review — no fixes applied, no PR comments posted (none exists), no tracked file edited.

**Judgment call — base branch.** `origin/main` is 71 commits *behind* local `main` (local main has
unpushed work; `git log --oneline origin/main..main` = 71 commits, `git log HEAD..origin/main` = 0).
Diffing against `origin/main` pulls in unrelated already-integrated local history and produces a
misleading 109-file diff. Local `main` (`b01c8ad`) is this branch's actual fork point
(`git merge-base main HEAD` lands exactly on `main`'s tip, no divergence), so that's the base used
throughout. No PR exists yet (`gh pr view` — none found), so Greptile triage, Codex CLI review, and
plan-completion audit against a tracked PR description were skipped; commit messages were used as
the intent source instead.

**Verification performed:** `npx tsc --noEmit` — clean. `npm test -- --run` — 142/142 passing across
17 files, including the new drag/pointer and midnight-rollover tests. Grepped the diff for
`dangerouslySetInnerHTML`/`eval`/raw SQL string interpolation in `.ts`/`.tsx` — none found.

**Scope check:** CLEAN, with one note. The branch name suggests gstack tooling setup + a plan doc,
but the actual diff bundles that together with a real bug-fix pass (3 reschedule RPC bugs, a drag
race condition, a midnight-rollover bug, a duplicate-booking bug) and a 7-item design-review
remediation (FINDING-001 through FINDING-007). All of it is coherent, tested, and traceable to a
commit — this reads as an accumulated working branch rather than drift, but flagging it since the
branch name undersells what's actually landing.

---

## Critical findings

### [CRITICAL] (confidence: 9/10) `supabase/migrations/0024_reschedule_appointment_as_owner.sql`, `0025_customer_reschedule_race_and_duration.sql` — edited in place, violating the project's own migration-immutability rule

`docs/SCHEMA.md:10` states: **"Never edit an applied migration. Add `0003_*.sql`."** This diff does
exactly that. `0024` loses its `v_service`/`hair_appointment()` lookup and gains a new
`ALREADY_PASSED` check on `p_new_starts_at`; `0025`'s insert column list gains `approved_by`. Both
migrations are stated as already live in production — the new `0026_reschedule_review_fixes.sql`'s
own header comment says so explicitly:

> "`create or replace function` isn't retroactive — editing 0024/0025's own files in place doesn't
> change what's already live — so the fixes ship as a new migration that redefines both functions."

That reasoning is correct, and `0026` does the right thing (I checked its column/value alignment,
grants, and validation order against `0024`/`0025` line by line — all consistent, no bugs). But the
same commit then **also** edits `0024`/`0025` in place anyway, directly contradicting the rationale
that justified creating `0026` at all. Practical consequences:

- It's the project's own documented rule, broken in the same branch that argues for it.
- A fresh `supabase db reset` (local dev, CI) will silently apply the *already-fixed* `0024`/`0025`,
  then `0026` reapplies the same fix again (harmless — `create or replace function` is idempotent) —
  so this doesn't break a clean replay. The risk is environments that already applied the *original*
  `0024`/`0025` and now diff/lint the migration files against Supabase CLI's tracked history, or a
  future engineer using `git blame`/`git show 0024` expecting to see what was *actually* shipped and
  instead finding it silently rewritten.

**Fix:** revert the in-place edits to `0024` and `0025`; let `0026` carry the fix alone (it already
does, correctly). If the team wants a policy of touching old migrations for comment-only clarity,
that's a separate decision — `SCHEMA.md:10` should say so explicitly rather than being contradicted
silently.

### [CRITICAL] (confidence: 8/10) `src/hooks/useAppointmentDrag.ts:63-72, 166-216` — shared drag state across concurrent pointers can reschedule the wrong appointment

`useAppointmentDrag` is instantiated once per calendar view and shared by every `EventBlock`
(confirmed: `DayView.tsx:143/216` and `WeekView.tsx:163/281` both pass the same `drag.beginDrag` to
every block). It holds exactly one `stateRef` for "the current drag." Each `beginDrag` call attaches
its own `pointerId`-filtered `pointermove`/`pointerup`/`pointercancel` listeners (a real improvement
over the pre-existing code — this part of the fix is correct), but nothing stops a **second**
`beginDrag` call from firing while a first drag is still in progress:

```ts
// beginDrag, line 174
if (busy) return;
```

`busy` is only set `true` inside `finishDrag`, right before the RPC call (line 150) — i.e. only
*after* a drop, never while a drag is merely in flight. So if a second pointer presses a *different*
`EventBlock` before the first pointer releases (two fingers on a touch device — the hook's own
docstring says "the salon tablet this has to work on is touch-first"), `beginDrag` overwrites the
shared `stateRef.current` with the second appointment.

Trace of what happens next: the first pointer's own `handleUp` is still correctly scoped to its own
`pointerId`, so it fires on the first pointer's release and calls the shared `finishDrag(ev)`. But
`finishDrag` reads `stateRef.current` — which now holds the **second** pointer's appointment/date/
column, not the first's. The result: `rescheduleAppointmentAsOwner` is called with the **second**
appointment's ID but the **first** pointer's drop coordinates (`e.clientX`/`e.clientY` in `finishDrag`
belong to whichever pointer actually triggered it). The second pointer's own eventual release then
finds `stateRef.current` already nulled and does nothing — its own drag or tap is silently dropped.

The code comment at line 188-190 claims this is handled ("a second finger touching a different
draggable block mid-drag must not hijack stateRef"), and the per-listener `pointerId` filtering does
correctly stop a *foreign* pointer's stray events from resolving the *tracked* drag (this is what
`useAppointmentDrag.test.ts`'s "ignores a pointerup from a different pointerId" test actually covers)
— but that test never exercises two *concurrent* `beginDrag` calls, which is the actual gap: the
mutable `stateRef` itself isn't scoped per pointer, only the listeners are.

**Fix:** key drag state by `pointerId` (e.g. `Map<number, DragState>`) so two concurrent gestures
don't share one mutable slot, or have `beginDrag` bail out early if `stateRef.current` is already set
for a different pointer (simplest fix, matches the existing `busy` idiom, though it means a second
finger's touch is ignored rather than tracked — probably the right tradeoff for a single-owner admin
tool).

---

## Verified correct (checked, no issue)

- **`0026`'s three targeted fixes** — `ALREADY_PASSED` on the new time (owner path), carrying
  `approved_by` forward on the customer-reschedule insert, and dropping the dead
  `hair_appointment()`/`SERVICE_UNAVAILABLE` lookup — are all correctly implemented; insert
  column/value lists line up 1:1 in both functions (15/15 columns), grants match the pre-existing
  `authenticated`-only / `anon+authenticated` split, and the `for update` row lock plus
  `exclusion_violation` catch-and-restore pattern correctly prevents a TOCTOU double-book without
  needing a check-then-insert race.
- **Email-suppression side effects in `0026`** — after retiring the old appointment and inserting the
  new one, the function marks specific queued `email_messages` rows `failed` to stop the owner
  emailing herself about her own reschedule. I traced this against the actual trigger definitions
  (`notify_appointment_status_changed`/`notify_appointment_created`, latest in
  `0022_slots_and_mail_keep_their_promises.sql`): the 'rescheduled' status transition only ever queues
  `owner_booking_moved` (suppressed, correct), and the insert only ever queues
  `owner_new_booking`/`owner_approval_needed` (owner-facing, suppressed) plus
  `booking_confirmed`/`booking_held` (customer-facing, correctly left alone so the customer is told
  their appointment moved). Both suppression `UPDATE`s run inside the same transaction as the
  triggering statement, so there's no visibility race with the outbox-draining cron.
- **`TodayPage.tsx`** now calls `rescheduleAppointmentAsOwner` instead of `createAppointmentAsOwner`
  — this is the fix for the "duplicate booking instead of moving it" bug (commit `d6d6781`), and it's
  correctly wired through to the same RPC reviewed above.
- **`AppointmentCard.tsx`**'s "Reschedule" button is now gated to `confirmed`/`pending_approval`
  statuses client-side, matching the server-side `NOT_RESCHEDULABLE` guard in both RPCs — previously
  the button rendered for any status and would always fail server-side for the rest.
- **`snapMinutes` midnight clamp** (`src/lib/calendar.ts`) — correctly stops a drag-drop in the last
  few minutes of the day from rounding up to `1440` ("24:00"), which `new Date(...)` would otherwise
  silently roll into the next day. Test coverage matches the fix precisely.
- **`WeekView`/`DayView` memoization** — `range`/`labels`/`gridHeight` are memoized excluding
  `drag.preview` from the dependency list, and the caller (`CalendarPage.tsx`) does hand them stable
  references (`appointmentsByDate`/`visibleDates` are themselves `useMemo`'d off state, not rebuilt
  every render), so the "don't re-render the whole table on every pointermove" goal the commit message
  states is actually achieved, not just attempted.
- **TypeScript strict mode / advisory-only boundary** — `src/services/assistantService.ts` is
  entirely read-only (every exported function only calls `list*`/`get*` service functions); nothing in
  the diff gives the assistant a write path, consistent with the hard constraint in `CLAUDE.md`.
- No new enum/status value is introduced anywhere in this diff, so Enum & Value Completeness doesn't
  apply. No shell/subprocess code in the diff (not applicable — TypeScript/SQL only).

---

## Informational (non-blocking)

- **(confidence: 4/10)** `src/services/assistantService.ts:70-89` — `suggestOpenSlots` now fetches
  candidate days in batches of `DAY_SLOTS_BATCH_SIZE = 10` via `Promise.all`, rather than stopping the
  instant `limit` is satisfied. If the very first day in a 10-day batch already has enough open slots,
  the other ~9 `listDaySlots` calls still fire. This is a deliberate, documented tradeoff (worst-case
  latency vs. best-case efficiency) rather than a bug — flagging only because it's a real behavior
  change from the strictly-lazy original loop, worth confirming it's the intended tradeoff.
- **(confidence: 3/10, out of the production trust boundary)** `docs/platform-preview.html` — a
  3,600-line rewrite of a static design-preview mockup. It builds significant DOM via string-concatenated
  `innerHTML` (`el.innerHTML = head + body`, etc.); most dynamic fields I spot-checked go through an
  `esc()` helper first, but I did not exhaustively verify every interpolation site. This file is not
  referenced by `vite.config.ts` or anything under `src/`, so it's not part of the deployed PWA and
  carries no live-customer-data risk today. Only worth revisiting if this file is ever wired to real
  data or repurposed as shipped UI.

---

## Summary

2 findings worth acting on before landing, both structural rather than exploitable-today bugs:

1. Revert the in-place edits to `supabase/migrations/0024_*.sql` and `0025_*.sql` — the project's own
   `docs/SCHEMA.md:10` rule exists for exactly this reason, and `0026` already carries the fix
   correctly on its own.
2. Fix the shared `stateRef` in `src/hooks/useAppointmentDrag.ts` so a second concurrent pointer drag
   (touch device, two fingers) can't get its release event resolved against a different appointment's
   drag state.

Everything else reviewed — the three targeted RPC fixes in `0026`, the email-suppression side
effects, the duplicate-booking fix in `TodayPage`, the reschedule-button gating, the midnight-rollover
clamp, and the calendar-grid memoization — checked out correct. Tests (142/142) and `tsc --noEmit`
both pass on the branch as-is.
