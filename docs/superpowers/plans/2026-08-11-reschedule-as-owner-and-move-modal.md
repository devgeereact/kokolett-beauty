# Reschedule As Owner + Move Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the owner a keyboard-operable way to move a booked appointment
to a new date/time from the Calendar page — a new DB function
(`reschedule_appointment_as_owner`), its service wrapper, and a small inline
"Move" panel wired into the existing `AppointmentCard` detail view. No drag
yet — that's a separate follow-on plan once this RPC exists to drag onto.

**Architecture:** Retire-and-recreate at the DB layer, mirroring
`customer_reschedule_appointment` (migration `0022`) so the existing
insert-trigger chain (`notify_appointment_created` → `rescheduled_mail`)
handles reminders and the customer email for free, with one owner-specific
addition (auto-publish the destination time) and one owner-specific
suppression (the owner doesn't need an email about her own action). At the
frontend, a new `MoveAppointmentPanel` reuses `listDaySlots` (already built)
to show a target day's free times as buttons — no calendar library, no new
modal/dialog primitive, matching this codebase's existing inline-expanding-
panel convention (`AppointmentCard`'s note editor, `DayPanel`'s fill-a-range
panel).

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), Supabase CLI, React 18 +
TypeScript strict.

## Global Constraints

- TypeScript strict: no implicit `any`, explicit return types on every
  function and component.
- Import app code via the `@/…` path alias.
- Colour comes from design tokens only — never a raw hex value, never a
  Tailwind opacity modifier against a `var()`-based token.
- Every interactive element needs a visible focus ring and a real
  `<button>`/`<a>`/`<input>` — never `onClick` on a bare `<div>`.
- Keep files under 500 lines.
- This codebase does not unit-test presentational components
  (`src/components/dashboard/**`) or the thin RPC-wrapper functions in
  `src/services/*.ts` (`appointmentService.ts` has zero existing tests
  despite nine exported functions) — don't invent tests where the
  established convention has none. Pure logic in `src/lib` and hooks in
  `src/hooks` do get real tests; this plan doesn't touch either.
