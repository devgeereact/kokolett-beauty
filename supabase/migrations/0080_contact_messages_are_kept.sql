-- =====================================================================
-- 0080_contact_messages_are_kept.sql
--
-- An enquiry sent through the Contact page was never stored anywhere.
--
-- `submit_contact_message()` (0047, rate-limited by 0049) queues ONE email to
-- the owner and returns. There is no `contact_messages` table, so the only
-- copy of what somebody wrote is a row in the outbox addressed to the salon,
-- and:
--
--   * **A fresh install destroys every message silently.** The whole queue
--     step is wrapped in `if v_owner is not null`, and `v_owner` comes from
--     `staff join profiles`. No migration creates a staff row, so before the
--     owner is bootstrapped the function does nothing at all and still
--     returns success. `ContactPage` renders its "thank you" state on that
--     success. Nobody, at either end, learns the message went nowhere.
--
--   * **A bounced or failed send loses the enquiry outright.** There is no
--     second copy and no owner-facing list. If the outbox row fails five times
--     and lands in `failed`, the enquiry is gone.
--
--   * **Clearing the outbox erases the record AND resets the rate limit.** The
--     Email page hard-deletes `email_messages` rows, and both of 0049's caps
--     count from that same table, so an ordinary tidy-up silently disarms the
--     abuse control and destroys the enquiry history in one action.
--
-- So: a real table. The enquiry is written FIRST and the email is queued
-- second, which means a missing owner or a dead relay no longer costs the
-- salon the message. `0049`'s note that a separate table would be "a second
-- source of truth to drift" was right about the rate-limit COUNTER and is the
-- reason the counts now move here too: this table is the record, and the
-- outbox goes back to being only a delivery log.
--
-- Personal data, so it joins the two paths that already exist for that:
-- `erase_customer_as_owner()` reaches it by address, and
-- `purge_expired_personal_data()` drops it at two years, matching the
-- retention `0046` set for enquiries and outbox rows.
-- =====================================================================

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       citext not null,
  message     text not null,
  -- `new` until the owner opens it, `archived` when she is finished with it.
  -- Deliberately not a separate `read_at` boolean plus a status: one column,
  -- one question, the same shape `availability_requests.status` uses.
  status      text not null default 'new'
                check (status in ('new', 'read', 'archived')),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

comment on table public.contact_messages is
  'Enquiries from the public Contact page. The authoritative record: the outbox '
  'row that notifies the owner is a delivery log, not the message. Written by '
  'submit_contact_message() before the email is queued, so a missing owner or a '
  'failed send never costs the salon the enquiry.';

-- Both of the queries this table serves: the owner reading her list newest
-- first, and the per-address rate limit.
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);
create index if not exists contact_messages_email_recent_idx
  on public.contact_messages (lower(email::text), created_at desc);

drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;

-- Owner only. There is no anon policy on purpose: the public path is
-- submit_contact_message(), which is SECURITY DEFINER and validates and rate
-- limits before it writes. An insert policy would be a second, unguarded door
-- into the same table.
--
-- `(select public.is_owner())` rather than a bare call, per 0078: is_owner()
-- is `stable security definer` and Postgres never inlines it, so a bare
-- reference is a function call per row scanned.
drop policy if exists contact_messages_owner_all on public.contact_messages;
create policy contact_messages_owner_all on public.contact_messages
  for all
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------
-- The public write path now records the enquiry before it notifies anyone.
-- ---------------------------------------------------------------------
create or replace function public.submit_contact_message(
  p_full_name text,
  p_email     text,
  p_message   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text := trim(p_full_name);
  v_email     text := trim(p_email);
  v_message   text := trim(p_message);
  v_owner     text;
  v_recent    integer;
begin
  if v_full_name = '' or length(v_full_name) > 200 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 320 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if v_message = '' or length(v_message) > 4000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  -- Both caps now count from `contact_messages` rather than from the outbox.
  -- Same numbers and same reasoning as 0049; what changes is that the counter
  -- can no longer be reset by the owner clearing the Email page, and it keeps
  -- counting for an installation whose owner row does not exist yet.
  select count(*) into v_recent
    from public.contact_messages m
   where lower(m.email::text) = lower(v_email)
     and m.created_at > now() - interval '24 hours';

  if v_recent >= 3 then
    raise exception 'TOO_MANY_MESSAGES' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
    from public.contact_messages m
   where m.created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'TOO_MANY_MESSAGES' using errcode = 'P0001';
  end if;

  -- The record, written before anything can fail.
  insert into public.contact_messages (full_name, email, message)
  values (v_full_name, v_email::citext, v_message);

  -- The notification, which is now allowed to fail without losing anything.
  select p.email into v_owner
    from public.staff s join public.profiles p on p.id = s.id
   order by s.created_at limit 1;

  if v_owner is not null then
    perform public.queue_email(
      'contact_message_received',
      v_owner,
      'Message from ' || v_full_name,
      null, null, null,
      jsonb_build_object('full_name', v_full_name, 'email', v_email, 'notes', v_message)
    );
  end if;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Erasure reaches it. 0073 added the outbox payload; this is the record the
-- payload was a copy of.
-- ---------------------------------------------------------------------
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

  -- Contact-page enquiries, matched on the sender's own address.
  delete from public.contact_messages where lower(email::text) = lower(v_email::text);

  -- The third clause is the contact form's outbox copy. A
  -- `contact_message_received` row is addressed to the OWNER and carries the
  -- enquirer in its payload, so neither of the first two clauses matches one.
  delete from public.email_messages
   where customer_id = p_customer_id
      or lower(to_email) = lower(v_email::text)
      or lower(payload ->> 'email') = lower(v_email::text);

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

    -- No email or other identifying detail logged: only that an erasure
    -- happened. The audit log must never become a second place a
    -- "deleted" customer's address still lives.
    perform public.log_audit_event(
      'customer.erased', 'customer', p_customer_id,
      'Customer erased. Anonymised rather than deleted, because a payment is logged against them.');

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

-- ---------------------------------------------------------------------
-- And retention drops it, on the same two-year clock as everything else that
-- holds someone's words.
-- ---------------------------------------------------------------------
create or replace function public.purge_expired_personal_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emails   integer;
  v_requests integer;
  v_events   integer;
  v_contacts integer;
begin
  with deleted as (
    delete from public.email_messages
     where status in ('sent', 'failed', 'bounced', 'cancelled')
       and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_emails from deleted;

  with deleted as (
    delete from public.availability_requests
     where status <> 'new'
       and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_requests from deleted;

  with deleted as (
    delete from public.product_events
     where created_at < now() - interval '1 year'
    returning 1
  )
  select count(*) into v_events from deleted;

  -- Only messages the owner has finished with, matching the rule for
  -- availability requests: one still sitting unread is not stale, it is
  -- overdue.
  with deleted as (
    delete from public.contact_messages
     where status = 'archived'
       and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_contacts from deleted;

  return jsonb_build_object(
    'email_messages_deleted', v_emails,
    'availability_requests_deleted', v_requests,
    'product_events_deleted', v_events,
    'contact_messages_deleted', v_contacts
  );
end;
$$;

revoke all on function public.purge_expired_personal_data() from public, anon, authenticated;
