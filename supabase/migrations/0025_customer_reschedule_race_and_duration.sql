-- =====================================================================
-- 0025_customer_reschedule_race_and_duration.sql
--
-- Two correctness bugs found while building the owner's drag-to-reschedule
-- path (migration 0024), then confirmed to exist here too, live, on the
-- customer-facing sibling this function was modelled on.
--
--   1. No row lock on the appointment read. Two concurrent reschedule
--      calls on the same appointment (a double-tapped "confirm", a retried
--      request after a slow response) can both pass the status check
--      before either commits, both retire the old row, and both insert a
--      new one — leaving two live bookings for one customer. `for update`
--      makes the second caller block until the first commits, then
--      re-read the row as `status = 'rescheduled'` and correctly fail
--      `NOT_RESCHEDULABLE`.
--
--   2. The new row's length was recomputed from the current active
--      service's default duration instead of preserved from the old row.
--      Appointments have no duration column — length lives only in
--      `ends_at - starts_at` — and an owner-created booking can be any
--      length (`create_appointment_as_owner` takes an explicit
--      `p_duration_min`, and the dashboard's own booking panel defaults to
--      240 minutes). A customer rescheduling a 4-hour appointment silently
--      shrank it to the service default, leaving real chair time
--      unprotected by the overlap constraint.
--
-- Nothing else about this function changes: same signature, same grants,
-- same validation order, same error codes.
-- =====================================================================

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
  v_service    public.services%rowtype;
  v_local_date date;
  v_local_time time;
  v_late       boolean;
  v_ref        text;
  v_id         uuid;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();

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
       approval_deadline, approved_at, rescheduled_from)
    values
      (v_ref, v_customer, v_service.id, p_new_starts_at,
       p_new_starts_at + (v_old.ends_at - v_old.starts_at),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, p_appointment_id)
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
