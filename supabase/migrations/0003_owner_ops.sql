-- =====================================================================
-- 0003_owner_ops.sql — what the owner dashboard needs to run the salon
--
-- Additive and idempotent. Never edit 0001 or 0002.
--
-- Three things:
--   1. Seed the empty catalogue enough to be usable — categories and standing
--      opening hours. Services are NOT seeded: durations and prices are the
--      owner's to set, and inventing them would put wrong prices on a live site.
--   2. Hourly expiry of stale approval holds, so an unanswered first-time
--      booking releases its slot instead of silently occupying the calendar.
--   3. Owner-side read paths that RLS otherwise makes impossible or slow:
--      a dashboard summary, and appointment rows joined to customer + service.
-- =====================================================================

-- ---------- 1. Seed: service categories -------------------------------
-- Women's hair only. These four match the live holding page.
insert into public.service_categories (name, slug, sort_order) values
  ('Cutting',    'cutting',    10),
  ('Colouring',  'colouring',  20),
  ('Styling',    'styling',    30),
  ('Treatments', 'treatments', 40)
on conflict (slug) do nothing;

-- ---------- 1b. Seed: standing opening hours --------------------------
-- Tuesday to Saturday, 09:00–18:00 salon time. Sunday and Monday have no row
-- at all, which is how this schema expresses "closed" — book_appointment()
-- requires a matching open rule, so an absent row rejects the slot.
--
-- A placeholder the owner is expected to correct, not a business decision.
insert into public.availability_rules (day_of_week, opens_at, closes_at, is_open) values
  (2, '09:00', '18:00', true),
  (3, '09:00', '18:00', true),
  (4, '09:00', '18:00', true),
  (5, '09:00', '18:00', true),
  (6, '09:00', '18:00', true)
on conflict (day_of_week, opens_at) do nothing;

-- ---------- 2. Hourly expiry of approval holds ------------------------
-- expire_pending_approvals() was defined in 0002 but nothing ever called it.
-- pg_cron may not be installable on every plan, so failure here must not take
-- the migration down — the function stays callable by hand either way.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%). Approval holds will not expire automatically.', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Re-scheduling the same name twice errors, so clear any prior entry first.
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'expire-pending-approvals';

    perform cron.schedule(
      'expire-pending-approvals',
      '7 * * * *',
      $cron$select public.expire_pending_approvals()$cron$
    );
  end if;
exception when others then
  raise notice 'Could not schedule expire-pending-approvals (%).', sqlerrm;
end $$;

