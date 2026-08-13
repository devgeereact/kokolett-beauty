# Today Command Center + Payment Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Today page's placeholder "Expected takings" stat (a
sum of `price_pence`, never a real charge) with a real, owner-logged
"Collected today" figure, give the owner a way to log what a customer
actually paid on each appointment card, and give Today itself the
"elevated refresh" visual pass — same terracotta/neutral tokens, richer
type rhythm and density.

**Architecture:** One additive migration adds an append-only `payments`
table and a `log_payment` RPC (owner-only, same shape as the existing
owner RPCs in `0003_owner_ops.sql`), then redefines
`owner_dashboard_summary()` and `appointments_detailed` to read real
payment totals instead of the `price_pence` placeholder. The frontend adds
one new service function and one new card-level UI block, styled to match
the existing owner-note editor exactly (same open/save/collapse shape),
so there's no new interaction pattern for the owner to learn.

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), Supabase CLI, React 18 +
TypeScript strict, Tailwind 3.4.

**Spec:** `docs/superpowers/specs/2026-08-13-today-command-center-payment-log-design.md`

## Global Constraints

- TypeScript strict: no implicit `any`, explicit return types on every
  function and component.
- Import app code via the `@/…` path alias.
- Colour comes from `docs/DESIGN.md` tokens only — never a raw hex value,
  never a Tailwind opacity modifier against a `var()`-based token (they
  don't work — Tailwind 3.4 pinned, see `DESIGN.md` §8).
- Every interactive element needs a visible focus ring and a real
  `<button>`/`<input>` — never `onClick` on a bare `<div>`. Touch targets
  ≥ 44×44px.
- Keep files under 500 lines.
- This codebase does not unit-test presentational components
  (`src/components/dashboard/**`) or the thin RPC-wrapper functions in
  `src/services/*.ts` (`appointmentService.ts` has zero existing tests
  despite nine exported functions) — don't invent tests where the
  established convention has none. This plan adds one more such wrapper
  and one more such component; it doesn't touch `src/lib` or a hook, so
  it adds none.
- Money is integer pence, end to end — a float never crosses a component
  or function boundary. `parseMoney`/`formatMoney` (`src/lib/format.ts`)
  are the only conversion points and already exist; this plan doesn't
  modify them.
- Migrations are numbered and append-only — never edit an applied one.
  This is `0027`.
- **Never `supabase db push` as an automated step.** Validate the
  migration live in a rolled-back transaction (Task 1) — safe by
  construction, nothing persists. Actually pushing `0027` to the live
  database (which holds real bookings) is a deliberate, separate,
  human-approved action outside this plan's task loop. Tasks 2–6 compile
  and typecheck without it; they just won't work end-to-end against the
  live database until a human decides to push.
- No `services.price_pence` / `appointments.price_pence` column changes —
  they stay, unread by anything this plan touches.
- No edit/delete of a logged payment — append-only by design (see spec §4).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0027_payment_log.sql` (new) | `payments` table + RLS, `log_payment` RPC, redefines `owner_dashboard_summary()` and `appointments_detailed` |
| `src/types/database.types.ts` (modify) | Interim hand-shim matching what `supabase gen types` will output once `0027` is pushed: `payments` table, `appointments_detailed.paid_pence`, `Functions.log_payment` |
| `src/types/index.ts` (modify) | `OwnerSummary.today_revenue_pence` → `today_collected_pence`; `BookingErrorCode` gains `'INVALID_AMOUNT'` |
| `src/lib/errors.ts` (modify) | `MESSAGES` gains the `INVALID_AMOUNT` copy |
| `src/services/paymentService.ts` (new) | `logPayment()` — the one RPC wrapper |
| `src/components/dashboard/AppointmentCard.tsx` (modify) | Payment block (mirrors the existing owner-note block) + `onLogPayment` prop |
| `src/pages/dashboard/TodayPage.tsx` (modify) | Wire `onLogPayment` through, rename the stat card, visual polish pass |

---

### Task 1: Migration `0027` — `payments`, `log_payment`, and the two redefined reads

**Files:**

- Create: `supabase/migrations/0027_payment_log.sql`

**Interfaces:**

- Produces: `public.payments` table (`id uuid`, `appointment_id uuid`, `amount_pence int`, `note text`, `recorded_by uuid`, `created_at timestamptz`); `public.log_payment(p_appointment_id uuid, p_amount_pence int, p_note text default null) returns uuid`, `security definer`, callable by `authenticated` only. Task 3's service wrapper calls this by name with these exact parameter names. `owner_dashboard_summary()`'s JSON gains `today_collected_pence` in place of `today_revenue_pence`. `appointments_detailed` gains `paid_pence`.
- Consumes (all pre-existing): `public.is_owner()`, `public.appointments`, `public.staff`, `public.customers`, `public.services`, `public.booking_settings`, `public.availability_requests`, `public.email_messages`.

Error codes raised: `NOT_AUTHORISED` (`42501`, pre-existing), `NOT_FOUND` (`P0001`, pre-existing), `INVALID_AMOUNT` (`P0001`, new — added to `BookingErrorCode`/`MESSAGES` in Task 2).

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================================
-- 0027_payment_log.sql
--
-- What a customer actually paid, logged by the owner after the fact.
-- Fixed pricing is gone from what the owner sees: appointments.price_pence
-- and services.price_pence stay in the schema (booking history references
-- them) but nothing below reads them any more. `payments` is the real
-- figure, entered in the chair.
--
-- Append-only by design: no update/delete RPC. A mis-logged amount is
-- corrected by logging another row, the same way this schema already
-- prefers preserving financial history over mutating it (see customers.
-- deleted_at's soft-delete-for-GDPR-while-keeping-financial-history).
-- One appointment can carry more than one payment row (deposit then
-- balance, say) even though the v1 UI only ever adds one at a time.
-- =====================================================================

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  amount_pence   int not null check (amount_pence > 0),
  note           text,
  recorded_by    uuid not null references public.staff(id),
  created_at     timestamptz not null default now()
);

create index if not exists payments_appointment_id_idx on public.payments (appointment_id);

comment on table public.payments is
  'What the owner actually logged as paid, per appointment. Append-only — a correction is a new row, never an update.';

alter table public.payments enable row level security;

-- Owner-only, same tier as email_messages / ai_recommendations / staff —
-- no anon or customer access, ever.
drop policy if exists payments_owner_all on public.payments;
create policy payments_owner_all on public.payments
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- log_payment -------------------------------------------------

create or replace function public.log_payment(
  p_appointment_id uuid,
  p_amount_pence   int,
  p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.payments (appointment_id, amount_pence, note, recorded_by)
  values (p_appointment_id, p_amount_pence, p_note, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_payment(uuid, int, text) from public, anon;
grant execute on function public.log_payment(uuid, int, text) to authenticated;

-- ---------- owner_dashboard_summary: today_revenue_pence → today_collected_pence

create or replace function public.owner_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz        text;
  v_today     date;
  v_day_start timestamptz;
  v_day_end   timestamptz;
  v_result    jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select timezone into v_tz from public.booking_settings where id;
  v_today     := (now() at time zone v_tz)::date;
  v_day_start := (v_today::timestamp at time zone v_tz);
  v_day_end   := ((v_today + 1)::timestamp at time zone v_tz);

  select jsonb_build_object(
    'today', v_today,
    'timezone', v_tz,
    'today_count', (
      select count(*) from public.appointments a
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
    ),
    'today_collected_pence', (
      select coalesce(sum(p.amount_pence), 0)
      from public.payments p
      join public.appointments a on a.id = p.appointment_id
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('confirmed','checked_in','in_service','completed')
    ),
    'pending_approval_count', (
      select count(*) from public.appointments a where a.status = 'pending_approval'
    ),
    'urgent_approval_count', (
      select count(*) from public.appointments a
      where a.status = 'pending_approval'
        and a.approval_deadline is not null
        and a.approval_deadline < now() + interval '2 hours'
    ),
    'new_request_count', (
      select count(*) from public.availability_requests r where r.status = 'new'
    ),
    'upcoming_7d_count', (
      select count(*) from public.appointments a
      where a.starts_at >= now() and a.starts_at < now() + interval '7 days'
        and a.status in ('pending_approval','confirmed')
    ),
    'active_service_count', (
      select count(*) from public.services s
      where s.is_active and s.archived_at is null
    ),
    'customer_count', (
      select count(*) from public.customers c where c.deleted_at is null
    ),
    'failed_email_count', (
      select count(*) from public.email_messages m where m.status in ('failed','bounced')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.owner_dashboard_summary() from public, anon;
grant execute on function public.owner_dashboard_summary() to authenticated;

-- ---------- appointments_detailed: gains paid_pence ----------------------

create or replace view public.appointments_detailed
with (security_invoker = true) as
select
  a.*,
  c.full_name         as customer_name,
  c.email             as customer_email,
  c.mobile            as customer_mobile,
  c.marketing_consent as customer_marketing_consent,
  s.name              as service_name,
  s.slug              as service_slug,
  s.duration_min      as service_duration_min,
  s.buffer_min        as service_buffer_min,
  (
    select count(*) from public.appointments prior
    where prior.customer_id = a.customer_id
      and prior.status = 'completed'
      and prior.id <> a.id
  ) as customer_completed_count,
  (
    select coalesce(sum(p.amount_pence), 0) from public.payments p
    where p.appointment_id = a.id
  ) as paid_pence
from public.appointments a
join public.customers c on c.id = a.customer_id
join public.services  s on s.id = a.service_id;

comment on view public.appointments_detailed is
  'Owner-facing appointment rows joined to customer and service. security_invoker, so RLS on the base tables governs access. paid_pence sums public.payments — the owner-logged real figure, not the price_pence placeholder.';
```

- [ ] **Step 2: Validate live in a rolled-back transaction**

Per this repo's standing rule: `supabase db query --linked` honours
`begin; … rollback;` and needs no Docker, so the live database validates
this migration with zero persisted side effects. Write this to a scratch
file (paste the full `create table` / `create policy` / `create or
replace function` / `create or replace view` block from Step 1 in place
of the comment below — not `\i`, this repo's proven pattern is to paste
the literal SQL into the transaction, the same way `0024`'s validation
script did).

**Two things a fresh worktree/session needs that a long-lived checkout
might not:**
1. `supabase link --project-ref erqrfjlozqyhogneqraj` first — `supabase/.temp/`
   (where the CLI caches the link) is gitignored, so a fresh worktree
   doesn't inherit it from any other checkout. Confirm the ref matches
   `CLAUDE.md`'s documented `erqrfjlozqyhogneqraj` / `eu-west-2` before
   linking — don't link blind.
2. This installed CLI's `db query` takes SQL as a positional argument or
   `--file`/`-f`, **not `-c`** — if your CLI version differs, `--help` it
   rather than assuming.

**Authenticating the session as the owner.** `supabase db query --linked`
opens a raw `postgres`-role session — `auth.uid()` is `null` there (it
reads `request.jwt.claim.sub`/`request.jwt.claims`, GUCs only PostgREST
ever sets), so every `is_owner()`-gated call in this migration would
otherwise fail `NOT_AUTHORISED` unconditionally, regardless of what's in
`staff`. The fix is to set the same GUC PostgREST would have set, scoped
to this rolled-back transaction only — reusing PostgREST's own mechanism,
not inventing a new one. Verified directly against this project's live
`auth.uid()` source before writing this:
`coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (current_setting('request.jwt.claims', true)::jsonb->>'sub'))::uuid`.
`set_config('request.jwt.claim.sub', <real staff.id>, true)` inside the
`do` block satisfies the first branch.

**Picking a collision-free test time.** The salon is on UTC+1 (BST) right
now, so a UTC offset that looks "off-schedule" against the salon's
09:00–17:00 **local** slot pattern can land exactly on a real one — `current_date
+ interval '10 hours'` (10:00 UTC) is 11:00 BST, one of the published
times, and collided with a real live appointment when this was first
tried. Rather than hand-picking one hour and hoping, the script below
tries a short list of late-evening salon-local candidates in order and
uses whichever one doesn't collide — robust to whatever's actually on the
calendar today without needing to read it first.

```bash
cat > /tmp/0027-validate.sql << 'EOF'
begin;

-- (paste the full create table / create policy / create or replace
--  function / create or replace view block from Step 1 here, verbatim)

do $$
declare
  v_owner_id          uuid;
  v_customer_id       uuid;
  v_service_id        uuid;
  v_appointment_id    uuid;
  v_payment_id        uuid;
  v_summary           jsonb;
  v_paid              int;
  v_candidate_starts  timestamptz[];
  v_starts_at         timestamptz;
  v_inserted          boolean := false;
begin
  select id into v_owner_id from public.staff limit 1;
  if v_owner_id is null then
    raise exception using errcode = '22000', message = 'FAIL: no staff row present to validate as owner';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  insert into public.customers (email, full_name)
  values ('sdd-test-payment-log@example.invalid', 'SDD Test Customer')
  returning id into v_customer_id;

  select id into v_service_id from public.services where is_active limit 1;

  -- Late-evening salon-local candidates today, comfortably after any
  -- realistic closing/walk-in time. Tried in order; the loop below skips
  -- whichever one(s) collide with a real appointment via
  -- appointments_no_overlap, so this doesn't depend on knowing today's
  -- schedule in advance.
  v_candidate_starts := array[
    ((now() at time zone 'Europe/London')::date + time '22:00') at time zone 'Europe/London',
    ((now() at time zone 'Europe/London')::date + time '22:30') at time zone 'Europe/London',
    ((now() at time zone 'Europe/London')::date + time '23:00') at time zone 'Europe/London',
    ((now() at time zone 'Europe/London')::date + time '23:15') at time zone 'Europe/London'
  ];

  foreach v_starts_at in array v_candidate_starts loop
    begin
      insert into public.appointments
        (reference, customer_id, service_id, starts_at, ends_at, status, price_pence, source)
      values
        ('SDDPAYTEST', v_customer_id, v_service_id, v_starts_at, v_starts_at + interval '30 minutes',
         'confirmed', 6500, 'owner')
      returning id into v_appointment_id;
      v_inserted := true;
      exit;
    exception when exclusion_violation then
      null; -- collides with a real appointment; try the next candidate
    end;
  end loop;

  if not v_inserted then
    raise exception using errcode = '22000',
      message = 'FAIL: every candidate test time collided with a real appointment — check the live schedule and add another candidate';
  end if;

  -- Case 1: INVALID_AMOUNT for a non-positive amount.
  begin
    perform public.log_payment(v_appointment_id, 0, 'test');
    raise exception using errcode = '22000', message = 'FAIL: INVALID_AMOUNT was not raised for amount 0';
  exception when sqlstate 'P0001' then
    if position('INVALID_AMOUNT' in sqlerrm) = 0 then
      raise exception using errcode = '22000', message = 'FAIL: wrong error for amount 0: ' || sqlerrm;
    end if;
  end;

  -- Case 2: a real payment is logged and summed correctly across two rows —
  -- proves the append-only "sum, don't overwrite" model actually sums.
  select public.log_payment(v_appointment_id, 4500, 'cash, gave discount') into v_payment_id;
  select public.log_payment(v_appointment_id, 2000, null) into v_payment_id;

  select paid_pence into v_paid from public.appointments_detailed where id = v_appointment_id;
  if v_paid <> 6500 then
    raise exception using errcode = '22000', message = 'FAIL: paid_pence expected 6500, got ' || v_paid;
  end if;

  select public.owner_dashboard_summary() into v_summary;
  if (v_summary->>'today_collected_pence')::int <> 6500 then
    raise exception using errcode = '22000',
      message = 'FAIL: today_collected_pence expected 6500, got ' || (v_summary->>'today_collected_pence');
  end if;

  raise exception using errcode = '22000', message = 'PASS: payments, log_payment, and both redefined reads behave correctly';
end $$;

rollback;
EOF
supabase db query --linked --file /tmp/0027-validate.sql
```

This exercises `NOT_FOUND`'s sibling `INVALID_AMOUNT` guard for real (both
are `is_owner()`-then-validate, so authenticating as the owner exercises
the same code path `NOT_AUTHORISED` would hit if it fired). It does not
separately assert the `NOT_AUTHORISED` branch itself — that would mean
briefly authenticating as a non-owner, which isn't worth the extra
complexity here. Task 7's live manual QA is the backstop for anything this
scoped script doesn't cover.

