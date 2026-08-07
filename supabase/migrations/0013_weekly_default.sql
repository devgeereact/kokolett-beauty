-- =====================================================================
-- 0013_weekly_default.sql — a repeating week, without a second source of truth
--
-- Setting every day by hand is honest but tedious, so the owner asked for a
-- repeating weekly default. The danger is obvious: the last rebuild existed
-- precisely because availability had four sources that disagreed. A weekly
-- pattern consulted *at booking time* would be a fifth.
--
-- So the template is a **generator, not a source**. It writes real rows into
-- `availability_slots` and is never consulted when anything is booked. A day
-- still is exactly its list of times; the template just saves typing them.
--
-- The hard part is knowing when to leave a day alone. If the generator simply
-- filled every empty day, then clearing a Wednesday would silently refill it
-- overnight — the owner would delete her afternoon off and find it back.
-- `day_decided` records every date a human or the generator has already ruled
-- on, and the generator skips those. Editing a day marks it decided, so a day
-- you cleared stays cleared.
-- =====================================================================

-- ---------- The pattern -------------------------------------------------
create table if not exists public.weekly_template (
  id          uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  starts_at   time not null,
  created_at  timestamptz not null default timezone('utc', now()),
  constraint weekly_template_unique unique (day_of_week, starts_at)
);

alter table public.weekly_template enable row level security;

drop policy if exists weekly_template_public_read on public.weekly_template;
create policy weekly_template_public_read on public.weekly_template
  for select using (true);

drop policy if exists weekly_template_owner_all on public.weekly_template;
create policy weekly_template_owner_all on public.weekly_template
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- Dates a human (or the generator) has already ruled on -------
create table if not exists public.day_decided (
  on_date    date primary key,
  decided_by text not null default 'owner' check (decided_by in ('owner', 'template')),
  decided_at timestamptz not null default timezone('utc', now())
);

alter table public.day_decided enable row level security;

drop policy if exists day_decided_owner_all on public.day_decided;
create policy day_decided_owner_all on public.day_decided
  for all using (public.is_owner()) with check (public.is_owner());

comment on table public.day_decided is
  'Dates already ruled on. The weekly generator skips these, so a day the owner cleared stays cleared instead of being refilled overnight.';

