-- =====================================================================
-- 0008_explicit_slots.sql — publishing individual start times
--
-- Windows ("I work 09:00–17:00") are a coarse instrument. The owner asked to
-- see the actual slots for a day, add one, and delete one. That is a different
-- statement from a window:
--
--   a window says  "I am here between these times, fit what you like inside"
--   a slot says    "you may start an appointment at 14:00"
--
-- The distinction matters because an appointment's length comes from the
-- service, not from the slot. A published 14:00 slot is bookable for a 90
-- minute colour even though no 90 minute window exists around it — the overlap
-- constraint still stops it colliding with anything else. That is exactly the
-- flexibility a one-person salon needs: "I can take you at 6, if it's just a
-- trim" is a slot, not an opening hour.
--
-- Both models feed one engine. `day_candidate_starts()` is now the single
-- source of truth for what a day offers, and `available_slots()` is a filter
-- over it.
-- =====================================================================

create table if not exists public.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  on_date    date not null,
  starts_at  time not null,
  note       text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint availability_slots_unique unique (on_date, starts_at)
);

create index if not exists availability_slots_date_idx
  on public.availability_slots (on_date);

alter table public.availability_slots enable row level security;

-- Read is public for the same reason the opening rules are: the booking UI
-- needs to know what exists. It carries no personal data — only times.
drop policy if exists availability_slots_public_read on public.availability_slots;
create policy availability_slots_public_read on public.availability_slots
  for select using (true);

