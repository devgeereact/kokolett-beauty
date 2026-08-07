-- =====================================================================
-- 0011_slots_are_the_model.sql — rebuild availability from scratch
--
-- Decided by the owner on 2026-08-07, after using the thing: the calendar had
-- four overlapping ways to say when she was free — standing weekly rules,
-- published "custom hours" windows, individual published slots, and breaks or
-- closures that subtracted from all of it. Every one of them was defensible on
-- its own. Together they were a system nobody should have to hold in their head,
-- and they produced screens that contradicted each other.
--
-- The replacement is the smallest thing that can possibly work:
--
--     A day is a list of start times. If a time is on the list it can be
--     booked. If it is not, it cannot. That is the entire model.
--
-- No weekly pattern to fall back on, no windows to intersect, no exceptions to
-- subtract. "Blocking out time" stops being a concept — you simply do not
-- publish a time, or you delete one you already published.
--
-- Slots also stop depending on the service. Every appointment is one
-- "Hair Appointment" of a fixed length, so a slot is absolute rather than
-- "free for a trim, busy for a colour". What the customer actually wants is
-- settled in the chair, which is how the salon works anyway.
--
-- This drops `availability_rules` and `availability_exceptions`. They hold
-- nothing but the placeholder pattern seeded in 0003; no appointment references
-- them, and keeping dead tables around to avoid saying "drop" would leave the
-- next person wondering which model is live.
-- =====================================================================

-- ---------- 1. One appointment type ------------------------------------
do $$
declare
  v_keep uuid;
  v_duration integer := 60;
  v_price integer := 0;
begin
  -- Carry over the length and price of whatever the salon was already using,
  -- so this is a reshaping rather than a reset.
  select id, duration_min, price_pence into v_keep, v_duration, v_price
    from public.services
   where is_active and archived_at is null
   order by created_at
   limit 1;

  if v_keep is null then
    insert into public.services
      (name, slug, description, duration_min, buffer_min, price_pence, is_active)
    values
      ('Hair Appointment', 'hair-appointment',
       'One appointment for any hair service — tell us what you are after when you book.',
       60, 0, 0, true);
  else
    update public.services
       set name = 'Hair Appointment',
           slug = 'hair-appointment',
           description = coalesce(description,
             'One appointment for any hair service — tell us what you are after when you book.'),
           duration_min = v_duration,
           price_pence = v_price,
           is_active = true,
           archived_at = null
     where id = v_keep;

    -- Everything else stops being bookable but is kept, because past
    -- appointments point at it and deleting would erase what someone booked.
    update public.services
       set is_active = false,
           archived_at = coalesce(archived_at, now())
     where id <> v_keep;
  end if;
end $$;

/** The single bookable service. Every appointment is one of these. */
create or replace function public.hair_appointment()
returns public.services
language sql
stable
security definer
set search_path = public
as $$
  select * from public.services
   where is_active and archived_at is null
   order by created_at
   limit 1;
$$;

grant execute on function public.hair_appointment() to anon, authenticated;

-- ---------- 2. Retire the old model ------------------------------------
drop function if exists public.set_day_availability(date, jsonb);
drop function if exists public.materialise_day_slots(date, uuid);
drop function if exists public.owner_day_slots(date, uuid);
drop function if exists public.available_slots(uuid, date, date);
drop function if exists public.day_candidate_starts(date, uuid);
drop function if exists public.book_appointment(uuid, timestamptz, text, text, text, text, boolean);
drop function if exists public.create_appointment_as_owner(uuid, timestamptz, text, text, text, text);
drop function if exists public.offer_slot_to_request(uuid, uuid, timestamptz, text);

drop table if exists public.availability_exceptions;
drop table if exists public.availability_rules;

-- Slots published before this migration were tied to a service-shaped world;
-- they remain valid start times, so they carry over untouched.
comment on table public.availability_slots is
  'The whole availability model since 0011: a day is a list of start times. Nothing else makes a slot bookable.';