-- ---------- Editing a day marks it decided ------------------------------
create or replace function public.set_day_slots(p_date date, p_times time[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_time     time;
  v_final    time[];
  v_count    integer := 0;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  foreach v_time in array coalesce(p_times, array[]::time[]) loop
    if (extract(hour from v_time) * 60 + extract(minute from v_time))::integer
         % v_settings.slot_granularity_min <> 0 then
      raise exception 'SLOT_MISALIGNED' using errcode = 'P0001',
        detail = format('%s is not on a %s minute boundary',
                        to_char(v_time, 'HH24:MI'), v_settings.slot_granularity_min);
    end if;
  end loop;

  -- A time with a live appointment against it survives any bulk edit (0012).
  select array(
    select distinct t from (
      select unnest(coalesce(p_times, array[]::time[])) as t
      union
      select public.booked_times_on(p_date)
    ) merged
    order by t
  ) into v_final;

  delete from public.availability_slots where on_date = p_date;

  foreach v_time in array v_final loop
    insert into public.availability_slots (on_date, starts_at)
    values (p_date, v_time)
    on conflict (on_date, starts_at) do nothing;
    v_count := v_count + 1;
  end loop;

  -- The owner has now ruled on this date, including ruling it empty.
  insert into public.day_decided (on_date, decided_by)
  values (p_date, 'owner')
  on conflict (on_date) do update set decided_by = 'owner', decided_at = now();

  return v_count;
end;
$$;

revoke all on function public.set_day_slots(date, time[]) from public, anon;
grant execute on function public.set_day_slots(date, time[]) to authenticated;

-- ---------- Reading and writing the pattern -----------------------------
create or replace function public.set_weekly_template(
  p_day_of_week smallint,
  p_times       time[]
)
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
  if p_day_of_week < 0 or p_day_of_week > 6 then
    raise exception 'INVALID_DAY' using errcode = 'P0001';
  end if;

  select * into v_settings from public.booking_settings where id;

  foreach v_time in array coalesce(p_times, array[]::time[]) loop
    if (extract(hour from v_time) * 60 + extract(minute from v_time))::integer
         % v_settings.slot_granularity_min <> 0 then
      raise exception 'SLOT_MISALIGNED' using errcode = 'P0001',
        detail = format('%s is not on a %s minute boundary',
                        to_char(v_time, 'HH24:MI'), v_settings.slot_granularity_min);
    end if;
  end loop;

  delete from public.weekly_template where day_of_week = p_day_of_week;

  foreach v_time in array coalesce(p_times, array[]::time[]) loop
    insert into public.weekly_template (day_of_week, starts_at)
    values (p_day_of_week, v_time)
    on conflict (day_of_week, starts_at) do nothing;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.set_weekly_template(smallint, time[]) from public, anon;
grant execute on function public.set_weekly_template(smallint, time[]) to authenticated;

-- ---------- Generating days from the pattern ----------------------------
/**
 * Write the template into real days.
 *
 * `p_replace = false` (the default, and what the nightly job uses) skips any
 * date already decided — by the owner or by an earlier run — so it only ever
 * fills forward into untouched days. `p_replace = true` is the deliberate
 * "reapply my week over the top" action, and still cannot remove a booked time.
 */
create or replace function public.apply_weekly_template(
  p_from    date,
  p_to      date,
  p_replace boolean default false
)
returns table (days_filled integer, slots_written integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date   date;
  v_times  time[];
  v_days   integer := 0;
  v_slots  integer := 0;
  v_written integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_to < p_from then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
  if p_to > p_from + 400 then
    raise exception 'RANGE_TOO_LONG' using errcode = 'P0001';
  end if;

  for v_date in select d::date from generate_series(p_from, p_to, interval '1 day') d loop
    if not p_replace and exists (select 1 from public.day_decided dd where dd.on_date = v_date) then
      continue;
    end if;

    select array(
      select wt.starts_at from public.weekly_template wt
       where wt.day_of_week = extract(dow from v_date)::smallint
       order by wt.starts_at
    ) into v_times;

    -- A weekday with no template times means "closed", and writing an empty
    -- day is a real decision — it stops the generator revisiting it.
    v_written := public.set_day_slots(v_date, v_times);

    -- set_day_slots marks the date as owner-decided; when the *generator* is
    -- the one deciding, say so, so the distinction survives for anyone reading.
    update public.day_decided
       set decided_by = 'template'
     where on_date = v_date and not p_replace;

    v_days := v_days + 1;
    v_slots := v_slots + v_written;
  end loop;

  return query select v_days, v_slots;
end;
$$;

revoke all on function public.apply_weekly_template(date, date, boolean) from public, anon;
grant execute on function public.apply_weekly_template(date, date, boolean) to authenticated;

/** How far the generator has already filled, and what the pattern holds. */
create or replace function public.weekly_template_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_tz       text;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;
  v_tz := v_settings.timezone;

  return jsonb_build_object(
    'template_slot_count', (select count(*) from public.weekly_template),
    'filled_to', (
      select max(dd.on_date) from public.day_decided dd
       where dd.on_date >= (now() at time zone v_tz)::date
    ),
    'horizon_days', v_settings.max_horizon_days,
    'granularity_min', v_settings.slot_granularity_min
  );
end;
$$;

revoke all on function public.weekly_template_status() from public, anon;
grant execute on function public.weekly_template_status() to authenticated;

-- ---------- Keep the horizon filled -------------------------------------
-- Runs as the table owner rather than a signed-in user, so `is_owner()` is not
-- available; the work is done directly here instead of through the RPC.
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

    select array(
      select wt.starts_at from public.weekly_template wt
       where wt.day_of_week = extract(dow from v_date)::smallint
       order by wt.starts_at
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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'extend-weekly-template';
    perform cron.schedule('extend-weekly-template', '13 2 * * *',
      $cron$select public.extend_weekly_template()$cron$);
  end if;
exception when others then
  raise notice 'Could not schedule extend-weekly-template (%).', sqlerrm;
end $$;

-- ---------- Booking asks for a real name and a number -------------------
-- Both are business rules the owner asked for, so they belong here rather than
-- only in the form: a validation that lives in the browser is a suggestion.
-- The owner's own booking path stays lenient — she is looking at the customer,
-- and sometimes only has a first name.
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
