-- =====================================================================
-- 0052_audit_trail.sql
--
-- An audit trail MVP: docs/KOKO_GAP.md flagged that nothing records "who
-- changed what, when" anywhere in this app. Scoped to the highest-risk
-- actions only — the appointment lifecycle, customer erasure, payment
-- logging, and the owner's secret sign-in slug — not every mutation in
-- the app. The ~15 direct client-side `.update()` call sites with no
-- single server-side hook point (owner notes, customer detail edits,
-- settings/template edits, service-menu edits) are a documented follow-up,
-- not silently dropped; see docs/KOKO_GAP.md.
--
-- `audit_events` is immutable for everyone, including the owner: a
-- SELECT-only RLS policy, no insert/update/delete policy for any role.
-- Writes only happen inside `log_audit_event()`, security definer,
-- revoked from every client role — the same shape as `queue_email()`
-- (0005). A correction is a new row, never a mutation, same as `payments`.
--
-- `erase_customer_as_owner` deliberately logs no email or other
-- identifying detail — only that an erasure happened — so the audit log
-- itself never becomes a second place a "deleted" customer's address
-- still lives.
-- =====================================================================

create table public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor       text not null check (actor in ('owner', 'system')),
  action      text not null check (action in (
                'appointment.created',
                'appointment.status_changed',
                'appointment.rescheduled',
                'appointment.deleted',
                'customer.erased',
                'payment.recorded',
                'settings.login_slug_changed'
              )),
  entity_type text not null,
  entity_id   uuid,
  summary     text not null,
  old_value   jsonb,
  new_value   jsonb
);

create index audit_events_created_at_idx on public.audit_events (created_at desc);

comment on table public.audit_events is
  'Immutable log of the highest-risk owner actions. No update/delete path for any role, including the owner — a correction is a new row, never a mutation, same append-only shape as payments. Writes only through log_audit_event().';

alter table public.audit_events enable row level security;

create policy audit_events_owner_read on public.audit_events
  for select using (public.is_owner());
-- Deliberately no insert/update/delete policy for any role — writes only
-- through log_audit_event() below, which runs as its own definer and so
-- needs no client-facing write policy at all.

-- ---------- The shared logger --------------------------------------------
-- `actor` is always 'owner' from every call site below (every target RPC
-- already checks is_owner() before reaching its log call) — 'system' is
-- reserved for a future automated actor (e.g. expire_pending_approvals)
-- and unused by this migration.
create or replace function public.log_audit_event(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_summary     text,
  p_old_value   jsonb default null,
  p_new_value   jsonb default null,
  p_actor       text default 'owner'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.audit_events (actor, action, entity_type, entity_id, summary, old_value, new_value)
  values (p_actor, p_action, p_entity_type, p_entity_id, p_summary, p_old_value, p_new_value)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function
  public.log_audit_event(text, text, uuid, text, jsonb, jsonb, text)
  from public, anon, authenticated;

-- ---------- Call sites ----------------------------------------------------
-- Each function below is otherwise byte-identical to its current
-- definition (same signature, same validation, same grants — grants are
-- not reset by `create or replace function`, so none are restated here).
-- Only one `perform log_audit_event(...)` line is added to each.

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

  perform public.log_audit_event(
    'appointment.status_changed', 'appointment', p_appointment_id,
    format('Appointment %s approved', v_row.reference),
    jsonb_build_object('status', 'pending_approval'),
    jsonb_build_object('status', 'confirmed'));

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

  perform public.log_audit_event(
    'appointment.status_changed', 'appointment', p_appointment_id,
    format('Appointment %s rejected: %s', v_row.reference, v_row.rejection_reason),
    jsonb_build_object('status', 'pending_approval'),
    jsonb_build_object('status', 'rejected'));

  return v_row;
end;
$$;

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
    when 'completed'  then array['confirmed']::public.appointment_status[]
    else array[]::public.appointment_status[]
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001',
      detail = format('%s -> %s', v_current, p_status);
  end if;

  update public.appointments
     set status = p_status,
         checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end,
         completed_at  = case
           when p_status = 'completed' then now()
           when p_status = 'confirmed' and v_current = 'completed' then null
           else completed_at
         end,
         cancelled_at  = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancellation_reason = case
           when p_status = 'cancelled' then coalesce(nullif(trim(p_reason), ''), 'Cancelled by the salon')
           else cancellation_reason
         end
   where id = p_appointment_id
  returning * into v_row;

  if v_current = 'completed' and p_status = 'confirmed' then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment un-completed by the owner before this was sent'
     where appointment_id = p_appointment_id
       and status = 'queued'
       and template = 'review_request';
  end if;

  perform public.log_audit_event(
    'appointment.status_changed', 'appointment', p_appointment_id,
    format('Appointment %s: %s -> %s', v_row.reference, v_current, p_status),
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_status));

  return v_row;
