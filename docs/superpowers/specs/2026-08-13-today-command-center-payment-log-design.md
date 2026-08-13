# Today command center + payment log — design spec

**Date:** 2026-08-13
**Status:** Approved, pending implementation plan
**Scope:** Sub-project 1 of 2 in the Owner Console rebrand. Sub-project 2
(same visual system on the rest of the nav — Inbox, Customers, Calendar,
Services, Settings — plus purging remaining price references from
customer-facing pages, emails, and PRD copy) is deferred, matching the
owner's own "same style as follow-up to other nav" framing.

## 1. Why

Owner asked to rebrand the Owner Console, starting with Today, using the
gstack `/ui-ux-pro-max` + `/ui-styling` skills, and to remove fixed pricing
from the project entirely: the owner charges whatever she agrees in the
chair, and wants a section to log what was actually paid instead of a
quoted price.

The codebase already leans this direction. `AppointmentCard.tsx` already
carries the comment: "No price is shown. What the appointment cost is
agreed in the chair and the stored figure is a placeholder." What's missing
is the other half — nowhere records what was *actually* charged, so
`owner_dashboard_summary()`'s `today_revenue_pence` sums a placeholder
(`appointments.price_pence`, snapshotted at booking) and calls it "Expected
takings" on the Today page. This spec replaces that placeholder sum with a
real, owner-entered figure.

