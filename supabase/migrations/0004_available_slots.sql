-- =====================================================================
-- 0004_available_slots.sql — the availability engine
--
-- Why this is a function and not a client-side calculation:
--
-- docs/HOOKS.md describes `useAvailability` generating slots in the browser
-- from rules minus exceptions minus live appointments. That cannot work. Anon
-- has no SELECT policy on `appointments` — deliberately, per the closing
-- comment of 0002 — and any policy broad enough to compute availability in the
-- browser would expose the salon's entire schedule: who is booked, when, and
-- how busy the business is.
--
-- So the subtraction happens here, under `security definer`, and only the
-- *free* slots come back. A caller learns what it can book and nothing else.
-- =====================================================================

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
  v_step_sec  integer;
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

  -- Bound the work. This is callable by anon, and an unbounded range is a
  -- cheap way to make the database expensive.
  v_to := least(p_to, p_from + 62);

  v_step_sec  := v_settings.slot_granularity_min * 60;
  -- The buffer is reserved but not offered: a slot occupies chair time plus
  -- tidy-up, while the customer only ever sees the start of the chair time.
  v_total_min := v_service.duration_min + v_service.buffer_min;

  return query
  with days as (
    select d::date as on_date
      from generate_series(p_from, v_to, interval '1 day') d
  ),
  -- Bookable windows: standing hours on days not fully closed, plus any
  -- explicitly opened extra hours.
  windows as (
    select d.on_date, r.opens_at, r.closes_at
      from days d
      join public.availability_rules r
        on r.day_of_week = extract(dow from d.on_date)::smallint
       and r.is_open
     where not exists (
       select 1 from public.availability_exceptions e
        where e.on_date = d.on_date
          and e.kind = 'closure'
          and e.starts_at is null          -- a whole-day closure
     )
    union all
    select d.on_date, e.starts_at, e.ends_at
      from days d
      join public.availability_exceptions e
        on e.on_date = d.on_date
       and e.kind = 'extra_hours'
       and e.starts_at is not null
       and e.ends_at is not null
  ),
  -- Wall-clock windows become instants before anything is generated, so a day
  -- spanning a DST change still produces real times.
  bounds as (
    select
      (w.on_date + w.opens_at)  at time zone v_settings.timezone as win_start,
      (w.on_date + w.closes_at) at time zone v_settings.timezone as win_end
    from windows w
  ),
  candidates as (
    select gs as starts_at
      from bounds b
      cross join lateral generate_series(
        -- Snap to the granularity grid. book_appointment() rejects a start
        -- that is not aligned, so an off-grid opening time such as 09:07 must
        -- not silently produce slots nobody can book.
        to_timestamp(ceil(extract(epoch from b.win_start) / v_step_sec) * v_step_sec),
        b.win_end - make_interval(mins => v_service.duration_min),
        make_interval(secs => v_step_sec)
      ) gs
  )
  select c.starts_at
    from candidates c
   where c.starts_at >= now() + make_interval(mins => v_settings.lead_time_min)
     and c.starts_at <= now() + make_interval(days => v_settings.max_horizon_days)

     -- Not inside a break or a partial closure.
     and not exists (
       select 1 from public.availability_exceptions e
        where e.on_date = (c.starts_at at time zone v_settings.timezone)::date
          and e.kind in ('closure', 'break')
          and e.starts_at is not null
          and (c.starts_at at time zone v_settings.timezone)::time < e.ends_at
          and ((c.starts_at at time zone v_settings.timezone)::time
                 + make_interval(mins => v_service.duration_min))::time > e.starts_at
     )

     -- Not colliding with anything already occupying the calendar. Same status
     -- set as appointments_no_overlap, so what this offers is exactly what the
     -- exclusion constraint will accept.
     and not exists (
       select 1 from public.appointments a
        where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
          and tstzrange(a.starts_at, a.ends_at, '[)')
              && tstzrange(c.starts_at, c.starts_at + make_interval(mins => v_total_min), '[)')
     )

     -- The day is not already at its cap.
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

comment on function public.available_slots(uuid, date, date) is
  'Free bookable slot starts for one service over a date range. Returns only what is bookable — never which slots are taken, or by whom.';