end;
$$;

create or replace function public.create_appointment_as_owner(
  p_starts_at    timestamptz,
  p_full_name    text,
  p_email        text,
  p_mobile       text default null,
  p_note         text default null,
  p_duration_min integer default null
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
  v_minutes  integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_service from public.hair_appointment();
  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_minutes := coalesce(p_duration_min, v_service.duration_min);
  if v_minutes < 15 or v_minutes > 720 then
    raise exception 'INVALID_DURATION' using errcode = 'P0001',
      detail = 'An appointment must run between 15 minutes and 12 hours.';
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
       p_starts_at + make_interval(mins => v_minutes + v_service.buffer_min),
       v_service.price_pence, p_note, 'owner', 'confirmed', false, now(), auth.uid())
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  perform public.log_audit_event(
    'appointment.created', 'appointment', v_id,
    format('Appointment %s created by the owner for %s', v_ref, p_full_name),
    null,
    jsonb_build_object('starts_at', p_starts_at, 'status', 'confirmed'));

  return query select v_id, v_ref;
end;
$$;

revoke all on function
  public.create_appointment_as_owner(timestamptz, text, text, text, text, integer)
  from public, anon;
grant execute on function
  public.create_appointment_as_owner(timestamptz, text, text, text, text, integer)
  to authenticated;

create or replace function public.reschedule_appointment_as_owner(
  p_appointment_id uuid,
  p_new_starts_at  timestamptz
)
returns table (appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old        public.appointments%rowtype;
  v_settings   public.booking_settings%rowtype;
  v_local_date date;
  v_local_time time;
  v_ref        text;
  v_id         uuid;
  v_deadline   timestamptz;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  select * into v_old from public.appointments where id = p_appointment_id for update;
  if v_old.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_old.status not in ('pending_approval', 'confirmed') then
    raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001';
  end if;
  if v_old.starts_at < now() then
    raise exception 'ALREADY_PASSED' using errcode = 'P0001';
  end if;
  if p_new_starts_at < now() then
    raise exception 'ALREADY_PASSED' using errcode = 'P0001';
  end if;
  if p_new_starts_at = v_old.starts_at then
    raise exception 'SAME_TIME' using errcode = 'P0001';
  end if;

  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_new_starts_at at time zone v_settings.timezone)::time;

  insert into public.availability_slots (on_date, starts_at)
  values (v_local_date, v_local_time)
  on conflict (on_date, starts_at) do nothing;

  if v_old.status = 'pending_approval' then
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_new_starts_at);
  else
    v_deadline := null;
  end if;

  v_ref := public.generate_booking_reference();

  update public.appointments
     set status = 'rescheduled',
         cancellation_reason = 'Moved by the salon'
   where id = p_appointment_id;

  update public.email_messages
     set status = 'failed', last_error = 'Rescheduled by the salon'
   where email_messages.appointment_id = p_appointment_id
     and status = 'queued'
     and template = 'owner_booking_moved';

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, owner_note, source, status, requires_approval,
       approval_deadline, approved_at, approved_by, rescheduled_from)
    values
      (v_ref, v_old.customer_id, v_old.service_id, p_new_starts_at,
       p_new_starts_at + (v_old.ends_at - v_old.starts_at),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, v_old.approved_by, p_appointment_id)
    returning id into v_id;
  exception when exclusion_violation then
    update public.appointments
       set status = v_old.status, cancellation_reason = v_old.cancellation_reason
     where id = p_appointment_id;
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  update public.email_messages
     set status = 'failed', last_error = 'Rescheduled by the salon'
   where email_messages.appointment_id = v_id
     and status = 'queued'
     and template in ('owner_new_booking', 'owner_approval_needed');

  -- entity_id is the NEW row's id (the one that exists going forward and
  -- is worth clicking through to) — the OLD id/time are preserved in
  -- old_value instead, since the old row itself is now just a retired
  -- 'rescheduled' husk.
  perform public.log_audit_event(
    'appointment.rescheduled', 'appointment', v_id,
    format('Appointment %s rescheduled from %s to %s', v_ref, v_old.starts_at, p_new_starts_at),
    jsonb_build_object('appointment_id', v_old.id, 'starts_at', v_old.starts_at),
    jsonb_build_object('appointment_id', v_id, 'starts_at', p_new_starts_at));

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.reschedule_appointment_as_owner(uuid, timestamptz)
  from public, anon;
grant execute on function public.reschedule_appointment_as_owner(uuid, timestamptz)
  to authenticated;

