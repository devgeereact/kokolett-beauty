-- =====================================================================
-- 0012_slots_keep_their_bookings.sql
--
-- `set_day_slots` and `copy_day_slots` both clear the day before writing. That
-- is right for free times and wrong for taken ones: deleting the slot behind a
-- live appointment does not cancel it, does not tell the customer, and leaves
-- the owner's day panel — which reads from the slot list — showing nothing at
-- a time somebody is actually turning up.
--
-- The interface already avoided it, but an invariant this important should not
-- depend on a disabled button. A time with a live appointment against it
-- survives both operations, and freeing it is done by cancelling the
-- appointment, which is the act that tells the customer.
-- =====================================================================

/** Times on a date that a live appointment depends on. */
create or replace function public.booked_times_on(p_date date)
returns setof time
language sql
stable
security definer
set search_path = public
as $$
  select distinct (a.starts_at at time zone s.timezone)::time
    from public.appointments a
    cross join (select timezone from public.booking_settings where id) s
   where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
     and (a.starts_at at time zone s.timezone)::date = p_date;
$$;

revoke all on function public.booked_times_on(date) from public, anon;
grant execute on function public.booked_times_on(date) to authenticated;

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
    -- An off-grid time would be visible and unbookable, which is worse than
    -- absent: book_appointment rejects a start that is not on the grid.
    if (extract(hour from v_time) * 60 + extract(minute from v_time))::integer
         % v_settings.slot_granularity_min <> 0 then
      raise exception 'SLOT_MISALIGNED' using errcode = 'P0001',
        detail = format('%s is not on a %s minute boundary',
                        to_char(v_time, 'HH24:MI'), v_settings.slot_granularity_min);
    end if;
  end loop;

  -- Whatever the caller asked for, a booked time stays.
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

  return v_count;
end;
$$;

create or replace function public.copy_day_slots(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_times time[];
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;
  if p_from = p_to then
    raise exception 'SAME_DAY' using errcode = 'P0001';
  end if;

  select array(
    select sl.starts_at from public.availability_slots sl
     where sl.on_date = p_from order by sl.starts_at
  ) into v_times;

  -- Routed through set_day_slots so the booked-time guarantee holds here too.
  return public.set_day_slots(p_to, v_times);
end;
$$;

revoke all on function public.set_day_slots(date, time[]) from public, anon;
revoke all on function public.copy_day_slots(date, date) from public, anon;
grant execute on function public.set_day_slots(date, time[]) to authenticated;
grant execute on function public.copy_day_slots(date, date) to authenticated;
