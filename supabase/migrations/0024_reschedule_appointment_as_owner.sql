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
  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

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
      -- active service (v_service.id) — consistent with price_pence and
      -- duration already being preserved from v_old below. If the active
      -- service ever changes between bookings, moving an old appointment
      -- must not silently change what the confirmation email describes.
      (v_ref, v_old.customer_id, v_old.service_id, p_new_starts_at,
       -- Preserve the OLD appointment's actual duration rather than
       -- recomputing it from the currently active service's default length.
       -- Appointments have no duration column — length lives only in
       -- ends_at - starts_at — and an owner-created booking can already
       -- differ from the default (create_appointment_as_owner's
       -- p_duration_min, 0019). Rebuilding from v_service.duration_min would
       -- silently shrink a longer booking to the default on every move.
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
