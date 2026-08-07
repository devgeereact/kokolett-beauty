-- =====================================================================
-- 0005_email_and_customer_access.sql
--
-- Two halves of the same problem: telling customers what happened, and
-- letting them act on it without an account.
--
--   1. An outbox. Triggers enqueue `email_messages` rows; an Edge Function
--      drains them over SMTP. Enqueueing in the same transaction as the
--      booking means an email can never be silently skipped because a network
--      call failed mid-write.
--   2. Passwordless customer sessions. Customers are not `auth.users`, so
--      they get single-use magic links resolved server-side.
--
-- The raw token is never stored. Only its SHA-256 hash reaches the database —
-- which is why the link is minted inside an Edge Function rather than here:
-- a SQL function that had to hand the raw token to the mailer would have to
-- persist it somewhere first.
-- =====================================================================

-- ---------- Template variables ----------------------------------------
-- The Edge Function renders bodies from a template name plus this payload,
-- so copy changes never need a migration.
alter table public.email_messages
  add column if not exists payload jsonb not null default '{}'::jsonb;

-- ---------- Outbox helper ---------------------------------------------
create or replace function public.queue_email(
  p_template       text,
  p_to_email       text,
  p_subject        text,
  p_appointment_id uuid default null,
  p_customer_id    uuid default null,
  p_scheduled_for  timestamptz default null,
  p_payload        jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.email_messages
    (template, to_email, subject, appointment_id, customer_id, status,
     scheduled_for, payload)
  values
    (p_template, p_to_email, p_subject, p_appointment_id, p_customer_id, 'queued',
     coalesce(p_scheduled_for, now()), p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.queue_email(text, text, text, uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;

-- ---------- Who gets told about a new booking -------------------------
create or replace function public.notify_appointment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_service  public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_owner    text;
  v_payload  jsonb;
begin
  select * into v_customer from public.customers where id = new.customer_id;
  select * into v_service  from public.services  where id = new.service_id;
  select * into v_settings from public.booking_settings where id;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'service_name', v_service.name,
    'starts_at', new.starts_at,
    'ends_at', new.ends_at,
    'price_pence', new.price_pence,
    'timezone', v_settings.timezone,
    'approval_window_h', v_settings.approval_window_h,
    'cancellation_window_h', v_settings.cancellation_window_h
  );

  if new.status = 'pending_approval' then
    perform public.queue_email(
      'booking_held', v_customer.email::text,
      'We have your booking request — ' || new.reference,
      new.id, v_customer.id, null, v_payload);
  else
    perform public.queue_email(
      'booking_confirmed', v_customer.email::text,
      'Your appointment is confirmed — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    -- Reminders ride on the confirmation, not on a nightly sweep: the row
    -- exists the moment the booking does, so a scheduler outage delays a
    -- reminder rather than losing it.
    perform public.queue_email(
      'reminder_24h', v_customer.email::text,
      'Your appointment tomorrow — ' || new.reference,
      new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);

    perform public.queue_email(
      'reminder_2h', v_customer.email::text,
      'See you shortly — ' || new.reference,
      new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
  end if;

  -- The owner hears about every booking, and is told when one needs her.
  select p.email into v_owner
    from public.staff s join public.profiles p on p.id = s.id
   order by s.created_at limit 1;

  if v_owner is not null then
    perform public.queue_email(
      case when new.status = 'pending_approval'
           then 'owner_approval_needed' else 'owner_new_booking' end,
      v_owner,
      case when new.status = 'pending_approval'
           then 'Approval needed: ' || v_customer.full_name
           else 'New booking: ' || v_customer.full_name end,
      new.id, v_customer.id, null,
      v_payload || jsonb_build_object(
        'customer_email', v_customer.email::text,
        'customer_mobile', v_customer.mobile,
        'customer_note', new.customer_note));
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_notify_created on public.appointments;
create trigger appointments_notify_created
  after insert on public.appointments
  for each row execute function public.notify_appointment_created();

-- ---------- Status changes --------------------------------------------
create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_service  public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_payload  jsonb;
begin
  if new.status = old.status then
    return new;
  end if;

  select * into v_customer from public.customers where id = new.customer_id;
  select * into v_service  from public.services  where id = new.service_id;
  select * into v_settings from public.booking_settings where id;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'service_name', v_service.name,
    'starts_at', new.starts_at,
    'price_pence', new.price_pence,
    'timezone', v_settings.timezone,
    'reason', coalesce(new.rejection_reason, new.cancellation_reason),
    'google_review_url', v_settings.google_review_url
  );

  if new.status = 'confirmed' and old.status = 'pending_approval' then
    perform public.queue_email(
      'booking_approved', v_customer.email::text,
      'Your appointment is confirmed — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    -- The reminders were never queued for a held booking; queue them now,
    -- but only if the appointment is still far enough out to be worth it.
    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email('reminder_24h', v_customer.email::text,
        'Your appointment tomorrow — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email('reminder_2h', v_customer.email::text,
        'See you shortly — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
    end if;

  elsif new.status = 'rejected' then
    perform public.queue_email(
      'booking_declined', v_customer.email::text,
      'About your booking request — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'cancelled' then
    perform public.queue_email(
      'booking_cancelled', v_customer.email::text,
      'Your appointment is cancelled — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'completed' then
    -- Asking for a review while the customer is still in the chair is worse
    -- than not asking. Two hours later they are home and pleased.
    if v_settings.google_review_url is not null then
      perform public.queue_email(
        'review_request', v_customer.email::text,
        'How did we do?',
        new.id, v_customer.id, now() + interval '2 hours', v_payload);
    end if;
  end if;

  -- A booking that is no longer happening must not still be reminded about.
  if new.status in ('cancelled', 'rejected', 'no_show') then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment ' || new.status || ' before send'
     where appointment_id = new.id
       and status = 'queued'
       and template in ('reminder_24h', 'reminder_2h', 'review_request');
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_notify_status on public.appointments;
create trigger appointments_notify_status
  after update of status on public.appointments
  for each row execute function public.notify_appointment_status_changed();

-- ---------- Availability requests --------------------------------------
create or replace function public.notify_availability_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner text;
begin
  perform public.queue_email(
    'request_received', new.email,
    'We have your enquiry',
    null, new.customer_id, null,
    jsonb_build_object('full_name', new.full_name, 'notes', new.notes));

  select p.email into v_owner
    from public.staff s join public.profiles p on p.id = s.id
   order by s.created_at limit 1;

  if v_owner is not null then
    perform public.queue_email(
      'owner_new_request', v_owner,
      'New enquiry from ' || new.full_name,
      null, new.customer_id, null,
      jsonb_build_object(
        'full_name', new.full_name, 'email', new.email, 'mobile', new.mobile,
        'preferred_dates', new.preferred_dates, 'flexibility', new.flexibility,
        'notes', new.notes));
  end if;

  return new;
end;
$$;

drop trigger if exists availability_requests_notify on public.availability_requests;
create trigger availability_requests_notify
  after insert on public.availability_requests
  for each row execute function public.notify_availability_request();

-- ---------- Customer sessions ------------------------------------------
-- A magic link is redeemed once and exchanged for a longer-lived session
-- token. Both are stored only as SHA-256 hashes.
create or replace function public.redeem_access_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash    text := encode(digest(p_token, 'sha256'), 'hex');
  v_row     public.customer_access_tokens%rowtype;
  v_customer public.customers%rowtype;
  v_session text;
begin
  select * into v_row
    from public.customer_access_tokens
   where token_hash = v_hash
     and used_at is null
     and expires_at > now();

  if v_row.id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;

  update public.customer_access_tokens set used_at = now() where id = v_row.id;

  select * into v_customer from public.customers
   where id = v_row.customer_id and deleted_at is null;

  if v_customer.id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;

  -- 30-day session, per docs/PRD.md. Long enough to be useful between
  -- appointments, short enough that a forwarded link stops working.
  v_session := encode(gen_random_bytes(32), 'hex');
  insert into public.customer_access_tokens (customer_id, token_hash, purpose, expires_at)
  values (v_customer.id, encode(digest(v_session, 'sha256'), 'hex'), 'manage',
          now() + interval '30 days');

  return jsonb_build_object(
    'session_token', v_session,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'full_name', v_customer.full_name,
      'email', v_customer.email::text,
      'mobile', v_customer.mobile));
end;
$$;

/** Resolve a session token to a customer, or raise. */
create or replace function public.customer_from_session(p_session_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select t.customer_id into v_id
    from public.customer_access_tokens t
    join public.customers c on c.id = t.customer_id and c.deleted_at is null
   where t.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
     and t.purpose = 'manage'
     and t.expires_at > now();

  if v_id is null then
    raise exception 'INVALID_SESSION' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

create or replace function public.customer_appointments(p_session_token text)
returns table (
  id uuid, reference text, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, price_pence integer, service_name text,
  customer_note text, cancellation_reason text, rejection_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_customer uuid := public.customer_from_session(p_session_token);
begin
  return query
    select a.id, a.reference, a.starts_at, a.ends_at, a.status, a.price_pence,
           s.name, a.customer_note, a.cancellation_reason, a.rejection_reason
      from public.appointments a
      join public.services s on s.id = a.service_id
     where a.customer_id = v_customer
     order by a.starts_at desc;
end;
$$;

create or replace function public.customer_cancel_appointment(
  p_session_token text,
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := public.customer_from_session(p_session_token);
  v_row      public.appointments%rowtype;
  v_settings public.booking_settings%rowtype;
begin
  select * into v_settings from public.booking_settings where id;

  select * into v_row from public.appointments
   where id = p_appointment_id and customer_id = v_customer;

  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_row.status not in ('pending_approval', 'confirmed') then
    raise exception 'NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  -- Late cancellations are allowed but flagged: refusing them online just
  -- turns into a no-show, which costs the salon the slot anyway.
  update public.appointments
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled by the customer')
                               || case
                                    when v_row.starts_at < now()
                                         + make_interval(hours => v_settings.cancellation_window_h)
                                    then ' (inside the cancellation window)'
                                    else ''
                                  end
   where id = p_appointment_id;

  return 'cancelled'::public.appointment_status;
end;
$$;

revoke all on function public.redeem_access_token(text) from public;
revoke all on function public.customer_from_session(text) from public, anon, authenticated;
revoke all on function public.customer_appointments(text) from public;
revoke all on function public.customer_cancel_appointment(text, uuid, text) from public;

grant execute on function public.redeem_access_token(text) to anon, authenticated;
grant execute on function public.customer_appointments(text) to anon, authenticated;
grant execute on function public.customer_cancel_appointment(text, uuid, text) to anon, authenticated;

-- ---------- Housekeeping ------------------------------------------------
create or replace function public.purge_expired_access_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with gone as (
    delete from public.customer_access_tokens
     where expires_at < now() - interval '7 days'
    returning id
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-access-tokens';
    perform cron.schedule('purge-access-tokens', '23 4 * * *',
      $cron$select public.purge_expired_access_tokens()$cron$);
  end if;
exception when others then
  raise notice 'Could not schedule purge-access-tokens (%).', sqlerrm;
end $$;