-- ---------- 3. What a day offers ---------------------------------------
create or replace function public.available_slots(p_from date, p_to date)
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service  public.services%rowtype;
  v_total    integer;
  v_to       date;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_to < p_from then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;

  -- Still bounded: anon can call this.
  v_to    := least(p_to, p_from + 62);
  v_total := v_service.duration_min + v_service.buffer_min;

  return query
  select s.starts_at_utc
    from (
      select (sl.on_date + sl.starts_at) at time zone v_settings.timezone as starts_at_utc
        from public.availability_slots sl
       where sl.on_date between p_from and v_to
    ) s
   where s.starts_at_utc >= now() + make_interval(mins => v_settings.lead_time_min)
     and s.starts_at_utc <= now() + make_interval(days => v_settings.max_horizon_days)
     and not exists (
       select 1 from public.appointments a
        where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
          and tstzrange(a.starts_at, a.ends_at, '[)')
              && tstzrange(s.starts_at_utc, s.starts_at_utc + make_interval(mins => v_total), '[)')
     )
     and (
       select count(*) from public.appointments a2
        where a2.status in ('pending_approval','confirmed','checked_in','in_service','completed')
          and (a2.starts_at at time zone v_settings.timezone)::date
              = (s.starts_at_utc at time zone v_settings.timezone)::date
     ) < v_settings.max_appointments_per_day
   order by s.starts_at_utc;
end;
$$;

revoke all on function public.available_slots(date, date) from public;
grant execute on function public.available_slots(date, date) to anon, authenticated;

