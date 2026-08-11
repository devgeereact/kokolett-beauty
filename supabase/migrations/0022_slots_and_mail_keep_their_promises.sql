-- =====================================================================
-- 0022_slots_and_mail_keep_their_promises.sql
--
-- Five correctness fixes. Two are live today; three are dormant traps that fire
-- the moment a setting is changed.
--
--   1. LIVE: cancelling a booking no longer lets a queued "you're booked in"
--      email go out anyway. This is the bug 0016 fixed and 0020 reintroduced.
--   2. LIVE: the nightly template extender no longer deletes the published slot
--      behind a live appointment.
--   3. DORMANT: slot alignment is checked against the salon's clock, not the
--      UTC epoch, so a granularity that does not divide 60 stops breaking every
--      booking for the whole of British Summer Time.
--   4. DORMANT: a rescheduled booking recomputes its approval deadline instead
--      of carrying the old one onto the new date.
--   5. Booking takes a per-day lock, so the daily cap cannot be exceeded by two
--      simultaneous bookings at different times.
-- =====================================================================


-- ---------- 1. Dead bookings do not send live mail ----------------------
--
-- 0016 was written because a customer cancelled inside the five-minute drain
-- window and still received "Your appointment is confirmed" a moment later. It
-- fixed that by retiring the queued confirmation and approval mail along with
-- the reminders.
--
-- 0018 rewrote this trigger wholesale and its retire list kept only
-- ('reminder_24h', 'reminder_2h', 'reminder_1h', 'review_request',
-- 'appointment_completed') — dropping 'booking_confirmed', 'booking_held',
-- 'booking_approved', 'owner_new_booking' and 'owner_approval_needed'. 0020
-- re-applied 0018 verbatim, so that is the live state, and 0016's bug is back:
-- cancel or reschedule before the drain runs and the confirmation still goes.
--
-- The list below is the union of both. Losing a template from it is a silent
-- regression, so it is a constant, named once and used in both places.

create or replace function public.retired_booking_templates()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    -- Reminders and follow-ups: nothing to remind anyone about.
    'reminder_24h', 'reminder_2h', 'reminder_1h',
    'review_request', 'appointment_completed',
    -- The ones 0018 dropped. A confirmation that arrives after a cancellation
    -- is worse than no confirmation: the customer turns up.
    'booking_confirmed', 'booking_held', 'booking_approved',
    'owner_new_booking', 'owner_approval_needed'
  ]::text[];
$$;

revoke all on function public.retired_booking_templates() from public, anon, authenticated;