create or replace function public.delete_appointment_as_owner(
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status      public.appointment_status;
  v_has_payment boolean;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select status into v_status from public.appointments where id = p_appointment_id;
  if v_status is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists(
    select 1 from public.payments where appointment_id = p_appointment_id
  ) into v_has_payment;

  if v_has_payment then
    raise exception 'HAS_PAYMENT' using errcode = 'P0001';
  end if;

  -- Logged before the delete, not after: this is the one call site where
  -- that ordering differs from every other one below, because there is no
  -- "after" moment where the row still exists to describe.
  perform public.log_audit_event(
    'appointment.deleted', 'appointment', p_appointment_id,
    format('Appointment deleted (was %s)', v_status),
    jsonb_build_object('status', v_status),
    null);

  delete from public.appointments where id = p_appointment_id;
end;
$$;

create or replace function public.erase_customer_as_owner(
  p_customer_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       citext;
  v_has_payment boolean;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select email into v_email from public.customers where id = p_customer_id;
  if v_email is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  delete from public.subscribers where lower(email) = lower(v_email::text);

  delete from public.availability_requests
   where customer_id = p_customer_id
      or lower(email) = lower(v_email::text);

  delete from public.email_messages
   where customer_id = p_customer_id
      or lower(to_email) = lower(v_email::text);

  delete from public.customer_access_tokens where customer_id = p_customer_id;

  select exists(
    select 1
    from public.payments pay
    join public.appointments appt on appt.id = pay.appointment_id
    where appt.customer_id = p_customer_id
  ) into v_has_payment;

  if v_has_payment then
    update public.appointments
       set customer_note = null,
           owner_note = null,
           cancellation_reason = null,
           rejection_reason = null
     where customer_id = p_customer_id;

    update public.customers
       set full_name = 'Erased customer',
           email = ('erased+' || p_customer_id::text || '@invalid')::citext,
           mobile = null,
           notes = null,
           marketing_consent = false,
           consent_updated_at = now(),
           deleted_at = now()
     where id = p_customer_id;

    -- No email or other identifying detail logged — only that an erasure
    -- happened. The audit log must never become a second place a
    -- "deleted" customer's address still lives.
    perform public.log_audit_event(
      'customer.erased', 'customer', p_customer_id,
      'Customer erased (anonymised — had a logged payment)');

    return 'anonymised';
  end if;

  delete from public.appointments where customer_id = p_customer_id;
  delete from public.customers where id = p_customer_id;

  perform public.log_audit_event(
    'customer.erased', 'customer', p_customer_id,
    'Customer erased');

  return 'deleted';
end;
$$;

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

  perform public.log_audit_event(
    'payment.recorded', 'payment', v_id,
    format('Payment of %s pence recorded', p_amount_pence),
    null,
    jsonb_build_object('appointment_id', p_appointment_id, 'amount_pence', p_amount_pence));

  return v_id;
end;
$$;

create or replace function public.set_owner_login_slug(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug     text := lower(trim(p_slug));
  v_old_slug text;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if length(v_slug) < 4 or length(v_slug) > 40 then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  if v_slug !~ '^[a-z0-9-]+$' then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  if v_slug = any (array[
    'about','gallery','services','testimonials','faqs','contact','book',
    'request-availability','subscribe','privacy','booking-policy','terms',
    'my','access','dashboard','login','reset-password',
    'admin','owner','staff','signin','signup','logout','api','app'
  ]) then
    raise exception 'SLUG_RESERVED' using errcode = 'P0001';
  end if;

  select login_slug into v_old_slug from public.staff where id = auth.uid();

  update public.staff
     set login_slug = v_slug,
         login_slug_updated_at = timezone('utc', now())
   where id = auth.uid();

  -- The summary text never carries the actual slug value (it's a live
  -- secret sign-in path) — only old_value/new_value do, for a security
  -- incident review, never the human-readable list.
  perform public.log_audit_event(
    'settings.login_slug_changed', 'staff', auth.uid(),
    'Owner sign-in link changed',
    jsonb_build_object('login_slug', v_old_slug),
    jsonb_build_object('login_slug', v_slug));
end;
$$;

-- ---------- Retention ------------------------------------------------------
create or replace function public.purge_expired_audit_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with deleted as (
    delete from public.audit_events
     where created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_count from deleted;

  return jsonb_build_object('audit_events_deleted', v_count);
end;
$$;

revoke all on function public.purge_expired_audit_events() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'purge-audit-events';

    perform cron.schedule(
      'purge-audit-events',
      '43 3 * * 0',
      $cron$select public.purge_expired_audit_events()$cron$
    );
  else
    raise notice 'pg_cron not installed; audit-event retention purge not scheduled.';
  end if;
exception when others then
  raise notice 'Could not schedule purge-audit-events (%).', sqlerrm;
end $$;
