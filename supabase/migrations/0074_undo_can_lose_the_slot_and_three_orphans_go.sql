-- =====================================================================
-- 0074_undo_can_lose_the_slot_and_three_orphans_go.sql
--
-- Two unrelated leftovers, both from earlier migrations that did most of a
-- job and stopped.
--
-- 1. **Un-cancelling can raise a raw constraint error at the owner.**
--    `0063` added `cancelled -> confirmed | checked_in | in_service` so the
--    Undo toast could actually work, and then did a bare UPDATE.
--    `appointments_no_overlap` (0002) excludes `cancelled`, so a cancelled
--    row is OUT of the exclusion index and re-enters it on the way back.
--    Between the cancel and the Undo, that time is on sale: a customer books
--    it, the owner presses Undo four minutes later, and Postgres raises
--    `23P01`. Every other write path against `appointments` wraps this
--    exact case and re-raises it as `SLOT_TAKEN` — `book_appointment`
--    (0039), `create_appointment_as_owner` and
--    `reschedule_appointment_as_owner` (0052), `customer_reschedule_appointment`
--    (0026), `offer_slot_to_request` (0011). This one did not, so the dashboard
--    had no branch for the SQLSTATE and showed the owner a raw constraint
--    string instead of "that time has been taken".
--
--    Nothing else about the function changes: same transition table, same
--    timestamp and reason handling, same review-request cancellation, same
--    audit row.
--
-- 2. **Three superseded slot functions are still granted to `authenticated`.**
--    `add_day_slot`, `remove_day_slot` and `clear_day_slots` were the 0008
--    model. `0011` dropped eight functions from that model, including
--    `materialise_day_slots`, but not these three, and nothing since has.
--    `clear_day_slots` is a bare `delete from availability_slots where
--    on_date = p_date` with no `booked_times_on()` union, which is precisely
--    the regression `0022` diagnosed in `extend_weekly_template` and fixed
--    THERE while its own comment named an already-dropped function as the
--    culprit and missed these. Called on a day holding a live booking, the
--    appointment survives (the exclusion constraint keeps the time) but
--    `owner_day_slots()` reads only `availability_slots`, so the owner's day
--    panel shows nothing at that hour while a customer is on their way in.
--    Nothing in `src/` calls any of the three; only the generated
--    `database.types.ts` carries their signatures, and regeneration clears
--    that.
-- =====================================================================

create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.appointments;
  v_current public.appointment_status;
  v_allowed public.appointment_status[];
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select status into v_current from public.appointments where id = p_appointment_id;
  if v_current is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  v_allowed := case v_current
    when 'pending_approval' then array['confirmed','rejected','cancelled']::public.appointment_status[]
    when 'confirmed'  then array['checked_in','in_service','completed','cancelled','no_show']::public.appointment_status[]
    when 'checked_in' then array['in_service','completed','cancelled','no_show']::public.appointment_status[]
    when 'in_service' then array['completed','cancelled']::public.appointment_status[]
    when 'completed'  then array['confirmed']::public.appointment_status[]
    -- Undo: restore to whichever active status it was cancelled from. Any of
    -- the three is a legitimate prior state (TodayPage's Undo restores the
    -- exact prevStatus it captured before the cancel call).
    when 'cancelled'  then array['confirmed','checked_in','in_service']::public.appointment_status[]
    else array[]::public.appointment_status[]
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001',
      detail = format('%s -> %s', v_current, p_status);
  end if;

  -- The exclusion constraint can fire here, and only here: a cancelled row is
  -- outside `appointments_no_overlap` and re-enters it on the way back to an
  -- active status. See this file's header.
  begin
    update public.appointments
       set status = p_status,
           checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end,
           completed_at  = case
             when p_status = 'completed' then now()
             when p_status = 'confirmed' and v_current = 'completed' then null
             else completed_at
           end,
           cancelled_at  = case
             when p_status = 'cancelled' then now()
             when v_current = 'cancelled' then null
             else cancelled_at
           end,
           cancellation_reason = case
             when p_status = 'cancelled' then coalesce(nullif(trim(p_reason), ''), 'Cancelled by the salon')
             when v_current = 'cancelled' then null
             else cancellation_reason
           end
     where id = p_appointment_id
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  if v_current = 'completed' and p_status = 'confirmed' then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment un-completed by the owner before this was sent'
     where appointment_id = p_appointment_id
       and status = 'queued'
       and template = 'review_request';
  end if;

  perform public.log_audit_event(
    'appointment.status_changed', 'appointment', p_appointment_id,
    format('Appointment %s: %s -> %s', v_row.reference, v_current, p_status),
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_status));

  return v_row;
end;
$$;

comment on function public.set_appointment_status(uuid, public.appointment_status, text) is
  'The owner-side status machine, including the cancelled -> active Undo added in '
  '0063. Since 0074 the un-cancel path re-raises an exclusion_violation as '
  'SLOT_TAKEN, like every other write against appointments, because the slot can '
  'genuinely have been sold in between.';

-- ---------------------------------------------------------------------
-- The 0008 slot model, finally removed.
-- ---------------------------------------------------------------------
drop function if exists public.add_day_slot(date, time, text);
drop function if exists public.remove_day_slot(date, time);
drop function if exists public.clear_day_slots(date);