Expected: output ends with `PASS: payments, log_payment, and both redefined
reads behave correctly` (raised as an error on purpose — a `raise notice`
would not come back through `db query`). Any `FAIL: …` message, or a real
Postgres error before reaching the end of the `do` block, means something
in Step 1's SQL is wrong — fix the migration file and re-run this same
validation file; nothing persists between attempts.

Afterwards, confirm nothing persisted:

Run: `supabase db query --linked "select count(*) from public.customers where email = 'sdd-test-payment-log@example.invalid'"`
Expected: `0` (the rollback removed it).

- [ ] **Step 3: Delete the scratch validation file**

```bash
rm /tmp/0027-validate.sql
```

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/0027_payment_log.sql
git commit -m "feat(db): add payments log and log_payment (migration 0027)"
```

**Do not run `supabase db push`.** That's a deliberate, separate,
human-approved step outside this task — see Global Constraints.

---

### Task 2: Type system catch-up

**Files:**

- Modify: `src/types/database.types.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/errors.ts`

**Interfaces:**

- Consumes: Task 1's `log_payment` signature, `payments` columns, and `appointments_detailed.paid_pence`.
- Produces: `Database['public']['Tables']['payments']`, `Database['public']['Views']['appointments_detailed']['Row']['paid_pence']: number | null`, `Database['public']['Functions']['log_payment']` (so `supabase.rpc('log_payment', …)` typechecks in Task 3); `OwnerSummary.today_collected_pence: number` (replaces `today_revenue_pence`); `BookingErrorCode` gains `'INVALID_AMOUNT'`.

This is an interim hand-edit. `database.types.ts`'s own header comment says
"Regenerate it after every migration" — that's still true, but `0027`
hasn't been pushed live yet (Task 1's Global Constraint), so the real
`supabase gen types` can't run against it yet. This edit matches exactly
what that command will produce once a human pushes `0027`; whoever does
that push should re-run the generator and let it overwrite this block
rather than hand-maintain it going forward.

- [ ] **Step 1: Add the `payments` table to `database.types.ts`**

Find the `Tables` object (starts around line 15, `ai_recommendations: {`).
Add a new entry — anywhere inside `Tables`, alphabetical order matches
what the generator produces but isn't required for correctness:

```ts
      payments: {
        Row: {
          amount_pence: number
          appointment_id: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string
        }
        Insert: {
          amount_pence: number
          appointment_id: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by: string
        }
        Update: {
          amount_pence?: number
          appointment_id?: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 2: Add `paid_pence` to the `appointments_detailed` view**

Find `Views: { appointments_detailed: { Row: {` (around line 884). Add one
line to the `Row` object, next to the existing `owner_note` /
`price_pence` fields (alphabetical, but again not required):

```ts
           owner_note: string | null
           paid_pence: number | null
           price_pence: number | null
```

- [ ] **Step 3: Add `log_payment` to `Functions`**

Find the `Functions` object (around line 960, starts with `add_day_slot:
{`). Add, in the same `{ Args: {...}; Returns: ... }` shape as the
neighbouring entries:

```ts
      log_payment: {
        Args: { p_amount_pence: number; p_appointment_id: string; p_note?: string }
        Returns: string
      }
```

- [ ] **Step 4: Rename the summary field in `src/types/index.ts`**

In the `OwnerSummary` interface (around line 110):

```ts
export interface OwnerSummary {
  today: string;
  timezone: string;
  today_count: number;
  today_collected_pence: number;
  pending_approval_count: number;
  /** Holds inside their final two hours — the ones that need answering now. */
  urgent_approval_count: number;
  new_request_count: number;
  upcoming_7d_count: number;
  active_service_count: number;
  customer_count: number;
  failed_email_count: number;
}
```

- [ ] **Step 5: Add `INVALID_AMOUNT` to `BookingErrorCode`**

In `src/types/index.ts` (around line 162):

```ts
export type BookingErrorCode =
  | 'SERVICE_UNAVAILABLE'
  | 'SLOT_MISALIGNED'
  | 'LEAD_TIME_VIOLATION'
  | 'BEYOND_BOOKING_HORIZON'
  | 'OUTSIDE_AVAILABILITY'
  | 'DAILY_CAPACITY_REACHED'
  | 'SLOT_TAKEN'
  | 'NOT_AUTHORISED'
  | 'NOT_PENDING'
  | 'NOT_FOUND'
  | 'ILLEGAL_TRANSITION'
  | 'NAME_INCOMPLETE'
  | 'MOBILE_REQUIRED'
  | 'NOT_RESCHEDULABLE'
  | 'ALREADY_PASSED'
  | 'SAME_TIME'
  | 'INVALID_AMOUNT';
```

- [ ] **Step 6: Add the message in `src/lib/errors.ts`**

In the `MESSAGES` record (around line 15), add one entry (TypeScript will
refuse to compile `Record<BookingErrorCode, string>` if this is missed,
since `INVALID_AMOUNT` is now part of the union):

```ts
  SAME_TIME: 'That is the time you are already booked in for.',
  INVALID_AMOUNT: 'Enter an amount greater than £0.',
```

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. (Nothing consumes the new fields yet — Tasks 3–5 do —
this step only proves the hand-edit itself is syntactically and
structurally valid.)

- [ ] **Step 8: Commit**

```bash
git add src/types/database.types.ts src/types/index.ts src/lib/errors.ts
git commit -m "feat(types): add payments/log_payment shapes, rename today_revenue_pence"
```

---

### Task 3: `paymentService.logPayment`

**Files:**

- Create: `src/services/paymentService.ts`

**Interfaces:**

- Consumes: `supabase` client (`@/lib/supabase`), `log_payment` RPC from Task 2's type shim.
- Produces: `export async function logPayment(appointmentId: string, amountPence: number, note: string): Promise<void>`. Task 5's `TodayPage` calls this exact signature.

- [ ] **Step 1: Implement**

```ts
import { supabase } from '@/lib/supabase';

/**
 * What the owner actually charged, logged after the fact — there is no
 * fixed price to bill against. Append-only: this always adds a new row,
 * there is no update/delete. `appointments_detailed.paid_pence` sums
 * every row for a booking, so logging a correction is a second call, not
 * an edit of the first.
 */
export async function logPayment(
  appointmentId: string,
  amountPence: number,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('log_payment', {
    p_appointment_id: appointmentId,
    p_amount_pence: amountPence,
    p_note: note.trim() || undefined,
  });

  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/services/paymentService.ts
git commit -m "feat(today): add logPayment service wrapper"
```

---

### Task 4: `AppointmentCard` gains a payment block

**Files:**

- Modify: `src/components/dashboard/AppointmentCard.tsx`

**Interfaces:**

- Consumes: `parseMoney`, `formatMoney` from `@/lib/format` (both pre-existing, unmodified).
- Produces: new optional prop `onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>` on `AppointmentCard`. Task 5's `TodayPage` passes this.

- [ ] **Step 1: Import `parseMoney`/`formatMoney` and `Input`**

Change the existing imports at the top of the file:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input, Textarea } from '@/components/ui/Field';
import { formatDuration, formatMoney, formatTime, parseMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';
```

- [ ] **Step 2: Add the prop and local state**

Add `onLogPayment` to the props interface, mirroring the existing
`onNoteSave` pattern exactly (same optional-prop-gates-the-control shape):

```tsx
export function AppointmentCard({
  appointment,
  timezone,
  onStatusChange,
  onNoteSave,
  onLogPayment,
  onBookFollowUp,
  onMove,
  onReschedule,
  className,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  onStatusChange?: (id: string, status: AppointmentStatus) => Promise<void>;
  /** Owner's private note. Omit to hide the notes control entirely. */
  onNoteSave?: (id: string, note: string) => Promise<void>;
  /** What the customer actually paid. Omit to hide the payment control entirely. */
  onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>;
  /** Opens the booking form with this customer already filled in. */
  onBookFollowUp?: (appointment: AppointmentDetailed) => void;
  /** Opens the Move panel for this appointment. Omit to hide the control. */
  onMove?: (appointment: AppointmentDetailed) => void;
  /** Opens an inline reschedule picker for this appointment. Omit to hide the control. */
  onReschedule?: (appointment: AppointmentDetailed) => void;
  className?: string;
}): JSX.Element {
```

Add state, next to the existing note state:

```tsx
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(appointment.owner_note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
```

- [ ] **Step 3: Add `savePayment`**

Add next to the existing `saveNote` function:

```tsx
  const savePayment = async (): Promise<void> => {
    if (!onLogPayment) return;
    const pence = parseMoney(amountInput);
    if (pence === null) {
      setPaymentError('Enter a valid amount, e.g. 45.00');
      return;
    }
    setPaymentError(null);
    setSavingPayment(true);
    try {
      await onLogPayment(appointment.id, pence, paymentNote);
      setAmountInput('');
      setPaymentNote('');
      setPaymentOpen(false);
    } finally {
      setSavingPayment(false);
    }
  };
```

- [ ] **Step 4: Add the button**

In the actions `<div>`, right after the existing note button and before
`onMove`:

```tsx
            {onNoteSave && (
              <Button size="sm" variant="ghost" onClick={() => setNoteOpen((v) => !v)}>
                {appointment.owner_note ? 'Note ✓' : 'Add note'}
              </Button>
            )}
            {onLogPayment && (
              <Button size="sm" variant="ghost" onClick={() => setPaymentOpen((v) => !v)}>
                {(appointment.paid_pence ?? 0) > 0
                  ? `Paid ${formatMoney(appointment.paid_pence ?? 0)}`
                  : 'Log payment'}
              </Button>
            )}
```

- [ ] **Step 5: Add the payment block**

Right after the existing note block (the one gated on `onNoteSave &&
(noteOpen || appointment.owner_note)`), add a matching block:

```tsx
        {onLogPayment && (paymentOpen || (appointment.paid_pence ?? 0) > 0) && (
          <div className="mt-3 border-t border-border pt-3">
            {paymentOpen ? (
              <>
                <Input
                  aria-label="Amount paid"
                  inputMode="decimal"
                  placeholder="£0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                <Textarea
                  aria-label="Payment note"
                  rows={2}
                  placeholder="Cash, gave 10% off, etc. (optional)"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="mt-2"
                />
                {paymentError && (
                  <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                    {paymentError}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={savingPayment} onClick={() => void savePayment()}>
                    Save payment
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAmountInput('');
                      setPaymentNote('');
                      setPaymentError(null);
                      setPaymentOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  What she agreed in the chair, not a quoted price.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Paid: </span>
                {formatMoney(appointment.paid_pence ?? 0)}
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/AppointmentCard.tsx
git commit -m "feat(today): add payment block to AppointmentCard"
```

---

### Task 5: Wire `TodayPage` — stat rename + payment logging

**Files:**

- Modify: `src/pages/dashboard/TodayPage.tsx`

**Interfaces:**

- Consumes: `logPayment` from `@/services/paymentService` (Task 3), `onLogPayment` prop from `AppointmentCard` (Task 4), `summary.today_collected_pence` (Task 2).

- [ ] **Step 1: Import `logPayment`**

```tsx
import { logPayment } from '@/services/paymentService';
```

- [ ] **Step 2: Add the handler**

Next to the existing `changeStatus` callback:

```tsx
  const logPaymentHandler = useCallback(
    async (id: string, amountPence: number, note: string): Promise<void> => {
      try {
        await logPayment(id, amountPence, note);
        await Promise.all([refresh(), refreshSummary()]);
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [refresh, refreshSummary, showToast],
  );
```

- [ ] **Step 3: Rename the stat**

```tsx
  const stats = [
    { label: 'Booked today', value: summary ? String(summary.today_count) : '—' },
    {
      label: 'Collected today',
      value: summary ? formatMoney(summary.today_collected_pence) : '—',
    },
    {
      label: 'Awaiting approval',
      value: summary ? String(summary.pending_approval_count) : '—',
      to: `${routes.owner.inbox}?tab=approvals`,
      urgent: (summary?.urgent_approval_count ?? 0) > 0,
    },
    {
      label: 'New enquiries',
      value: summary ? String(summary.new_request_count) : '—',
      to: `${routes.owner.inbox}?tab=requests`,
    },
  ];
```

- [ ] **Step 4: Pass the prop**

```tsx
            <AppointmentCard
              appointment={appointment}
              timezone={timezone}
              onStatusChange={changeStatus}
              onLogPayment={logPaymentHandler}
              onBookFollowUp={(a) => {
```

(Leave everything else in that `<AppointmentCard>` call — `onBookFollowUp`
and `onReschedule` — exactly as it is; only the new prop is added.)

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/dashboard/TodayPage.tsx
git commit -m "feat(today): wire payment logging, rename Expected takings to Collected today"
```

---

### Task 6: Visual pass — Today's stat cards and schedule list

**Files:**

- Modify: `src/pages/dashboard/TodayPage.tsx`

**Interfaces:**

- Consumes: nothing new — this task is styling only, no behaviour change. Task 5 must be complete first (this polishes the renamed stat, not the old one).

This is the "elevated refresh" the owner asked for — `docs/DESIGN.md`
tokens only, no new colours, no new dependency. Two blocks change: the
stat-card grid (currently `<div className="mb-6 grid grid-cols-2 gap-3
lg:grid-cols-4">…`) and the schedule list (`<div className="space-y-3">…`
wrapping the `<AppointmentCard>` map).

- [ ] **Step 1: Pull a concrete reference**

Invoke the `ui-ux-pro-max` skill for a dashboard stat-card / schedule-list
pattern matching "warm neutral, terracotta accent, dense owner dashboard,
elevated minimal" — this project already has 67 styles and 25 chart/stat
patterns indexed; don't invent spacing/hierarchy choices from scratch.
Then invoke `ui-styling` for how to express the returned pattern in
Tailwind 3.4 + the existing token set (`bg-card`, `text-foreground`,
`border-border`, `text-primary`, etc. — never a raw hex, never an
opacity modifier against a `var()` token).

- [ ] **Step 2: Apply it**

Translate whatever the skills return into edits on the two blocks named
above. At minimum — if the skills return nothing more specific than
this, apply it as the floor, not a placeholder to skip:

- Stat values step up a size at the `sm:` breakpoint (`text-2xl` →
  `text-2xl sm:text-3xl`) so the headline numbers read at a glance from
  across the salon.
- The "Collected today" card gets a `border-t-2 border-t-primary` accent
  (reusing the existing `primary` token — the terracotta brand colour —
  not a new one), since it's the one card that's genuinely money moving
  through the business today.
- The "Awaiting approval" card's existing `urgent` state
  (`border-status-pending`-style treatment) stays exactly as is — don't
  regress the urgency signal while restyling around it.
- Schedule list rhythm tightens from `space-y-3` to `space-y-2` between
  `AppointmentCard`s, and the "Today's schedule" heading's bottom margin
  grows from `mb-3` to `mb-4` — more cards readable per scroll, clearer
  separation from the stat row above.

Every touch target stays ≥ 44×44px and every focus ring stays visible —
these are `docs/DESIGN.md` §7 constraints, not new ones, so nothing about
this task should touch `Button`, `Card`, or `Input`'s own focus/size
styling; only the layout classNames on `TodayPage.tsx` itself.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dashboard/TodayPage.tsx
git commit -m "style(today): elevated refresh pass on stat cards and schedule list"
```

---

### Task 7: Full gate, and the human-approved push

**Files:** none (verification only).

- [ ] **Step 1: Full build and test gate**

```bash
npm run build && npm test
```

Expected: both pass. `build` runs `tsc --noEmit` again (project-wide, not
just the files this plan touched) followed by the Vite production build;
`test` runs the existing Vitest suite — nothing in this plan added a new
test file (Global Constraints), so this confirms the change didn't break
any of the existing ones (`format.test.ts`, `useSalonToday.test.ts`,
`InboxPage.test.tsx`, etc.).

- [ ] **Step 2: Manual QA, once a human has pushed `0027`**

This step needs migration `0027` actually live — that push is the one
deliberate, human-approved action this plan doesn't take itself (Global
Constraints). Once it's been pushed:

1. Open `/dashboard` (Today). Confirm "Collected today" renders `£0.00`
   (or the real running total, if anything's already been logged today)
   instead of the old "Expected takings" figure.
2. On any appointment card, click "Log payment", enter an amount and an
   optional note, save. Confirm the button becomes "Paid £X.XX" and the
   "Collected today" stat updates without a manual page refresh (the
   realtime → `refreshSummary()` path Task 5 wired is the same one
   `changeStatus` already used, untouched by this plan).
3. Click "Log payment" again on the same card, log a second amount.
   Confirm "Paid £X.XX" now shows the **sum** of both, proving the
   append-only model (§4 of the spec) actually sums rather than
   overwrites.
4. Try saving with an empty or non-numeric amount. Confirm the inline
   "Enter a valid amount…" message appears and nothing is sent to the
   server (this is `parseMoney` returning `null`, caught client-side
   before `log_payment` is ever called).

- [ ] **Step 3: Push, when a human is ready**

```bash
supabase db push --linked
supabase gen types typescript --project-id erqrfjlozqyhogneqraj --schema public \
  > src/types/database.types.ts
```

Then re-run `npx tsc --noEmit` — it should still be clean, and Task 2's
hand-shim in `database.types.ts` is now superseded by the real generated
file (the regenerated file will very likely reorder keys and may adjust
formatting; that's expected and fine).
