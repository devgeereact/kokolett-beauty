-- =====================================================================
-- 0079_available_slots_counts_each_day_once.sql
--
-- `available_slots()` counted the day's bookings once per candidate slot.
--
-- The daily-cap check was a correlated subquery in the WHERE clause:
--
--   and ( select count(*) from public.appointments a2
--          where a2.status in (...)
--            and (a2.starts_at at time zone tz)::date
--                = (s.starts_at_utc at time zone tz)::date
--       ) < v_settings.max_appointments_per_day
--
-- Two things make that expensive. It runs for every row that survives the
-- earlier filters, and `(starts_at at time zone tz)::date` is not sargable:
-- no index exists on that expression, and none can easily, because
-- `timezone(text, timestamptz)` is STABLE rather than IMMUTABLE, so Postgres
-- will not accept it in an index without wrapping it in a function that
-- asserts an immutability tzdata updates can violate. So every evaluation was
-- a sequential scan of `appointments`.
--
-- Measured on the live schema, in a rolled-back transaction seeded with 900
-- appointments over the 90-day horizon (this salon has none today; the point
-- is the shape as the diary fills):
--
--   before   Execution Time: 607.715 ms
--            SubPlan 1 -> Seq Scan on appointments a2 ... loops=424
--            estimated cost 1907544
--
--   after    Execution Time:  15.852 ms
--            HashAggregate over Index Scan using appointments_starts_at_idx,
--            900 rows, loops=1, joined once
--            estimated cost 27675
--
-- Thirty-eight times faster, and it stops growing with the product of
-- appointment count and horizon. `available_slots` is the anon-callable query
-- behind the public booking page, and `0045` widened its window from 62 days
-- to `max_horizon_days`, so this is the one endpoint an unauthenticated
-- visitor can make expensive.
--
-- The fix is a single grouped CTE rather than an index. Counting every day in
-- the window once, up front, needs no expression index and therefore carries
-- no tzdata assumption: the `at time zone` cast still happens, but 900 times
-- instead of 900 times per slot. The window is bounded in UTC so the scan can
-- use `appointments_starts_at_idx`.
--
-- `left join` with `coalesce(taken, 0)`, not an inner join: a day with no
-- bookings has no row in the CTE and must still be offered.
--
-- Everything else is `0045`'s function unchanged, including the overlap check,
-- which was already served by the `appointments_no_overlap` GiST index
-- (`loops=5` in both plans) and is left exactly as it was.
-- =====================================================================

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

  v_to    := least(p_to, p_from + greatest(coalesce(v_settings.max_horizon_days, 90), 1));
  v_total := v_service.duration_min + v_service.buffer_min;

  return query
  with day_counts as (
    -- One pass over the appointments in the window, grouped by salon-local
    -- date. Bounded in UTC on both sides so the index on starts_at can serve
    -- it; the local-date cast then happens once per appointment rather than
    -- once per appointment per candidate slot.
    select (a.starts_at at time zone v_settings.timezone)::date as local_date,
           count(*) as taken
      from public.appointments a
     where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
       and a.starts_at >= (p_from::timestamp) at time zone v_settings.timezone
       and a.starts_at <  ((v_to + 1)::timestamp) at time zone v_settings.timezone
     group by 1
  )
  select s.starts_at_utc
    from (
      select sl.on_date,
             (sl.on_date + sl.starts_at) at time zone v_settings.timezone as starts_at_utc
        from public.availability_slots sl
       where sl.on_date between p_from and v_to
    ) s
    left join day_counts d on d.local_date = s.on_date
   where s.starts_at_utc >= now() + make_interval(mins => v_settings.lead_time_min)
     and s.starts_at_utc <= now() + make_interval(days => v_settings.max_horizon_days)
     -- A day nobody has booked has no row in day_counts and is still open.
     and coalesce(d.taken, 0) < v_settings.max_appointments_per_day
     and not exists (
       select 1 from public.appointments a
        where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
          and tstzrange(a.starts_at, a.ends_at, '[)')
              && tstzrange(s.starts_at_utc, s.starts_at_utc + make_interval(mins => v_total), '[)')
     )
   order by s.starts_at_utc;
end;
$$;

revoke all on function public.available_slots(date, date) from public;
grant execute on function public.available_slots(date, date) to anon, authenticated;

comment on function public.available_slots(date, date) is
  'The public booking page''s slot list. Since 0079 the daily-capacity check is a '
  'single grouped CTE joined once rather than a correlated count evaluated per '
  'candidate slot, which was a sequential scan of appointments each time.';