create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer public.customers;
  v_service  public.services;
  v_settings public.booking_settings;
  v_owner    text;
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
    'ends_at', new.ends_at,
    'timezone', v_settings.timezone,
    'reason', coalesce(new.rejection_reason, new.cancellation_reason),
    'cancellation_window_h', v_settings.cancellation_window_h,
    'approval_window_h', v_settings.approval_window_h,
    'salon_address', v_settings.address_line,
    'salon_phone', v_settings.phone,
    'instagram_url', v_settings.instagram_url,
    'google_review_url', v_settings.google_review_url
  );

  if new.status = 'confirmed' and old.status = 'pending_approval' then
    perform public.queue_email(
      'booking_approved', v_customer.email::text,
      'Your appointment is confirmed · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email('reminder_24h', v_customer.email::text,
        'Your appointment tomorrow · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '1 hour' > now() then
      perform public.queue_email('reminder_1h', v_customer.email::text,
        'See you in an hour · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '1 hour', v_payload);
    end if;

  elsif new.status = 'rejected' then
    perform public.queue_email(
      'booking_declined', v_customer.email::text,
      'About your booking request · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'cancelled' then
    perform public.queue_email(
      'booking_cancelled', v_customer.email::text,
      'Your appointment is cancelled · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'rescheduled' then
    select p.email into v_owner
      from public.staff s join public.profiles p on p.id = s.id
     order by s.created_at limit 1;

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
    -- Always. The thank-you is the email that asks for the next booking, and
    -- whether a Google link is configured is the salon's business, not a
    -- reason for the customer to hear nothing.
    perform public.queue_email(
      'appointment_completed', v_customer.email::text,
      'Thank you for coming in · ' || new.reference,
      new.id, v_customer.id, now() + interval '2 hours',
      v_payload || jsonb_build_object('owner_note', new.owner_note));
  end if;

  if new.status in ('cancelled', 'rejected', 'no_show', 'rescheduled') then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment ' || new.status || ' before send'
     where appointment_id = new.id
       and status = 'queued'
       and template = any (public.retired_booking_templates());
  end if;

  return new;
end;
$$;

-- Anything already queued against a booking that is no longer live. Same sweep
-- 0016 ran; it is needed again because 0018 and 0020 were live in between.
update public.email_messages m
   set status = 'failed',
       last_error = 'Appointment no longer live when the queue was corrected (0022)'
  from public.appointments a
 where a.id = m.appointment_id
   and m.status = 'queued'
   and a.status in ('cancelled', 'rejected', 'no_show', 'rescheduled')
   and m.template = any (public.retired_booking_templates());


-- ---------- 2. The nightly extender respects live bookings --------------
--
-- 0012 shipped a specific guarantee: a time with a live appointment against it
-- survives any bulk edit. `set_day_slots()` honours it by unioning
-- `booked_times_on()` in before it deletes. `extend_weekly_template()` — added
-- later, in 0013 — did a raw `delete from availability_slots where on_date = ...`
-- with no such union, which is a straight regression against that guarantee.
--
-- It is gated on `day_decided`, so it only touches dates nobody has explicitly
-- decided. That is not the same as "dates with no bookings": `add_day_slot()`
-- and `materialise_day_slots()` (0008, still defined and still granted) publish
-- slots without ever writing `day_decided`, and any date whose slots predate
-- `day_decided` existing at all is likewise undecided. For those dates the
-- nightly run deleted the slot under a live appointment. The booking itself
-- survived — the exclusion constraint still blocked the time — but it vanished
-- from `owner_day_slots()`, so the owner's day panel showed nothing at a time
-- somebody was turning up. That is the exact failure 0012 was written to stop.

create or replace function public.extend_weekly_template()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_today    date;
  v_date     date;
  v_times    time[];
  v_days     integer := 0;
begin
  select * into v_settings from public.booking_settings where id;
  v_today := (now() at time zone v_settings.timezone)::date;

  -- Nothing to do until the owner has actually set a pattern.
  if not exists (select 1 from public.weekly_template) then
    return 0;
  end if;

  for v_date in
    select d::date
      from generate_series(v_today, v_today + v_settings.max_horizon_days, interval '1 day') d
  loop
    if exists (select 1 from public.day_decided dd where dd.on_date = v_date) then
      continue;
    end if;

    -- The pattern for this weekday, unioned with any time that already has a
    -- live appointment against it. Same rule as `set_day_slots()`.
    select array(
      select distinct t from (
        select wt.starts_at as t from public.weekly_template wt
         where wt.day_of_week = extract(dow from v_date)::smallint
        union
        select public.booked_times_on(v_date)
      ) merged
      order by t
    ) into v_times;

    delete from public.availability_slots where on_date = v_date;

    insert into public.availability_slots (on_date, starts_at)
    select v_date, t from unnest(v_times) t
    on conflict (on_date, starts_at) do nothing;

    insert into public.day_decided (on_date, decided_by)
    values (v_date, 'template')
    on conflict (on_date) do nothing;

    v_days := v_days + 1;
  end loop;

  return v_days;
end;
$$;

revoke all on function public.extend_weekly_template() from public, anon, authenticated;


-- ---------- 3, 4, 5. Booking and rescheduling ---------------------------
--
-- **Alignment (3).** Both functions checked the slot grid with
-- `extract(epoch from p_starts_at) % (granularity * 60) = 0`, i.e. against the
-- UTC epoch. Every publish-side function (`set_day_slots`, `add_day_slot`,
-- `set_weekly_template`) checks it against local minutes-since-midnight. Those
-- two agree only when the granularity divides 60, because that is the BST/GMT
-- offset. `slot_granularity_min` is an owner-editable field bounded 5..60 with
-- no divisor restriction, so setting it to, say, 40 looks fine all winter — in
-- GMT the epoch check is trivially satisfied — and then on the last Sunday in
-- March every published slot starts failing SLOT_MISALIGNED, for the whole of
-- summer, while `available_slots()` still lists them as bookable. A customer
-- would see a slot, pick it, and be told it is not a real time.
-- The alignment check now uses the salon's wall clock, so both sides agree by
-- construction whatever the granularity is.
--
-- **Approval deadline (4).** A reschedule copied `approval_deadline` from the
-- old row onto the new one. That deadline was computed as
-- `least(now() + approval_window_h, old_starts_at)`, so moving a still-pending
-- booking to a later date carried a deadline belonging to the old date —
-- frequently one already in the past, which `expire_pending_approvals()` would
-- then act on and reject a booking the customer had just successfully moved.
-- Dormant while `approve_first_time` is false (0007), but SCHEMA.md documents
-- flipping it back on as a supported change with no migration.
--
-- **Daily cap (5).** The capacity check was a plain count under READ COMMITTED.
-- Two customers booking different times on a day one short of the cap both saw
-- `count < cap` and both inserted; the exclusion constraint did not fire
-- because their times did not overlap each other. The day finished over its
-- hard limit. A transaction-scoped advisory lock keyed on the local date
-- serialises just the bookings that share a day, so two people booking on
-- different days are unaffected.

create or replace function public.book_appointment(
  p_starts_at  timestamptz,
  p_full_name  text,
  p_email      text,
  p_mobile     text default null,
  p_note       text default null,
  p_consent    boolean default false
)
returns table (appointment_id uuid, reference text, status public.appointment_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.booking_settings%rowtype;
  v_service    public.services%rowtype;
  v_local_date date;
  v_local_time time;
  v_name       text := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_mobile     text := trim(coalesce(p_mobile, ''));
  v_customer   uuid;
  v_ref        text;
  v_id         uuid;
  v_returning  boolean;
  v_status     public.appointment_status;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- A first name alone is not enough to tell two customers apart in a diary.
  if array_length(string_to_array(v_name, ' '), 1) is null
     or array_length(string_to_array(v_name, ' '), 1) < 2
     or length(v_name) < 3 then
    raise exception 'NAME_INCOMPLETE' using errcode = 'P0001';
  end if;

  -- Enough digits to be a real number, ignoring spaces, brackets and +.
  if length(regexp_replace(v_mobile, '\D', '', 'g')) < 7 then
    raise exception 'MOBILE_REQUIRED' using errcode = 'P0001';
  end if;

  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_starts_at at time zone v_settings.timezone)::time;

  -- Against the salon's clock, exactly as the publish side checks it.
  if (extract(hour from v_local_time) * 60 + extract(minute from v_local_time))::integer
       % v_settings.slot_granularity_min <> 0
     or extract(second from v_local_time) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.availability_slots sl
     where sl.on_date = v_local_date and sl.starts_at = v_local_time
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  -- Serialise the capacity check against other bookings on the same local day.
  -- Transaction-scoped, so it is released on commit or rollback either way.
  -- Single-argument (bigint) form; the two-argument form takes int4s.
  perform pg_advisory_xact_lock(hashtext('book_day:' || v_local_date::text)::bigint);

  if (
    select count(*) from public.appointments a
    where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
      and (a.starts_at at time zone v_settings.timezone)::date = v_local_date
  ) >= v_settings.max_appointments_per_day then
    raise exception 'DAILY_CAPACITY_REACHED' using errcode = 'P0001';
  end if;

  insert into public.customers (email, full_name, mobile, marketing_consent, consent_updated_at, last_seen_at)
  values (p_email, v_name, v_mobile, p_consent,
          case when p_consent then now() end, now())
  on conflict (lower(email::text)) where deleted_at is null
  do update set
    full_name         = excluded.full_name,
    mobile            = coalesce(excluded.mobile, public.customers.mobile),
    marketing_consent = public.customers.marketing_consent or excluded.marketing_consent,
    last_seen_at      = now()
  returning id into v_customer;

  select exists (
    select 1 from public.appointments a
    where a.customer_id = v_customer and a.status = 'completed'
  ) into v_returning;

  if v_returning or not v_settings.approve_first_time then
    v_status := 'confirmed';
    v_deadline := null;
  else
    v_status := 'pending_approval';
    v_deadline := least(now() + make_interval(hours => v_settings.approval_window_h), p_starts_at);
  end if;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approval_deadline, approved_at)
    values
      (v_ref, v_customer, v_service.id, p_starts_at,
       p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_service.price_pence, p_note, 'web', v_status, not v_returning, v_deadline,
       case when v_status = 'confirmed' then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref, v_status;
end;
$$;

revoke all on function public.book_appointment(timestamptz, text, text, text, text, boolean) from public;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, boolean)
  to anon, authenticated;


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
       p_new_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
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