- Money is integer pence. Time is UTC in storage, `Europe/London` (via the
  salon's `timezone` setting) on screen — every appointment time render
  goes through `formatTime()`/`toSalonDate()`/`minutesSinceMidnight()`,
  never a raw ISO substring.
- Booking writes go through a named RPC, never a direct client insert —
  this plan adds one (`reschedule_appointment_as_owner`), it doesn't bypass
  the pattern.
- Migrations are numbered and append-only — never edit an applied one, this
  is `0024`.
- **Never `supabase db push` as an automated step.** Validate the migration
  live in a rolled-back transaction (Task 1) — that's safe by construction,
  nothing persists. Actually pushing the migration to the live database is
  a deliberate, human-approved action outside this plan's task loop (the
  owner's real bookings live there); the plan's frontend tasks (2-5) compile
  and typecheck without it, they just won't work end-to-end until a human
  decides to push.

---

## File Structure

| File                                                                 | Responsibility                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `supabase/migrations/0024_reschedule_appointment_as_owner.sql` (new) | The `reschedule_appointment_as_owner` DB function                                           |
| `src/services/appointmentService.ts` (modify)                        | Add `rescheduleAppointmentAsOwner` wrapper                                                  |
| `src/components/dashboard/AppointmentCard.tsx` (modify)              | Add optional `onMove` prop + "Move" button, mirroring the existing `onBookFollowUp` pattern |
| `src/components/dashboard/calendar/MoveAppointmentPanel.tsx` (new)   | Date picker + that date's free times + confirm/cancel                                       |
| `src/pages/dashboard/CalendarPage.tsx` (modify)                      | Wire `onMove` → open the panel; `onMoved` → reload + close                                  |

---

### Task 1: Migration `0024` — `reschedule_appointment_as_owner`, written and validated live

**Files:**

- Create: `supabase/migrations/0024_reschedule_appointment_as_owner.sql`

**Interfaces:**

- Produces: `public.reschedule_appointment_as_owner(p_appointment_id uuid, p_new_starts_at timestamptz) returns table (appointment_id uuid, reference text)`, `security definer`, callable by `authenticated` only. Task 2's service wrapper calls this by name with these exact parameter names.
- Consumes (all pre-existing, read-only from this migration's perspective): `public.is_owner()`, `public.hair_appointment()`, `public.generate_booking_reference()`, `public.booking_settings`, `public.availability_slots` (`on_date date`, `starts_at time`, unique on `(on_date, starts_at)`), `public.appointments`, `public.email_messages`, and the existing triggers `notify_appointment_created`/`rescheduled_mail`/`appointments_no_overlap` (fire automatically on the `insert` this function performs — not called directly).

Error codes raised, all pre-existing in `src/types/index.ts`'s `BookingErrorCode` and `src/lib/errors.ts`'s `MESSAGES` map — no frontend error-copy changes needed: `NOT_AUTHORISED`, `NOT_FOUND`, `NOT_RESCHEDULABLE`, `ALREADY_PASSED`, `SAME_TIME`, `SLOT_TAKEN`.

- [ ] **Step 1: Write the migration file**

```sql
-- =====================================================================
-- 0024_reschedule_appointment_as_owner.sql
--
-- Drag-to-reschedule's write path (the drag itself is a later plan — this
-- is what actually moves the appointment once it lands).
--
-- Retire-and-recreate, mirroring customer_reschedule_appointment (0022)
-- rather than an in-place UPDATE. notify_appointment_status_changed only
-- reacts to a status change ("if new.status = old.status then return
-- new"), so an in-place starts_at-only update would never fire it — this
-- function would have to hand-roll reminder cancellation and a customer
-- email a second time. Retire-and-recreate instead reuses the existing
-- insert-trigger chain (notify_appointment_created queues the mail and
-- reminders, rescheduled_mail rewrites it to the booking_rescheduled
-- template) and its proven "restore the old row if the new insert
-- collides" safety property.
--
-- Two differences from the customer path:
--   1. Auto-publishes the destination time instead of rejecting
--      OUTSIDE_AVAILABILITY — the owner declaring a new time on her own
--      calendar IS her publishing that availability, the same reasoning
--      create_appointment_as_owner already applies to the approval gate.
--   2. No SLOT_MISALIGNED / LEAD_TIME_VIOLATION / BEYOND_BOOKING_HORIZON
--      checks — create_appointment_as_owner (0011) already establishes
--      that owner-authenticated writes skip customer-protection guards
--      and check only that things exist and don't collide.
-- =====================================================================

create or replace function public.reschedule_appointment_as_owner(
  p_appointment_id uuid,
  p_new_starts_at  timestamptz
)
returns table (appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old        public.appointments%rowtype;
  v_settings   public.booking_settings%rowtype;
  v_service    public.services%rowtype;
  v_local_date date;
  v_local_time time;
  v_ref        text;
  v_id         uuid;
  v_deadline   timestamptz;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;
  select * into v_service  from public.hair_appointment();

  select * into v_old from public.appointments where id = p_appointment_id;
  if v_old.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only a booking that is still going to happen can be moved — the same
  -- restriction customer_reschedule_appointment enforces, for the same
  -- reason: this guards data integrity (don't "reschedule" history, don't
  -- silently no-op), it isn't a customer-only courtesy.
  if v_old.status not in ('pending_approval', 'confirmed') then
    raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001';
  end if;
  if v_old.starts_at < now() then
    raise exception 'ALREADY_PASSED' using errcode = 'P0001';
  end if;
  if p_new_starts_at = v_old.starts_at then
    raise exception 'SAME_TIME' using errcode = 'P0001';
  end if;

  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_new_starts_at at time zone v_settings.timezone)::time;

  insert into public.availability_slots (on_date, starts_at)
  values (v_local_date, v_local_time)
  on conflict (on_date, starts_at) do nothing;

  -- A still-pending booking gets a deadline measured from the move, against
  -- the time it was actually moved to — copying the old deadline forward
  -- would often already be past the new date (the 0022 fix, mirrored here).
  if v_old.status = 'pending_approval' then
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_new_starts_at);
  else
    v_deadline := null;
  end if;

  v_ref := public.generate_booking_reference();

  -- Retire the old one first — it has to stop occupying the calendar
  -- before the new row is inserted, or moving to an adjacent time would
  -- collide with itself through the overlap constraint.
  update public.appointments
     set status = 'rescheduled',
         cancellation_reason = 'Moved by the salon'
   where id = p_appointment_id;

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, owner_note, source, status, requires_approval,
       approval_deadline, approved_at, rescheduled_from)
    values
      (v_ref, v_old.customer_id, v_service.id, p_new_starts_at,
       p_new_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, p_appointment_id)
    returning id into v_id;
  exception when exclusion_violation then
    -- Somebody else's slot appeared in the gap. Put the old booking back —
    -- losing an appointment because a reschedule half-failed would be far
    -- worse than the move simply not happening.
    update public.appointments
       set status = v_old.status, cancellation_reason = v_old.cancellation_reason
     where id = p_appointment_id;
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  -- notify_appointment_created (fired by the insert above) just queued an
  -- owner_new_booking / owner_approval_needed email addressed to the
  -- owner about her own action. She was looking at the calendar; she does
  -- not need telling.
  update public.email_messages
     set status = 'failed', last_error = 'Rescheduled by the salon'
   where appointment_id = v_id
     and status = 'queued'
     and template in ('owner_new_booking', 'owner_approval_needed');

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.reschedule_appointment_as_owner(uuid, timestamptz)
  from public, anon;
grant execute on function public.reschedule_appointment_as_owner(uuid, timestamptz)
  to authenticated;
```

- [ ] **Step 2: Validate live in a rolled-back transaction**

Per this repo's standing rule: the Supabase CLI's `db query --linked` honours
`begin; … rollback;` and needs no Docker, so the live database can validate
this function with zero persisted side effects — not even the queued test
emails survive, because the rollback undoes them before the send-emails
worker could ever see them.

Write this to a scratch file (e.g. `/tmp/0024-validate.sql` — not committed,
delete it when done):

```sql
begin;

-- (paste the full CREATE FUNCTION / REVOKE / GRANT block from Step 1 here)

do $$
declare
  v_customer    uuid;
  v_service     uuid;
  v_old_id      uuid;
  v_taken_id    uuid;
  v_old_start   timestamptz := (current_date + interval '3 days') + interval '10 hours';
  v_new_start   timestamptz := (current_date + interval '3 days') + interval '14 hours';
  v_taken_start timestamptz := (current_date + interval '4 days') + interval '10 hours';
  v_result_id   uuid;
  v_result_ref  text;
begin
  select id into v_service from public.hair_appointment();

  insert into public.customers (email, full_name, mobile)
  values ('sdd-test-reschedule@example.invalid', 'SDD Test Customer', '07000000000')
  returning id into v_customer;

  insert into public.availability_slots (on_date, starts_at)
  values (v_old_start::date, v_old_start::time) on conflict do nothing;

  insert into public.appointments
    (reference, customer_id, service_id, starts_at, ends_at, price_pence, source, status)
  values
    ('SDDTEST1', v_customer, v_service, v_old_start, v_old_start + interval '1 hour',
     0, 'owner', 'confirmed')
  returning id into v_old_id;

  -- Case 1: reschedule onto an UNPUBLISHED time — must succeed and auto-publish
  select appointment_id, reference into v_result_id, v_result_ref
    from public.reschedule_appointment_as_owner(v_old_id, v_new_start);

  if v_result_id is null then
    raise exception using errcode = '22000', message = 'FAIL: reschedule returned no id';
  end if;
  if not exists (
    select 1 from public.availability_slots
     where on_date = v_new_start::date and starts_at = v_new_start::time
  ) then
    raise exception using errcode = '22000', message = 'FAIL: destination time was not auto-published';
  end if;
  if not exists (select 1 from public.appointments where id = v_old_id and status = 'rescheduled') then
    raise exception using errcode = '22000', message = 'FAIL: old row was not retired';
  end if;
  if not exists (
    select 1 from public.appointments
     where id = v_result_id and starts_at = v_new_start and status = 'confirmed'
  ) then
    raise exception using errcode = '22000', message = 'FAIL: new row is wrong';
  end if;
  if exists (
    select 1 from public.email_messages
     where appointment_id = v_result_id
       and template in ('owner_new_booking', 'owner_approval_needed')
       and status = 'queued'
  ) then
    raise exception using errcode = '22000', message = 'FAIL: owner spam email was not suppressed';
  end if;
  if not exists (
    select 1 from public.email_messages
     where appointment_id = v_result_id and template = 'booking_rescheduled' and status = 'queued'
  ) then
    raise exception using errcode = '22000', message = 'FAIL: customer was not queued a booking_rescheduled email';
  end if;

  -- Case 2: SLOT_TAKEN — moving a second appointment onto the now-occupied v_new_start
  insert into public.availability_slots (on_date, starts_at)
  values (v_taken_start::date, v_taken_start::time) on conflict do nothing;
  insert into public.appointments
    (reference, customer_id, service_id, starts_at, ends_at, price_pence, source, status)
  values
    ('SDDTEST2', v_customer, v_service, v_taken_start, v_taken_start + interval '1 hour',
     0, 'owner', 'confirmed')
  returning id into v_taken_id;

  begin
    perform * from public.reschedule_appointment_as_owner(v_taken_id, v_new_start);
    raise exception using errcode = '22000', message = 'FAIL: SLOT_TAKEN was not raised';
  exception when sqlstate 'P0001' then
    if position('SLOT_TAKEN' in sqlerrm) = 0 then
      raise exception using errcode = '22000', message = 'FAIL: wrong error for taken slot: ' || sqlerrm;
    end if;
  end;
  if not exists (select 1 from public.appointments where id = v_taken_id and status = 'confirmed') then
    raise exception using errcode = '22000', message = 'FAIL: taken-slot appointment was not restored after collision';
  end if;

  -- Case 3: NOT_RESCHEDULABLE — a completed appointment cannot move
  update public.appointments set status = 'completed' where id = v_taken_id;
  begin
    perform * from public.reschedule_appointment_as_owner(v_taken_id, v_new_start + interval '1 day');
    raise exception using errcode = '22000', message = 'FAIL: NOT_RESCHEDULABLE was not raised';
  exception when sqlstate 'P0001' then
    if position('NOT_RESCHEDULABLE' in sqlerrm) = 0 then
      raise exception using errcode = '22000', message = 'FAIL: wrong error for completed appointment: ' || sqlerrm;
    end if;
  end;

  raise exception using errcode = '22000', message = 'PASS: reschedule_appointment_as_owner behaves correctly';
end $$;

rollback;
```

Run: `supabase db query --linked --file /tmp/0024-validate.sql`

Expected: the command's output ends with `PASS: reschedule_appointment_as_owner
behaves correctly` (raised as an error on purpose — see this repo's rule on
why the pass message must be an error, not a notice). Any `FAIL: …` message,
or a real Postgres error before reaching the end of the `do` block, means
something in Step 1's SQL is wrong — fix the migration file and re-run this
same validation file (it's a scratch file, editing and rerunning is free;
nothing has persisted from the previous attempt).

Afterwards, confirm nothing persisted:

Run: `supabase db query --linked -c "select count(*) from public.customers where email = 'sdd-test-reschedule@example.invalid'"`
Expected: `0` (the rollback removed it).

- [ ] **Step 3: Delete the scratch validation file**

```bash
rm /tmp/0024-validate.sql
```

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/0024_reschedule_appointment_as_owner.sql
git commit -m "feat(db): add reschedule_appointment_as_owner (migration 0024)"
```

**Do not run `supabase db push`.** That's a deliberate, separate, human-approved
step outside this task — see Global Constraints.

---

### Task 2: `rescheduleAppointmentAsOwner` service wrapper

**Files:**

- Modify: `src/services/appointmentService.ts`

**Interfaces:**

- Consumes: `BookingResult` type from `@/types` (existing).
- Produces: `export async function rescheduleAppointmentAsOwner(id: string, newStartsAt: Date): Promise<Pick<BookingResult, 'appointment_id' | 'reference'>>`. Task 4's `MoveAppointmentPanel` calls this exact signature.

- [ ] **Step 1: Implement**

Add to `src/services/appointmentService.ts`, near `createAppointmentAsOwner`
(same array-or-object response handling that function already uses, for the
same reason — a Postgres function returning `table (...)` can come back as
either shape depending on the client version):

```ts
/**
 * Move a booked appointment to a new time. Retire-and-recreate under the
 * hood (migration 0024) — the returned id and reference belong to the new
 * row, not the one that was there before.
 */
export async function rescheduleAppointmentAsOwner(
  id: string,
  newStartsAt: Date,
): Promise<Pick<BookingResult, 'appointment_id' | 'reference'>> {
  const { data, error } = await supabase.rpc('reschedule_appointment_as_owner', {
    p_appointment_id: id,
    p_new_starts_at: newStartsAt.toISOString(),
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('NOT_FOUND');
  return row;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. (This will typecheck fine even though migration `0024`
hasn't been pushed live yet — `supabase.rpc()` takes the function name as a
string, there's no compile-time coupling to the live schema.)

- [ ] **Step 3: Commit**

```bash
git add src/services/appointmentService.ts
git commit -m "feat(calendar): add rescheduleAppointmentAsOwner service wrapper"
```

---

### Task 3: `AppointmentCard` gains a "Move" action

**Files:**

- Modify: `src/components/dashboard/AppointmentCard.tsx`

**Interfaces:**

- Produces: new optional prop `onMove?: (appointment: AppointmentDetailed) => void` on `AppointmentCard`. Task 5's `CalendarPage` passes this to open `MoveAppointmentPanel`.

- [ ] **Step 1: Implement**

In `src/components/dashboard/AppointmentCard.tsx`, add `onMove` to the props
interface, mirroring the existing `onBookFollowUp` pattern exactly (same
optional-prop-gates-the-button shape):

```tsx
export function AppointmentCard({
  appointment,
  timezone,
  onStatusChange,
  onNoteSave,
  onBookFollowUp,
  onMove,
  className,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  onStatusChange?: (id: string, status: AppointmentStatus) => Promise<void>;
  /** Owner's private note. Omit to hide the notes control entirely. */
  onNoteSave?: (id: string, note: string) => Promise<void>;
  /** Opens the booking form with this customer already filled in. */
  onBookFollowUp?: (appointment: AppointmentDetailed) => void;
  /** Opens the Move panel for this appointment. Omit to hide the control. */
  onMove?: (appointment: AppointmentDetailed) => void;
  className?: string;
}): JSX.Element {
```

Add the button inside the existing actions `<div>` (the one that already
renders the note/follow-up buttons), right after the note button and before
"Book follow-up":

```tsx
{
  onNoteSave && (
    <Button size="sm" variant="ghost" onClick={() => setNoteOpen((v) => !v)}>
      {appointment.owner_note ? 'Note ✓' : 'Add note'}
    </Button>
  );
}
{
  onMove && (
    <Button size="sm" variant="ghost" onClick={() => onMove(appointment)}>
      Move
    </Button>
  );
}
{
  /* The best moment to book the next one is while this one is still
    in front of her, so the action lives on the booking itself. */
}
{
  onBookFollowUp && (
    <Button size="sm" variant="ghost" onClick={() => onBookFollowUp(appointment)}>
      Book follow-up
    </Button>
  );
}
```

Only offer Move for a status that's actually reschedulable — reuse the
file's existing `actions` derivation pattern rather than inventing a second
one. Change the button's guard to also check status:

```tsx
{
  onMove &&
    (appointment.status === 'confirmed' || appointment.status === 'pending_approval') && (
      <Button size="sm" variant="ghost" onClick={() => onMove(appointment)}>
        Move
      </Button>
    );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AppointmentCard.tsx
git commit -m "feat(calendar): add Move action to AppointmentCard"
```

---

### Task 4: `MoveAppointmentPanel`

**Files:**

- Create: `src/components/dashboard/calendar/MoveAppointmentPanel.tsx`

**Interfaces:**

- Consumes: `listDaySlots` and `OwnerDaySlot` from `@/services/availabilityService` (existing); `rescheduleAppointmentAsOwner` from `@/services/appointmentService` (Task 2); `errorMessage` from `@/lib/errors` (existing — already maps every error code this RPC can raise, see Task 1); `toSalonDate` from `@/lib/format` (existing); `Input`, `Button`, `Card` from `@/components/ui/*` (existing).
- Produces:

  ```ts
  export interface MoveAppointmentPanelProps {
    appointment: AppointmentDetailed;
    timezone: string;
    onClose: () => void;
    onMoved: () => void;
  }
  export function MoveAppointmentPanel(props: MoveAppointmentPanelProps): JSX.Element;
  ```

  Task 5's `CalendarPage` renders this exact component with these exact props.

- [ ] **Step 1: Implement**

```tsx
// src/components/dashboard/calendar/MoveAppointmentPanel.tsx
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import { listDaySlots, type OwnerDaySlot } from '@/services/availabilityService';
import { rescheduleAppointmentAsOwner } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { toSalonDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

export interface MoveAppointmentPanelProps {
  appointment: AppointmentDetailed;
  timezone: string;
  onClose: () => void;
  onMoved: () => void;
}

/**
 * The keyboard-operable path to a reschedule — no drag required. Picks a
 * date, then one of that date's currently-published free times, same data
 * `DayPanel` already shows the owner for publishing.
 */
export function MoveAppointmentPanel({
  appointment,
  timezone,
  onClose,
  onMoved,
}: MoveAppointmentPanelProps): JSX.Element {
  const [date, setDate] = useState(() => toSalonDate(appointment.starts_at, timezone));
  const [slots, setSlots] = useState<OwnerDaySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OwnerDaySlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setSelected(null);
    try {
      setSlots(await listDaySlots(date));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const freeSlots = slots.filter((s) => !s.is_booked && !s.is_past);

  const confirm = async (): Promise<void> => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleAppointmentAsOwner(appointment.id, new Date(selected.starts_at));
      onMoved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-foreground">
          Move {appointment.customer_name ?? 'this appointment'}&rsquo;s time
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <label htmlFor="move-date" className="mb-1 block text-xs text-muted-foreground">
        New date
      </label>
      <Input
        id="move-date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mb-4"
      />

      {loading && <Spinner className="h-4 w-4" />}

      {!loading && freeSlots.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          No published times on this day yet.
        </p>
      )}

      {!loading && freeSlots.length > 0 && (
        <ul className="mb-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {freeSlots.map((slot) => (
            <li key={slot.starts_at}>
              <button
                type="button"
                onClick={() => setSelected(slot)}
                aria-pressed={selected?.starts_at === slot.starts_at}
                className={cn(
                  'w-full rounded-md border px-1 py-2 font-mono text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected?.starts_at === slot.starts_at
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary',
                )}
              >
                {slot.local_time}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button
        size="sm"
        loading={busy}
        disabled={!selected}
        onClick={() => void confirm()}
      >
        Confirm move
      </Button>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/calendar/MoveAppointmentPanel.tsx
git commit -m "feat(calendar): add MoveAppointmentPanel"
```

---

### Task 5: Wire into `CalendarPage`

**Files:**

- Modify: `src/pages/dashboard/CalendarPage.tsx`

**Interfaces:**

- Consumes: `MoveAppointmentPanel`/`MoveAppointmentPanelProps` (Task 4), the updated `AppointmentCard` `onMove` prop (Task 3).

- [ ] **Step 1: Implement**

In `src/pages/dashboard/CalendarPage.tsx`:

1. Import `MoveAppointmentPanel` from `@/components/dashboard/calendar/MoveAppointmentPanel`.
2. Add state: `const [moving, setMoving] = useState(false);` alongside the existing `selectedId` state.
3. When `view`/`anchor` changes, the existing `useEffect(() => setSelectedId(null), [view, anchor])` (added in the prior calendar-views plan's final fix round) should also close the Move panel — extend it:

```tsx
useEffect(() => {
  setSelectedId(null);
  setMoving(false);
}, [view, anchor]);
```

4. Pass `onMove` to `<AppointmentCard>`:

```tsx
<AppointmentCard
  appointment={selected}
  timezone={timezone}
  onStatusChange={changeStatus}
  onNoteSave={saveNote}
  onMove={() => setMoving(true)}
  className="border-0"
/>
```

5. Render the panel right after the `AppointmentCard` block, only when both
   a selection exists and Move was opened:

```tsx
{
  selected && moving && (
    <div className="mt-4">
      <MoveAppointmentPanel
        appointment={selected}
        timezone={timezone}
        onClose={() => setMoving(false)}
        onMoved={() => {
          setMoving(false);
          setSelectedId(null);
          void load();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all existing tests still pass — this task adds no new tests
(page-level, not unit-tested per this repo's convention), it must not break
anything else.

- [ ] **Step 4: Look at it**

```bash
npm run dev
```

Open `http://localhost:5082/dashboard/calendar`, sign in as the owner, click
a confirmed appointment to select it, click "Move", pick a different date,
pick one of that date's free times, click "Confirm move". **This will fail
with a real Postgres error** until migration `0024` has actually been pushed
to the live database (a separate, human-approved step — see Global
Constraints) — confirm the UI itself behaves correctly up to that point
(date picker works, free times load and render, selecting one highlights
it, the error from a failed RPC call is shown via `errorMessage()` rather
than crashing the page) and note in your report that the end-to-end
success path is blocked on the migration push, not a defect in this task.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dashboard/CalendarPage.tsx
git commit -m "feat(calendar): wire Move panel into CalendarPage"
```

---

## Explicitly out of scope for this plan

- Pointer-based drag-to-reschedule (separate follow-on plan, now unblocked
  once this one ships — it has a real RPC to call).
- Pushing migration `0024` to the live database — human decision, made after
  this plan's tasks are reviewed, the same way merging the branch is.
