-- =====================================================================
-- 0009_book_uses_one_engine.sql — the writer and the reader must agree
--
-- Bug, caught by the 0008 test run:
--
--   OUTSIDE_AVAILABILITY when booking a slot the site had just offered.
--
-- `book_appointment()` has validated availability by re-deriving it from
-- `availability_rules` and `availability_exceptions` since 0002. Every time the
-- availability model grew, that copy fell further behind the engine:
--
--   * 0007 let the owner publish custom hours as a whole-day closure plus
--     extra_hours windows. book_appointment sees the closure, returns early,
--     and rejects — so a day of published hours was visible and unbookable.
--   * 0008 added explicit start times, which book_appointment knew nothing
--     about at all.
--
-- Neither was caught earlier because the tests booked slots on ordinary
-- weekdays, where the two implementations happened to agree.
--
-- The fix is not to patch the copy again. `day_candidate_starts()` is already
-- the single source of truth for what a day offers, so booking now asks it
-- rather than reimplementing it. The reader and the writer cannot drift apart
-- if there is only one of them.
--
-- What stays in book_appointment is what genuinely belongs to the write path:
-- grid alignment, lead time, horizon, the daily cap, and the customer upsert.
-- =====================================================================

create or replace function public.book_appointment(
  p_service_id  uuid,
  p_starts_at   timestamptz,
  p_full_name   text,
  p_email       text,
  p_mobile      text default null,
  p_note        text default null,
  p_consent     boolean default false
)
returns table (appointment_id uuid, reference text, status public.appointment_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.booking_settings%rowtype;
  v_service    public.services%rowtype;
  v_ends_at    timestamptz;
  v_local_date date;
  v_customer   uuid;
  v_ref        text;
  v_id         uuid;
  v_returning  boolean;
  v_status     public.appointment_status;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service  from public.services
    where id = p_service_id and is_active and archived_at is null;

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Slots are aligned to the configured granularity; anything else is forged.
  if extract(epoch from p_starts_at)::bigint % (v_settings.slot_granularity_min * 60) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;

  if p_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  v_ends_at    := p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min);
  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;

  -- The one availability question, asked of the one engine. This covers
  -- standing hours, published hours, explicit slots, closures and breaks —
  -- and by construction agrees with what the customer was shown.
  if not exists (
    select 1
      from public.day_candidate_starts(v_local_date, p_service_id) c
     where c.starts_at = p_starts_at
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

  -- The hybrid trust gate is off since 0007 (availability is the gate), but the
  -- machinery stays: flipping approve_first_time back on restores it with no
  -- migration. "Returning" still means a completed visit, not merely a booking.
  select exists (
    select 1 from public.appointments a
    where a.customer_id = v_customer and a.status = 'completed'
  ) into v_returning;

  if v_returning or not v_settings.approve_first_time then
    v_status   := 'confirmed';
    v_deadline := null;
  else
    v_status   := 'pending_approval';
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_starts_at
    );
  end if;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approval_deadline,
       approved_at)
    values
      (v_ref, v_customer, v_service.id, p_starts_at, v_ends_at, v_service.price_pence,
       p_note, 'web', v_status, not v_returning, v_deadline,
       case when v_status = 'confirmed' then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref, v_status;
end;
$$;

revoke all on function public.book_appointment(uuid, timestamptz, text, text, text, text, boolean) from public;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, text, text, boolean) to anon, authenticated;