-- ---------- 3. Owner read paths ---------------------------------------
-- The dashboard opens on "what is happening today, and what needs me".
-- Computing that client-side means four round trips before anything renders;
-- this returns it in one. security definer + an explicit is_owner() guard,
-- because a definer function without that check is a public data leak.
create or replace function public.owner_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz        text;
  v_today     date;
  v_day_start timestamptz;
  v_day_end   timestamptz;
  v_result    jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select timezone into v_tz from public.booking_settings where id;
  v_today     := (now() at time zone v_tz)::date;
  v_day_start := (v_today::timestamp at time zone v_tz);
  v_day_end   := ((v_today + 1)::timestamp at time zone v_tz);

  select jsonb_build_object(
    'today', v_today,
    'timezone', v_tz,
    'today_count', (
      select count(*) from public.appointments a
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
    ),
    'today_revenue_pence', (
      select coalesce(sum(a.price_pence), 0) from public.appointments a
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('confirmed','checked_in','in_service','completed')
    ),
    'pending_approval_count', (
      select count(*) from public.appointments a where a.status = 'pending_approval'
    ),
    -- Surfaced separately: a hold inside its last two hours is the one the
    -- owner has to answer now, not merely soon.
    'urgent_approval_count', (
      select count(*) from public.appointments a
      where a.status = 'pending_approval'
        and a.approval_deadline is not null
        and a.approval_deadline < now() + interval '2 hours'
    ),
    'new_request_count', (
      select count(*) from public.availability_requests r where r.status = 'new'
    ),
    'upcoming_7d_count', (
      select count(*) from public.appointments a
      where a.starts_at >= now() and a.starts_at < now() + interval '7 days'
        and a.status in ('pending_approval','confirmed')
    ),
    'active_service_count', (
      select count(*) from public.services s
      where s.is_active and s.archived_at is null
    ),
    'customer_count', (
      select count(*) from public.customers c where c.deleted_at is null
    ),
    'failed_email_count', (
      select count(*) from public.email_messages m where m.status in ('failed','bounced')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.owner_dashboard_summary() from public, anon;
grant execute on function public.owner_dashboard_summary() to authenticated;

-- A denormalised view of appointments for owner screens. RLS on the underlying
-- tables still applies — this is a view, not a definer function, so a customer
-- or anon selecting from it gets nothing.
create or replace view public.appointments_detailed
with (security_invoker = true) as
select
  a.*,
  c.full_name         as customer_name,
  c.email             as customer_email,
  c.mobile            as customer_mobile,
  c.marketing_consent as customer_marketing_consent,
  s.name              as service_name,
  s.slug              as service_slug,
  s.duration_min      as service_duration_min,
  s.buffer_min        as service_buffer_min,
  -- "Returning" carries the same meaning as in book_appointment(): a completed
  -- appointment, not merely a prior booking. The owner sees the same trust
  -- signal the booking policy acted on.
  (
    select count(*) from public.appointments prior
    where prior.customer_id = a.customer_id
      and prior.status = 'completed'
      and prior.id <> a.id
  ) as customer_completed_count
from public.appointments a
join public.customers c on c.id = a.customer_id
join public.services  s on s.id = a.service_id;

comment on view public.appointments_detailed is
  'Owner-facing appointment rows joined to customer and service. security_invoker, so RLS on the base tables governs access.';

-- ---------- 4. Owner-side appointment transitions ---------------------
-- The owner could update appointments directly through RLS, but each of these
-- has to write several columns consistently, and a half-applied approval (a
-- status change with no approved_at) is worse than a rejected one.
create or replace function public.approve_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.appointments;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  update public.appointments
     set status = 'confirmed',
         approved_at = now(),
         approved_by = auth.uid(),
         approval_deadline = null
   where id = p_appointment_id
     and status = 'pending_approval'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'NOT_PENDING' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public.reject_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.appointments;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  update public.appointments
     set status = 'rejected',
         rejected_at = now(),
         rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Declined by the salon'),
         approval_deadline = null
   where id = p_appointment_id
     and status = 'pending_approval'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'NOT_PENDING' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- Lifecycle beyond approval: check-in, start, complete, no-show, cancel.
-- One function with a guarded transition table beats five near-identical ones,
-- and makes the legal moves readable in a single place.
create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.appointments;
  v_current public.appointment_status;
  v_allowed public.appointment_status[];
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select status into v_current from public.appointments where id = p_appointment_id;
  if v_current is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  v_allowed := case v_current
    when 'confirmed'  then array['checked_in','in_service','completed','cancelled','no_show']::public.appointment_status[]
    when 'checked_in' then array['in_service','completed','cancelled','no_show']::public.appointment_status[]
    when 'in_service' then array['completed','cancelled']::public.appointment_status[]
    else array[]::public.appointment_status[]
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001',
      detail = format('%s -> %s', v_current, p_status);
  end if;

  update public.appointments
     set status = p_status,
         checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end,
         completed_at  = case when p_status = 'completed'  then now() else completed_at  end,
         cancelled_at  = case when p_status = 'cancelled'  then now() else cancelled_at  end,
         cancellation_reason = case
           when p_status = 'cancelled' then coalesce(nullif(trim(p_reason), ''), 'Cancelled by the salon')
           else cancellation_reason
         end
   where id = p_appointment_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.approve_appointment(uuid) from public, anon;
revoke all on function public.reject_appointment(uuid, text) from public, anon;
revoke all on function public.set_appointment_status(uuid, public.appointment_status, text) from public, anon;
grant execute on function public.approve_appointment(uuid) to authenticated;
grant execute on function public.reject_appointment(uuid, text) to authenticated;
grant execute on function public.set_appointment_status(uuid, public.appointment_status, text) to authenticated;

-- ---------- 5. Owner-created appointments -----------------------------
-- The owner takes bookings by phone and in person. This bypasses the hybrid
-- trust gate (she is looking at the customer) but NOT the overlap constraint,
-- so a phone booking can still never double-book a web booking.
create or replace function public.create_appointment_as_owner(
  p_service_id uuid,
  p_starts_at  timestamptz,
  p_full_name  text,
  p_email      text,
  p_mobile     text default null,
  p_note       text default null
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

  select * into v_service from public.services where id = p_service_id and archived_at is null;
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

revoke all on function public.create_appointment_as_owner(uuid, timestamptz, text, text, text, text)
  from public, anon;
grant execute on function public.create_appointment_as_owner(uuid, timestamptz, text, text, text, text)
  to authenticated;