-- ---------- 4. The owner's view of a day -------------------------------
-- Hides nothing: booked and past times both appear, because "why can nobody
-- book 2pm?" is the question this answers.
create or replace function public.owner_day_slots(p_date date)
returns table (
  starts_at     timestamptz,
  local_time    text,
  is_booked     boolean,
  is_past       boolean,
  reference     text,
  customer_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service  public.services%rowtype;
  v_total    integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();
  v_total := coalesce(v_service.duration_min, 60) + coalesce(v_service.buffer_min, 0);

  return query
  select s.starts_at_utc,
         to_char(s.starts_at_utc at time zone v_settings.timezone, 'HH24:MI'),
         clash.id is not null,
         s.starts_at_utc < now(),
         clash.reference,
         cust.full_name
    from (
      select (sl.on_date + sl.starts_at) at time zone v_settings.timezone as starts_at_utc
        from public.availability_slots sl
       where sl.on_date = p_date
    ) s
    left join lateral (
      select a.id, a.reference, a.customer_id
        from public.appointments a
       where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
         and tstzrange(a.starts_at, a.ends_at, '[)')
             && tstzrange(s.starts_at_utc, s.starts_at_utc + make_interval(mins => v_total), '[)')
       limit 1
    ) clash on true
    left join public.customers cust on cust.id = clash.customer_id
   order by s.starts_at_utc;
end;
$$;

revoke all on function public.owner_day_slots(date) from public, anon;
grant execute on function public.owner_day_slots(date) to authenticated;

/** Slot and booking counts per day, for the month grid. One query per month. */
create or replace function public.month_slot_summary(p_from date, p_to date)
returns table (on_date date, slot_count integer, booked_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  return query
  select d::date,
         (select count(*)::integer from public.availability_slots sl where sl.on_date = d::date),
         (select count(*)::integer from public.appointments a
           where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
             and (a.starts_at at time zone v_settings.timezone)::date = d::date)
    from generate_series(p_from, p_to, interval '1 day') d
   order by d;
end;
$$;

revoke all on function public.month_slot_summary(date, date) from public, anon;
grant execute on function public.month_slot_summary(date, date) to authenticated;

-- ---------- 5. Editing a day -------------------------------------------
/** Replace a day's times wholesale. `{}` clears the day. */
create or replace function public.set_day_slots(p_date date, p_times time[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_time     time;
  v_count    integer := 0;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  foreach v_time in array coalesce(p_times, array[]::time[]) loop
    -- An off-grid time would be visible and unbookable, which is worse than
    -- absent: book_appointment rejects a start that is not on the grid.
    if (extract(hour from v_time) * 60 + extract(minute from v_time))::integer
         % v_settings.slot_granularity_min <> 0 then
      raise exception 'SLOT_MISALIGNED' using errcode = 'P0001',
        detail = format('%s is not on a %s minute boundary',
                        to_char(v_time, 'HH24:MI'), v_settings.slot_granularity_min);
    end if;
  end loop;

  delete from public.availability_slots where on_date = p_date;

  foreach v_time in array coalesce(p_times, array[]::time[]) loop
    insert into public.availability_slots (on_date, starts_at)
    values (p_date, v_time)
    on conflict (on_date, starts_at) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

/** Copy one day's times onto another. Replaces whatever the target had. */
create or replace function public.copy_day_slots(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_from = p_to then
    raise exception 'SAME_DAY' using errcode = 'P0001';
  end if;

  delete from public.availability_slots where on_date = p_to;

  insert into public.availability_slots (on_date, starts_at)
  select p_to, sl.starts_at from public.availability_slots sl where sl.on_date = p_from
  on conflict (on_date, starts_at) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_day_slots(date, time[]) from public, anon;
revoke all on function public.copy_day_slots(date, date) from public, anon;
grant execute on function public.set_day_slots(date, time[]) to authenticated;
grant execute on function public.copy_day_slots(date, date) to authenticated;

-- ---------- 6. Booking, without a service argument ----------------------
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

  if extract(epoch from p_starts_at)::bigint % (v_settings.slot_granularity_min * 60) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;
  if p_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_starts_at at time zone v_settings.timezone)::time;

  -- The whole availability question, now that a slot is the only answer.
  if not exists (
    select 1 from public.availability_slots sl
     where sl.on_date = v_local_date and sl.starts_at = v_local_time
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.appointments a
    where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
      and (a.starts_at at time zone v_settings.timezone)::date = v_local_date
  ) >= v_settings.max_appointments_per_day then
    raise exception 'DAILY_CAPACITY_REACHED' using errcode = 'P0001';
  end if;

  insert into public.customers (email, full_name, mobile, marketing_consent, consent_updated_at, last_seen_at)
  values (p_email, p_full_name, p_mobile, p_consent,
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

-- ---------- 7. Owner-created and offered appointments -------------------
create or replace function public.create_appointment_as_owner(
  p_starts_at timestamptz,
  p_full_name text,
  p_email     text,
  p_mobile    text default null,
  p_note      text default null
)
returns table (appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service  public.services%rowtype;
  v_customer uuid;
  v_ref      text;
  v_id       uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_service from public.hair_appointment();
  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.customers (email, full_name, mobile, last_seen_at)
  values (p_email, p_full_name, p_mobile, now())
  on conflict (lower(email::text)) where deleted_at is null
  do update set
    full_name    = excluded.full_name,
    mobile       = coalesce(excluded.mobile, public.customers.mobile),
    last_seen_at = now()
  returning id into v_customer;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approved_at, approved_by)
    values
      (v_ref, v_customer, v_service.id, p_starts_at,
       p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_service.price_pence, p_note, 'owner', 'confirmed', false, now(), auth.uid())
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref;
end;
$$;

create or replace function public.offer_slot_to_request(
  p_request_id      uuid,
  p_starts_at       timestamptz,
  p_override_reason text default null
)
returns table (appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request  public.availability_requests%rowtype;
  v_service  public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_date     date;
  v_ahead    text;
  v_customer uuid;
  v_ref      text;
  v_id       uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();
  select * into v_request from public.availability_requests where id = p_request_id;

  if v_request.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_request.status not in ('new', 'awaiting_response', 'offer_sent') then
    raise exception 'REQUEST_CLOSED' using errcode = 'P0001';
  end if;

  v_date := (p_starts_at at time zone v_settings.timezone)::date;

  -- First come, first served, enforced rather than displayed.
  if p_override_reason is null or trim(p_override_reason) = '' then
    select string_agg(earlier.full_name || ' (' ||
                      to_char(earlier.created_at, 'DD Mon HH24:MI') || ')', ', '
                      order by earlier.created_at)
      into v_ahead
      from public.availability_requests earlier
     where earlier.status in ('new', 'awaiting_response')
       and earlier.created_at < v_request.created_at
       and (cardinality(earlier.preferred_dates) = 0 or v_date = any(earlier.preferred_dates));

    if v_ahead is not null then
      raise exception 'EARLIER_REQUEST_WAITING' using errcode = 'P0001', detail = v_ahead;
    end if;
  end if;

  insert into public.customers (email, full_name, mobile, last_seen_at)
  values (v_request.email, v_request.full_name, v_request.mobile, now())
  on conflict (lower(email::text)) where deleted_at is null
  do update set
    full_name    = excluded.full_name,
    mobile       = coalesce(excluded.mobile, public.customers.mobile),
    last_seen_at = now()
  returning id into v_customer;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approved_at, approved_by)
    values
      (v_ref, v_customer, v_service.id, p_starts_at,
       p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_service.price_pence, v_request.notes, 'availability_request', 'confirmed',
       false, now(), auth.uid())
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  update public.availability_requests
     set status = 'converted',
         converted_appointment_id = v_id,
         customer_id = v_customer,
         responded_at = now(),
         owner_response = coalesce(nullif(trim(p_override_reason), ''),
                                   'Offered a slot and booked in')
   where id = p_request_id;

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.create_appointment_as_owner(timestamptz, text, text, text, text)
  from public, anon;
revoke all on function public.offer_slot_to_request(uuid, timestamptz, text) from public, anon;
grant execute on function public.create_appointment_as_owner(timestamptz, text, text, text, text)
  to authenticated;
grant execute on function public.offer_slot_to_request(uuid, timestamptz, text) to authenticated;
