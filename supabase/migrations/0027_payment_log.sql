-- =====================================================================
-- 0027_payment_log.sql
--
-- What a customer actually paid, logged by the owner after the fact.
-- Fixed pricing is gone from what the owner sees: appointments.price_pence
-- and services.price_pence stay in the schema (booking history references
-- them) but nothing below reads them any more. `payments` is the real
-- figure, entered in the chair.
--
-- Append-only by design: no update/delete RPC. A mis-logged amount is
-- corrected by logging another row, the same way this schema already
-- prefers preserving financial history over mutating it (see customers.
-- deleted_at's soft-delete-for-GDPR-while-keeping-financial-history).
-- One appointment can carry more than one payment row (deposit then
-- balance, say) even though the v1 UI only ever adds one at a time.
-- =====================================================================

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  amount_pence   int not null check (amount_pence > 0),
  note           text,
  recorded_by    uuid not null references public.staff(id),
  created_at     timestamptz not null default now()
);

create index if not exists payments_appointment_id_idx on public.payments (appointment_id);

comment on table public.payments is
  'What the owner actually logged as paid, per appointment. Append-only — a correction is a new row, never an update.';

alter table public.payments enable row level security;

-- Owner-only, same tier as email_messages / ai_recommendations / staff —
-- no anon or customer access, ever.
drop policy if exists payments_owner_all on public.payments;
create policy payments_owner_all on public.payments
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- log_payment -------------------------------------------------

create or replace function public.log_payment(
  p_appointment_id uuid,
  p_amount_pence   int,
  p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.payments (appointment_id, amount_pence, note, recorded_by)
  values (p_appointment_id, p_amount_pence, p_note, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_payment(uuid, int, text) from public, anon;
grant execute on function public.log_payment(uuid, int, text) to authenticated;

-- ---------- owner_dashboard_summary: today_revenue_pence → today_collected_pence

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
    'today_collected_pence', (
      select coalesce(sum(p.amount_pence), 0)
      from public.payments p
      join public.appointments a on a.id = p.appointment_id
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('confirmed','checked_in','in_service','completed')
    ),
    'pending_approval_count', (
      select count(*) from public.appointments a where a.status = 'pending_approval'
    ),
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

-- ---------- appointments_detailed: gains paid_pence ----------------------

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
  (
    select count(*) from public.appointments prior
    where prior.customer_id = a.customer_id
      and prior.status = 'completed'
      and prior.id <> a.id
  ) as customer_completed_count,
  (
    select coalesce(sum(p.amount_pence), 0) from public.payments p
    where p.appointment_id = a.id
  ) as paid_pence
from public.appointments a
join public.customers c on c.id = a.customer_id
join public.services  s on s.id = a.service_id;

comment on view public.appointments_detailed is
  'Owner-facing appointment rows joined to customer and service. security_invoker, so RLS on the base tables governs access. paid_pence sums public.payments — the owner-logged real figure, not the price_pence placeholder.';
