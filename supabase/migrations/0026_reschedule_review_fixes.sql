-- =====================================================================
-- 0026_reschedule_review_fixes.sql
--
-- 0024 (reschedule_appointment_as_owner) and 0025
-- (customer_reschedule_appointment) already shipped to production before
-- this review pass found three more issues in them. `create or replace
-- function` isn't retroactive — editing 0024/0025's own files in place
-- doesn't change what's already live — so the fixes ship as a new
-- migration that redefines both functions.
--
-- Fixes:
--   1. reschedule_appointment_as_owner never checked that the *new* time
--      was in the future (only the old one) — a drag onto an already-past
--      slot silently succeeded. Added the same ALREADY_PASSED check on
--      p_new_starts_at that 0025 always had on the customer path.
--   2. customer_reschedule_appointment's insert carried v_old.approved_at
--      forward but dropped v_old.approved_by, silently losing the
--      approver reference on a customer-initiated reschedule of an
--      owner-approved booking. reschedule_appointment_as_owner already
--      carried it correctly; this brings 0025 in line.
--   3. reschedule_appointment_as_owner still called hair_appointment()
--      solely to raise SERVICE_UNAVAILABLE if no service is active, even
--      though v_service is never otherwise used (duration/price/service_id
--      are all preserved from v_old) — 0025 already dropped this same dead
--      lookup for the same reason. Left in, it means deactivating the
--      salon's one service blocks rescheduling *any* existing appointment,
--      even though the operation touches no service data.
--
-- Nothing else changes: same signatures, same grants, same validation
-- order otherwise, same error codes.
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

  -- Row lock: two concurrent reschedules of the same appointment (owner on
  -- two devices, or a retried request) must not both pass the status check
  -- and both retire-and-insert. `for update` makes the second caller block
  -- until the first commits, then re-read the now-'rescheduled' row and
  -- correctly fail NOT_RESCHEDULABLE below, instead of "succeeding" twice.
  select * into v_old from public.appointments where id = p_appointment_id for update;
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
  if p_new_starts_at < now() then
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

  -- The retire UPDATE above just changed status, which fires
  -- notify_appointment_status_changed's 'rescheduled' branch and queues an
  -- owner_booking_moved email ("Moved: <customer>") addressed to the owner
  -- about her own action, keyed to the OLD row's id and carrying the OLD
  -- time. Suppress it here, before the insert attempt below, so it never
  -- goes out whether that insert then succeeds or collides and restores.
  update public.email_messages
     set status = 'failed', last_error = 'Rescheduled by the salon'
   where email_messages.appointment_id = p_appointment_id
     and status = 'queued'
     and template = 'owner_booking_moved';

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, owner_note, source, status, requires_approval,
       approval_deadline, approved_at, approved_by, rescheduled_from)
    values
      -- service_id carries forward from the OLD row, not the currently
      -- active service — consistent with price_pence and duration already
      -- being preserved from v_old below. If the active service ever
      -- changes between bookings, moving an old appointment must not
      -- silently change what the confirmation email describes.
      (v_ref, v_old.customer_id, v_old.service_id, p_new_starts_at,
       -- Preserve the OLD appointment's actual duration rather than
       -- recomputing it from the currently active service's default length.
       -- Appointments have no duration column — length lives only in
       -- ends_at - starts_at — and an owner-created booking can already
       -- differ from the default (create_appointment_as_owner's
       -- p_duration_min, 0019). Rebuilding from the current service's
       -- default duration would silently shrink a longer booking to the
       -- default on every move.
       p_new_starts_at + (v_old.ends_at - v_old.starts_at),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, v_old.approved_by, p_appointment_id)
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
   where email_messages.appointment_id = v_id
     and status = 'queued'
     and template in ('owner_new_booking', 'owner_approval_needed');

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.reschedule_appointment_as_owner(uuid, timestamptz)
  from public, anon;
grant execute on function public.reschedule_appointment_as_owner(uuid, timestamptz)
  to authenticated;

create or replace function public.customer_reschedule_appointment(
  p_session_token  text,
  p_appointment_id uuid,
  p_new_starts_at  timestamptz
)
returns table (appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer   uuid := public.customer_from_session(p_session_token);
  v_old        public.appointments%rowtype;
  v_settings   public.booking_settings%rowtype;
  v_local_date date;
  v_local_time time;
  v_late       boolean;
  v_ref        text;
  v_id         uuid;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;

  select * into v_old from public.appointments
   where id = p_appointment_id and customer_id = v_customer
   for update;

  if v_old.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only a booking that is still going to happen can be moved. A completed or
  -- cancelled one is history, and rescheduling history is a different idea.
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

  -- The new time faces exactly the checks a fresh booking would, including the
  -- same salon-clock alignment rule.
  if (extract(hour from v_local_time) * 60 + extract(minute from v_local_time))::integer
       % v_settings.slot_granularity_min <> 0
     or extract(second from v_local_time) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;
  if p_new_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;
  if p_new_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.availability_slots sl
     where sl.on_date = v_local_date and sl.starts_at = v_local_time
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  -- Moving inside the cancellation window is allowed but recorded. Refusing it
  -- just turns into a no-show, which costs the salon the slot anyway.
  v_late := v_old.starts_at < now() + make_interval(hours => v_settings.cancellation_window_h);

  -- A still-pending booking gets a deadline measured from the move, against the
  -- time it was actually moved to. Copying the old one forward handed the new
  -- booking a deadline belonging to the old date, often already past, which the
  -- hourly expiry sweep would then act on.
  if v_old.status = 'pending_approval' then
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_new_starts_at);
  else
    v_deadline := null;
  end if;

  v_ref := public.generate_booking_reference();

  -- Retire the old one first. It has to stop occupying the calendar before the
  -- new row is inserted, or moving to an adjacent time would collide with
  -- itself through the overlap constraint.
  update public.appointments
     set status = 'rescheduled',
         cancellation_reason = case
           when v_late then 'Moved by the customer (inside the cancellation window)'
           else 'Moved by the customer'
         end
   where id = p_appointment_id;

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, owner_note, source, status, requires_approval,
       approval_deadline, approved_at, approved_by, rescheduled_from)
    values
      (v_ref, v_customer, v_old.service_id, p_new_starts_at,
       p_new_starts_at + (v_old.ends_at - v_old.starts_at),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, v_old.approved_by, p_appointment_id)
    returning id into v_id;
  exception when exclusion_violation then
    -- Somebody took the new time in the meantime. Put the old booking back —
    -- losing an appointment because a reschedule half-failed would be far
    -- worse than the move simply not happening.
    update public.appointments
       set status = v_old.status, cancellation_reason = v_old.cancellation_reason
     where id = p_appointment_id;
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.customer_reschedule_appointment(text, uuid, timestamptz)
  from public;
grant execute on function public.customer_reschedule_appointment(text, uuid, timestamptz)
  to anon, authenticated;