drop policy if exists availability_slots_owner_all on public.availability_slots;
create policy availability_slots_owner_all on public.availability_slots
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- One source of truth for a day's start times ---------------
-- Everything a date offers, before anything is subtracted for bookings, lead
-- time or capacity. Both the customer engine and the owner's slot grid read
-- this, so the two can never disagree about what was published.
create or replace function public.day_candidate_starts(
  p_date       date,
  p_service_id uuid
)
returns table (starts_at timestamptz, source text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service  public.services%rowtype;
  v_step_sec integer;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.services
   where id = p_service_id and archived_at is null;

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_step_sec := v_settings.slot_granularity_min * 60;

  return query
  with windows as (
    -- Standing weekly hours, unless the day is closed outright.
    select r.opens_at, r.closes_at
      from public.availability_rules r
     where r.day_of_week = extract(dow from p_date)::smallint
       and r.is_open
       and not exists (
         select 1 from public.availability_exceptions e
          where e.on_date = p_date and e.kind = 'closure' and e.starts_at is null
       )
    union all
    -- Hours published for this date specifically.
    select e.starts_at, e.ends_at
      from public.availability_exceptions e
     where e.on_date = p_date
       and e.kind = 'extra_hours'
       and e.starts_at is not null
       and e.ends_at is not null
  ),
  bounds as (
    select (p_date + w.opens_at)  at time zone v_settings.timezone as win_start,
           (p_date + w.closes_at) at time zone v_settings.timezone as win_end
      from windows w
  ),
  from_windows as (
    -- Inside a window the whole service must fit: a window is a promise about
    -- a stretch of time, so offering a start it cannot contain would be a lie.
    select gs as starts_at, 'window'::text as source
      from bounds b
      cross join lateral generate_series(
        to_timestamp(ceil(extract(epoch from b.win_start) / v_step_sec) * v_step_sec),
        b.win_end - make_interval(mins => v_service.duration_min),
        make_interval(secs => v_step_sec)
      ) gs
  ),
  from_slots as (
    -- An explicit slot is a promise about a *start*. The appointment runs its
    -- natural length past it; the overlap constraint keeps that honest.
    select (p_date + s.starts_at) at time zone v_settings.timezone as starts_at,
           'explicit'::text as source
      from public.availability_slots s
     where s.on_date = p_date
  ),
  merged as (
    select * from from_windows
    union all
    select * from from_slots
  )
  -- An explicit slot wins over a window-derived duplicate, so the owner's own
  -- act is what shows in the grid.
  select distinct on (m.starts_at) m.starts_at, m.source
    from merged m
   where not exists (
     select 1 from public.availability_exceptions e
      where e.on_date = p_date
        and e.kind in ('closure', 'break')
        and e.starts_at is not null
        and (m.starts_at at time zone v_settings.timezone)::time < e.ends_at
        and ((m.starts_at at time zone v_settings.timezone)::time
               + make_interval(mins => v_service.duration_min))::time > e.starts_at
   )
   order by m.starts_at, (m.source = 'explicit') desc;
end;
$$;

revoke all on function public.day_candidate_starts(date, uuid) from public;
grant execute on function public.day_candidate_starts(date, uuid) to anon, authenticated;

-- ---------- available_slots, rebuilt over the shared helper ------------
create or replace function public.available_slots(
  p_service_id uuid,
  p_from       date,
  p_to         date
)
returns table (slot_start timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings  public.booking_settings%rowtype;
  v_service   public.services%rowtype;
  v_total_min integer;
  v_to        date;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.services
   where id = p_service_id and is_active and archived_at is null;

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_to < p_from then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;

  -- Still bounded: this is anon-callable.
  v_to := least(p_to, p_from + 62);
  v_total_min := v_service.duration_min + v_service.buffer_min;

  return query
  select c.starts_at
    from generate_series(p_from, v_to, interval '1 day') d
    cross join lateral public.day_candidate_starts(d::date, p_service_id) c
   where c.starts_at >= now() + make_interval(mins => v_settings.lead_time_min)
     and c.starts_at <= now() + make_interval(days => v_settings.max_horizon_days)
     and not exists (
       select 1 from public.appointments a
        where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
          and tstzrange(a.starts_at, a.ends_at, '[)')
              && tstzrange(c.starts_at, c.starts_at + make_interval(mins => v_total_min), '[)')
     )
     and (
       select count(*) from public.appointments a2
        where a2.status in ('pending_approval','confirmed','checked_in','in_service','completed')
          and (a2.starts_at at time zone v_settings.timezone)::date
              = (c.starts_at at time zone v_settings.timezone)::date
     ) < v_settings.max_appointments_per_day
   order by c.starts_at;
end;
$$;

revoke all on function public.available_slots(uuid, date, date) from public;
grant execute on function public.available_slots(uuid, date, date) to anon, authenticated;

-- ---------- What the owner sees for one day ----------------------------
-- Every start time the day offers, annotated with why it exists and whether it
-- is still free. Unlike available_slots this hides nothing: a booked slot and
-- a slot already in the past both appear, because "why can nobody book 2pm?"
-- is the question this screen exists to answer.
create or replace function public.owner_day_slots(
  p_date       date,
  p_service_id uuid
)
returns table (
  starts_at   timestamptz,
  local_time  text,
  source      text,
  is_booked   boolean,
  is_past     boolean,
  reference   text,
  customer_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings  public.booking_settings%rowtype;
  v_service   public.services%rowtype;
  v_total_min integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.services
   where id = p_service_id and archived_at is null;
  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_total_min := v_service.duration_min + v_service.buffer_min;

  return query
  select c.starts_at,
         to_char(c.starts_at at time zone v_settings.timezone, 'HH24:MI'),
         c.source,
         clash.id is not null,
         c.starts_at < now(),
         clash.reference,
         cust.full_name
    from public.day_candidate_starts(p_date, p_service_id) c
    left join lateral (
      select a.id, a.reference, a.customer_id
        from public.appointments a
       where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
         and tstzrange(a.starts_at, a.ends_at, '[)')
             && tstzrange(c.starts_at, c.starts_at + make_interval(mins => v_total_min), '[)')
       limit 1
    ) clash on true
    left join public.customers cust on cust.id = clash.customer_id
   order by c.starts_at;
end;
$$;

revoke all on function public.owner_day_slots(date, uuid) from public, anon;
grant execute on function public.owner_day_slots(date, uuid) to authenticated;

-- ---------- Publishing and deleting individual slots -------------------
create or replace function public.add_day_slot(
  p_date date,
  p_time time,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_id       uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  -- book_appointment() rejects a start that is off the granularity grid, so a
  -- slot at 14:07 would be visible and unbookable — worse than absent.
  if (extract(hour from p_time) * 60 + extract(minute from p_time))::integer
       % v_settings.slot_granularity_min <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001',
      detail = format('Times must fall on %s minute intervals',
                      v_settings.slot_granularity_min);
  end if;

  insert into public.availability_slots (on_date, starts_at, note)
  values (p_date, p_time, p_note)
  on conflict (on_date, starts_at) do update set note = excluded.note
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.remove_day_slot(p_date date, p_time time)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  delete from public.availability_slots
   where on_date = p_date and starts_at = p_time;
  get diagnostics v_deleted = row_count;

  -- Nothing explicit to delete means the slot came from a window, and the way
  -- to remove one of those is to block that stretch of time. Doing it silently
  -- here would leave the owner wondering why the slot came back.
  return v_deleted > 0;
end;
$$;

/**
 * Turn a window-driven day into an editable list of start times.
 *
 * Once the owner wants to delete individual slots, windows stop being the right
 * model — so this freezes what the day currently offers into explicit slots and
 * closes the windows. From then on the day is exactly the list she can see.
 */
create or replace function public.materialise_day_slots(
  p_date       date,
  p_service_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.booking_settings%rowtype;
  v_count    integer := 0;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  insert into public.availability_slots (on_date, starts_at, note)
  select p_date,
         (c.starts_at at time zone v_settings.timezone)::time,
         'From published hours'
    from public.day_candidate_starts(p_date, p_service_id) c
  on conflict (on_date, starts_at) do nothing;

  get diagnostics v_count = row_count;

  -- Close the windows: the explicit list is now the whole truth for this day.
  delete from public.availability_exceptions
   where on_date = p_date and kind = 'extra_hours';

  insert into public.availability_exceptions (kind, on_date, starts_at, ends_at, reason)
  select 'closure', p_date, null, null, 'Exact times'
   where not exists (
     select 1 from public.availability_exceptions e
      where e.on_date = p_date and e.kind = 'closure' and e.starts_at is null
   );

  return v_count;
end;
$$;

/** Drop every explicit slot for a date, handing the day back to its hours. */
create or replace function public.clear_day_slots(p_date date)
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

  delete from public.availability_slots where on_date = p_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.add_day_slot(date, time, text) from public, anon;
revoke all on function public.remove_day_slot(date, time) from public, anon;
revoke all on function public.materialise_day_slots(date, uuid) from public, anon;
revoke all on function public.clear_day_slots(date) from public, anon;
grant execute on function public.add_day_slot(date, time, text) to authenticated;
grant execute on function public.remove_day_slot(date, time) to authenticated;
grant execute on function public.materialise_day_slots(date, uuid) to authenticated;
grant execute on function public.clear_day_slots(date) to authenticated;
