-- The booking horizon is one number, and it is the owner's.
--
-- `available_slots` capped its own scan at `p_from + 62` days, with the comment
-- "still bounded: anon can call this". The guard is right; the constant was
-- not. `booking_settings.max_horizon_days` is 90, the weekly generator fills
-- 90 days ahead, the owner's Booking Rules card tells her the horizon is 90 —
-- and this function would not return a slot past day 62 no matter what any
-- caller asked for. So the salon published three months of times and the
-- database served two, silently, with the last month unreachable.
--
-- Raising the client's own window (`useAvailability`) was not enough on its own
-- and would have looked fixed while still being wrong: the client asked for 90
-- days and got 62 back with no error.
--
-- The cap now comes from the same setting as everything else, so there is one
-- horizon in the system rather than three. The function is still bounded, and
-- bounded twice over: this cap limits how many days are scanned, and the
-- `now() + max_horizon_days` filter below already refuses anything past the
-- policy horizon however far ahead `p_from` is pushed.

create or replace function public.available_slots(p_from date, p_to date)
returns table(slot_start timestamp with time zone)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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

  -- Bounded by the salon's own horizon rather than a constant that nothing
  -- else in the system agrees with. `greatest(..., 1)` keeps a nonsensical
  -- setting from turning this into a zero-day window.
  v_to    := least(p_to, p_from + greatest(coalesce(v_settings.max_horizon_days, 90), 1));
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
$function$;
