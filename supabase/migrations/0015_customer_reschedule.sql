-- =====================================================================
-- 0015_customer_reschedule.sql — customers can move their own appointment
--
-- Until now a customer could only cancel and rebook, which loses the thread:
-- the salon sees a cancellation and a separate new booking, with nothing
-- connecting them, and the customer has to hold their nerve that the new slot
-- is still there while they give up the old one.
--
-- Shape of the change: a reschedule creates a **new** appointment and marks the
-- old one `rescheduled`, linked by `rescheduled_from`. Both columns have existed
-- since 0002 for exactly this. The alternative — moving `starts_at` in place —
-- keeps the reference stable but erases the history, and "she moved twice, the
-- second time at short notice" is something a salon owner wants to be able to
-- see.
--
-- Freeing the old time needs no work: `rescheduled` is not one of the statuses
-- in `appointments_no_overlap`, so the old slot stops blocking and returns to
-- sale the moment the move commits.
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
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();

  select * into v_old from public.appointments
   where id = p_appointment_id and customer_id = v_customer;

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

  -- The new time faces exactly the checks a fresh booking would.
  if extract(epoch from p_new_starts_at)::bigint % (v_settings.slot_granularity_min * 60) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;
  if p_new_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;
  if p_new_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_new_starts_at at time zone v_settings.timezone)::time;

  if not exists (
    select 1 from public.availability_slots sl
     where sl.on_date = v_local_date and sl.starts_at = v_local_time
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  -- Moving inside the cancellation window is allowed but recorded. Refusing it
  -- just turns into a no-show, which costs the salon the slot anyway.
  v_late := v_old.starts_at < now() + make_interval(hours => v_settings.cancellation_window_h);

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
       p_new_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_old.approval_deadline,
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

-- ---------- Telling the right people ------------------------------------
-- The customer already receives a confirmation for the new appointment from the
-- insert trigger, so a second "you have moved" email to them would be noise.
-- The owner gets told, because a booking moving is exactly the sort of thing
-- she needs to notice; and the old booking's reminders must die with it.
create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_service  public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_owner    text;
  v_new      public.appointments%rowtype;
  v_payload  jsonb;
begin
  if new.status = old.status then
    return new;
  end if;

  select * into v_customer from public.customers where id = new.customer_id;
  select * into v_service  from public.services  where id = new.service_id;
  select * into v_settings from public.booking_settings where id;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'service_name', v_service.name,
    'starts_at', new.starts_at,
    'price_pence', new.price_pence,
    'timezone', v_settings.timezone,
    'reason', coalesce(new.rejection_reason, new.cancellation_reason),
    'google_review_url', v_settings.google_review_url
  );

  if new.status = 'confirmed' and old.status = 'pending_approval' then
    perform public.queue_email(
      'booking_approved', v_customer.email::text,
      'Your appointment is confirmed — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email('reminder_24h', v_customer.email::text,
        'Your appointment tomorrow — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email('reminder_2h', v_customer.email::text,
        'See you shortly — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
    end if;

  elsif new.status = 'rejected' then
    perform public.queue_email(
      'booking_declined', v_customer.email::text,
      'About your booking request — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'cancelled' then
    perform public.queue_email(
      'booking_cancelled', v_customer.email::text,
      'Your appointment is cancelled — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'rescheduled' then
    select p.email into v_owner
      from public.staff s join public.profiles p on p.id = s.id
     order by s.created_at limit 1;

    -- The replacement row is inserted immediately after this trigger runs, so
    -- it is not visible yet. The owner alert carries the old time and the
    -- customer, which is enough to find the new one on the calendar.
    if v_owner is not null then
      perform public.queue_email(
        'owner_booking_moved', v_owner,
        'Moved: ' || v_customer.full_name,
        new.id, v_customer.id, null,
        v_payload || jsonb_build_object(
          'customer_email', v_customer.email::text,
          'customer_mobile', v_customer.mobile));
    end if;

  elsif new.status = 'completed' then
    if v_settings.google_review_url is not null then
      perform public.queue_email(
        'review_request', v_customer.email::text,
        'How did we do?',
        new.id, v_customer.id, now() + interval '2 hours', v_payload);
    end if;
  end if;

  -- A booking that is no longer happening must not still be reminded about.
  if new.status in ('cancelled', 'rejected', 'no_show', 'rescheduled') then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment ' || new.status || ' before send'
     where appointment_id = new.id
       and status = 'queued'
       and template in ('reminder_24h', 'reminder_2h', 'review_request');
  end if;

  return new;
end;
$$;

-- ---------- The customer's own view, with the move visible ---------------
-- `customer_appointments` gained nothing structural, but a moved booking should
-- read as moved rather than vanishing, so the flag comes back with the row.
-- `create or replace` cannot widen a `returns table`, so the old signature
-- has to go first. Dropping is safe: nothing holds a reference to it, and
-- the grant is reapplied below.
drop function if exists public.customer_appointments(text);

create function public.customer_appointments(p_session_token text)
returns table (
  id uuid, reference text, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, price_pence integer, service_name text,
  customer_note text, cancellation_reason text, rejection_reason text,
  rescheduled_from uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_customer uuid := public.customer_from_session(p_session_token);
begin
  return query
    select a.id, a.reference, a.starts_at, a.ends_at, a.status, a.price_pence,
           s.name, a.customer_note, a.cancellation_reason, a.rejection_reason,
           a.rescheduled_from
      from public.appointments a
      join public.services s on s.id = a.service_id
     where a.customer_id = v_customer
     order by a.starts_at desc;
end;
$$;

revoke all on function public.customer_appointments(text) from public;
grant execute on function public.customer_appointments(text) to anon, authenticated;