`kokolett-rebrand-direction` (memory, 2026-08-13): the visual direction is
an **elevated refresh** of the existing terracotta/cool-neutral identity in
`docs/DESIGN.md` — richer type rhythm, better spacing/density, real
interactivity — not a new palette. A prior HTML prototype
(`claude.ai/code/artifact/bf374095…`) explored this for 12 dashboard
sections including Today; it's a visual reference only, not something to
port directly (it also still sums a `price` field on Reports — a stale
assumption this spec doesn't inherit).

## 2. Non-goals

- No change to `services.price_pence` or `appointments.price_pence`
  columns. They stay, unused by the stat this spec touches — dropping
  columns from a live table with booking history is destructive and out of
  scope for a "start with Today" ask. Sub-project 2 decides their fate once
  every customer-facing price reference is audited.
- No restyle of any nav item besides Today.
- No payment method field (cash/card/transfer) — owner chose amount + note
  only.
- No edit/delete of a logged payment — see §4, append-only by design.
- No blocking modal on "Mark complete" — owner's existing one-press
  completion flow is untouched; payment logging is a separate, optional
  step. See §3.

## 3. Approach — payment capture

Logging a payment is decoupled from status changes. `AppointmentCard.tsx`'s
`NEXT_ACTIONS`/`ACTION_LABELS` machinery (unchanged) still flips status in
one press — the file's own comment already states why: "forcing three taps
per customer to record something that already happened is how a diary
stops being kept." A blocking "enter amount before you can complete"
modal would reintroduce exactly that problem, so it's rejected. A payment
control that only appears with no prompt at all was also considered and
rejected — it's the easiest thing to forget on a twelve-hour day.

Instead: a payment block on every card, styled and behaviourally identical
to the existing owner-note block (`Add note` → open textarea → `Save note`
→ collapses to `Note ✓`). Same interaction shape, so no new pattern for the
owner to learn: `Log payment` → open amount + note fields → `Save payment`
→ collapses to `Paid £45.00` (sum, if more than one row exists).

## 4. Data model

New migration `0027_payment_log.sql`. Additive only — no changes to
`0002`/`0003`'s columns or functions beyond `owner_dashboard_summary`
(redefined via `create or replace`, the same mechanism `0009` already used
on `book_appointment`; this is a new migration, not an edit to an applied
one).

### `payments`

| Column          | Type            | Notes                                   |
| --------------- | --------------- | ---------------------------------------- |
| `id`             | uuid PK         |                                          |
| `appointment_id` | uuid → appointments | `on delete restrict` — matches this schema's convention of never orphaning financial history |
| `amount_pence`   | int             | `check (amount_pence > 0)`              |
| `note`           | text            | nullable                                |
| `recorded_by`    | uuid → staff    | not null                                |
| `created_at`     | timestamptz     | default `now()`                          |

Deliberately one-to-many, not one-to-one: v1 UI logs one amount per
appointment, but nothing stops a deposit-then-balance flow later without a
migration. **Append-only** — no `update`/`delete` RPC. A mis-logged amount
gets corrected by logging another row (possibly negative-offsetting is
*not* supported in v1 — a genuine correction is a conversation, not a UI
problem this spec solves); the card shows the sum. This mirrors the
schema's existing bias toward preserving financial history rather than
mutating it (see `customers.deleted_at`'s comment on preserving financial
history through GDPR erasure).

RLS: owner-only `ALL`, via `is_owner()` — same tier as `email_messages`,
`ai_recommendations`, `staff`. No anon or customer access, ever: a customer
must never see what they were charged reflected back at them differently
than what was agreed in the chair.

### `log_payment(p_appointment_id uuid, p_amount_pence int, p_note text)`

`security definer`, `is_owner()` guard, `execute` revoked from `anon` —
same shape as `approve_appointment`/`create_appointment_as_owner` in
`0003`. Validates `p_amount_pence > 0` (`INVALID_AMOUNT` on failure) and
that the appointment exists. Returns the new payment id.

### `owner_dashboard_summary()` — redefined

`today_revenue_pence` (sum of `appointments.price_pence`, a placeholder)
becomes **`today_collected_pence`** (sum of `payments.amount_pence` joined
to appointments in today's window). The JSON key is renamed, not just the
value swapped — the meaning changed from "what was quoted" to "what was
actually taken", and a stale key name inviting the old assumption back in
six months is worse than the small client-side rename now.

### `appointments_detailed` — redefined

Gains `paid_pence` (`coalesce(sum(payments.amount_pence), 0)`, lateral or
subquery) so each card can render its own logged total without a second
round trip. This view is `security_invoker` and already owner-scoped in
practice (RLS on `payments` returns nothing to anon/customer regardless).

## 5. Components

- **`src/services/paymentService.ts`** (new) — one function, `logPayment(appointmentId, amountPence, note)`, calling the RPC. Mirrors the shape of existing functions in `appointmentService.ts`.
- **`AppointmentCard.tsx`** — new `onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>` prop, omit to hide (same convention as `onNoteSave`). New payment block, same structure/spacing as the existing note block. Amount entered as pounds-and-pence text, converted to integer pence before calling `onLogPayment` — never floats past the component boundary.
- **`TodayPage.tsx`** — the "Expected takings" stat becomes "Collected today", reading `summary.today_collected_pence`. `onLogPayment` wired through to `AppointmentCard`, calling `paymentService.logPayment` then `refresh()` + `refreshSummary()` (same pattern `changeStatus` already uses).
- **Types** — `OwnerDashboardSummary` (or wherever that shape lives in `src/types`) — rename field; `AppointmentDetailed` gains `paid_pence: number`.
- **Visual pass** — stat cards and schedule list restyled using `/ui-ux-pro-max` (hierarchy/spacing reference) and `/ui-styling` (Tailwind/shadcn execution) against the *existing* `docs/DESIGN.md` tokens. No new colours. WCAG 2.2 AA and 44×44px touch targets (already-standing constraints) carry over unchanged.

## 6. Testing

- Vitest: `paymentService.logPayment` call shape; `AppointmentCard`'s payment block render + interaction (open/save/collapse), following the existing test file conventions (`InboxPage.test.tsx`, `format.test.ts`).
- `0027_payment_log.sql` validated against the live database in a rolled-back transaction before being applied for real (standing practice — see `[[validate-sql-against-live-in-a-rolled-back-transaction]]`).
- Manual: mark an appointment complete, log a payment, confirm "Collected today" updates without a manual page refresh (the realtime → `refreshSummary()` path is already wired and untouched by this change).

## 7. Error handling

No new error plumbing. `log_payment`'s named failures (`NOT_AUTHORISED`,
`INVALID_AMOUNT`) surface through the same `errorMessage()` + toast pattern
`TodayPage.tsx` already uses for every other owner action.
