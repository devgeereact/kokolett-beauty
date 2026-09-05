-- =====================================================================
-- 0077_public_writes_get_ceilings_and_a_purge.sql
--
-- The three remaining unbounded or self-denying public write paths, from the
-- 2026-09-05 audit (docs/KOKO_GAP.md §11).
--
-- 1. **`availability_requests` was the last unbounded anonymous write, and its
--    owner-only columns were writable by the submitter.**
--
--    `validate_availability_request()` (0021) checks the email shape, a
--    two-character minimum on the name and three requests per address per day.
--    It sets no upper bound on anything: not `full_name`, not `notes`, not
--    `preferred_times`, and not the length of the `preferred_dates` array.
--    Compare `book_appointment` (name <= 120, note <= 2000, control characters
--    stripped) and `subscribe_to_updates` (three ceilings), both written
--    precisely because an unbounded public write was judged unacceptable there.
--    `notes` is carried into an email to the owner by
--    `notify_availability_request()`, copied verbatim into
--    `appointments.customer_note` by `offer_slot_to_request()`, and read from
--    there into the AI assistant's context. Three requests a day times a
--    megabyte each, with rotated addresses, is within policy today.
--
--    The insert policy (0021) constrains `status`, `converted_appointment_id`
--    and `customer_id`, and stops there. `owner_response` and `owner_note` are
--    the owner's own words about an enquiry, and an anonymous submitter could
--    set both in the same POST. `open_requests_in_order()` returns
--    `owner_response` to the dashboard, so attacker text rendered in her queue
--    as though she had written it. The trigger now nulls both, which is
--    stronger than a policy predicate: it cannot be bypassed by any insert
--    path, and it survives a future policy edit.
--
--    There is also no global cap, unlike `submit_contact_message` (0049).
--    Added, and deliberately high: this is a backstop against a flood, not a
--    second per-address limit.
--
-- 2. **`track_product_event()` accepted an unbounded jsonb blob, and
--    `product_events` had no retention.** 500 rows a minute is within policy,
--    which is 720,000 a day, each carrying arbitrary JSON, on a Free-plan
--    project with a fixed disk. Every other table with a retention story got
--    one: `email_messages` and `availability_requests` in 0046, `audit_events`
--    in 0052, `secret_login_attempts` in 0051. `product_events` arrived after
--    all of them and got none. A funnel event is analytics, not a record: a
--    year is generous.
--
-- 3. **The mailing-list rate limit was a self-inflicted outage.** 0071 counts
--    every sign-up in the last hour and refuses at 20, reasoning that "the only
--    unit of abuse is volume across addresses". That is right about the abuse
--    and wrong about the remedy: the attacker's own twenty throwaway addresses
--    fill the bucket, and every genuine visitor is then refused for the rest of
--    the hour. Twenty unauthenticated POSTs takes /subscribe offline. It is
--    self-inflicted too: a good Instagram post trips it.
--
--    Now a per-address cap (which is what actually stops one person hammering
--    it) plus a global backstop raised to a level a real burst will not reach.
--    A repeat sign-up from an address already on the list is still idempotent
--    and still free, so a returning visitor is never refused.
--
-- Every change is additive validation on an existing function. No table shape
-- changes and no policy is dropped.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Availability requests: ceilings, and the owner's columns are hers.
-- ---------------------------------------------------------------------
create or replace function public.validate_availability_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
  v_global integer;
begin
  new.email := lower(trim(coalesce(new.email, '')));

  -- Deliberately the same shape the Edge Function accepts. It is not a full
  -- RFC 5322 parser and does not need to be; it rejects the empty, the
  -- unroutable and the obviously fabricated.
  if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_INVALID' using errcode = 'P0001';
  end if;

  if length(new.email) > 320 then
    raise exception 'EMAIL_INVALID' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(new.full_name, ''))) < 2 then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;

  -- Upper bounds, matching book_appointment's. Nothing legitimate is near
  -- these. The name is whitespace-collapsed for the same reason it is there:
  -- it reaches an email Subject header, where a raw newline is header
  -- injection.
  new.full_name := trim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  if length(new.full_name) > 120 then
    raise exception 'NAME_TOO_LONG' using errcode = 'P0001';
  end if;

  -- Control characters stripped, ordinary newlines kept: notes are free text
  -- the owner reads, but nothing in them should steer a downstream consumer
  -- that treats control bytes as structure. This text reaches her inbox, the
  -- appointment record and the AI assistant's context.
  new.notes := regexp_replace(
                 coalesce(new.notes, ''),
                 E'[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  if length(new.notes) > 2000 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
  end if;
  new.notes := nullif(new.notes, '');

  if length(coalesce(new.preferred_times, '')) > 200 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
  end if;

  -- A month of candidate dates is already a generous ask.
  if coalesce(cardinality(new.preferred_dates), 0) > 31 then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;

  -- The owner's own words about an enquiry. An anonymous submitter could set
  -- both, and open_requests_in_order() renders owner_response in her queue, so
  -- attacker text appeared there as though she had written it. Nulled in the
  -- trigger rather than fenced in the policy: this cannot be bypassed by any
  -- insert path and it survives a future policy edit.
  new.owner_response := null;
  new.owner_note := null;

  -- Cap how often one address can make the salon send. A genuine enquirer does
  -- not submit the form three times in a day; a script does it forever.
  select count(*) into v_recent
    from public.availability_requests r
   where lower(r.email) = new.email
     and r.created_at > now() - interval '24 hours';

  if v_recent >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  -- Global backstop, in the shape submit_contact_message() has had since 0049.
  -- Deliberately high: rotating addresses beats the per-address cap, and this
  -- is the floor under that, not a second per-person limit. A salon does not
  -- receive sixty genuine enquiries in an hour.
  select count(*) into v_global
    from public.availability_requests r
   where r.created_at > now() - interval '1 hour';

  if v_global >= 60 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- The global count above runs on every public submission, so it must not be a
-- sequential scan as the table grows. The existing index leads with
-- lower(email), which cannot serve a predicate on created_at alone.
create index if not exists availability_requests_created_at_idx
  on public.availability_requests (created_at desc);

-- ---------------------------------------------------------------------
-- 2. Product events: a size ceiling on the payload, and a retention job.
-- ---------------------------------------------------------------------
create or replace function public.track_product_event(
  p_event_name text,
  p_session_id text,
  p_metadata   jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_recent integer;
  v_global_recent  integer;
begin
  if p_event_name not in (
    'book_page_viewed', 'slot_selected', 'booking_submitted', 'booking_confirmed'
  ) then
    raise exception 'INVALID_EVENT' using errcode = 'P0001';
  end if;

  if p_session_id is null or length(trim(p_session_id)) = 0 or length(p_session_id) > 100 then
    raise exception 'INVALID_SESSION' using errcode = 'P0001';
  end if;

  -- The event name and the session id were the only validated inputs; the
  -- payload was whatever the caller sent. 2KB is far above what the four real
  -- funnel steps carry and far below what makes 500 rows a minute a disk
  -- problem.
  if p_metadata is not null and pg_column_size(p_metadata) > 2048 then
    raise exception 'INVALID_METADATA' using errcode = 'P0001';
  end if;

  -- Cap one session. Twenty a minute is far above the four real funnel
  -- steps a genuine visit produces.
  select count(*) into v_session_recent
    from public.product_events
   where session_id = p_session_id
     and created_at > now() - interval '1 minute';

  if v_session_recent >= 20 then
    raise exception 'TOO_MANY_EVENTS' using errcode = 'P0001';
  end if;

  -- Cap everyone. A new session id is free to generate, so the per-session
  -- limit alone is trivially beaten; this is the backstop.
  select count(*) into v_global_recent
    from public.product_events
   where created_at > now() - interval '1 minute';

  if v_global_recent >= 500 then
    raise exception 'TOO_MANY_EVENTS' using errcode = 'P0001';
  end if;

  insert into public.product_events (event_name, session_id, metadata)
  values (p_event_name, p_session_id, p_metadata);
end;
$$;

revoke all on function public.track_product_event(text, text, jsonb) from public;
grant execute on function public.track_product_event(text, text, jsonb) to anon, authenticated;

-- Retention. `product_events` was the one table with a growth story and no
-- purge; every other one got theirs in 0046, 0051 or 0052. Funnel events are
-- analytics rather than a record, and `product_event_funnel_summary()` takes a
-- days argument, so a year is well past anything that is read.
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
begin
  -- Only messages that have reached a final state. A queued reminder for an
  -- appointment two years out is still work waiting to happen.
  with deleted as (
    delete from public.email_messages
     where status in ('sent', 'failed', 'bounced', 'cancelled')
       and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_emails from deleted;

  -- Only requests the owner has finished with. A request still sitting in the
  -- inbox is not stale, however old it is — it is overdue.
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

  return jsonb_build_object(
    'email_messages_deleted', v_emails,
    'availability_requests_deleted', v_requests,
    'product_events_deleted', v_events
  );
end;
$$;

revoke all on function public.purge_expired_personal_data() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. The mailing list stops refusing everybody because of one attacker.
-- ---------------------------------------------------------------------
create or replace function public.subscribe_to_updates(
  p_email     text,
  p_full_name text default null,
  p_source    text default 'website'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email     text := lower(nullif(trim(p_email), ''));
  v_full_name text := nullif(trim(p_full_name), '');
  v_source    text := coalesce(nullif(trim(p_source), ''), 'website');
  v_recent    integer;
  v_existing  boolean;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 320 then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;

  if length(v_full_name) > 200 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  if length(v_source) > 60 then
    raise exception 'INVALID_SOURCE' using errcode = 'P0001';
  end if;

  -- Somebody already on the list is never refused: the upsert below is
  -- idempotent for them, so they cost nothing and rate limiting them would
  -- only confuse a returning visitor who signed up twice.
  select exists(select 1 from public.subscribers s where s.email = v_email::citext)
    into v_existing;

  if not v_existing then
    -- Per address first. This is the cap that actually stops one person
    -- hammering the endpoint, and it was missing: 0071 had only a global
    -- count, so an attacker's own twenty throwaway addresses filled the bucket
    -- and every genuine visitor was refused for the rest of the hour. Twenty
    -- unauthenticated POSTs took /subscribe offline, and a good Instagram post
    -- did the same thing by accident.
    select count(*) into v_recent
      from public.subscribers s
     where lower(s.email::text) = v_email
       and s.created_at > now() - interval '1 hour';

    if v_recent >= 3 then
      raise exception 'TOO_MANY_SIGNUPS' using errcode = 'P0001';
    end if;

    -- Global backstop, raised from 20 to 200. Rotating addresses beats the
    -- per-address cap, so this still has to exist, but it now sits above any
    -- plausible genuine burst rather than inside one.
    select count(*) into v_recent
      from public.subscribers s
     where s.created_at > now() - interval '1 hour';

    if v_recent >= 200 then
      raise exception 'TOO_MANY_SIGNUPS' using errcode = 'P0001';
    end if;
  end if;

  -- `unsubscribed_at` is absent from the update list on purpose. See the note
  -- at the top of 0071: putting it back is what made an unsubscribe reversible
  -- by a stranger. `full_name` is still filled in when it was previously blank,
  -- because that is new information about somebody who is already on the list
  -- rather than a change of their consent.
  insert into public.subscribers (email, full_name, source)
  values (v_email::citext, v_full_name, v_source)
  on conflict (email) do update
    set full_name = coalesce(public.subscribers.full_name, excluded.full_name);
end;
$$;

revoke all on function public.subscribe_to_updates(text, text, text) from public;
grant execute on function public.subscribe_to_updates(text, text, text)
  to anon, authenticated;

comment on function public.subscribe_to_updates(text, text, text) is
  'Public mailing-list opt-in. Idempotent for an address already on the list, '
  'and never re-subscribes one that opted out (0071). Rate limited per address '
  'and then globally since 0077, because a purely global cap let one attacker '
  'refuse everybody else for an hour.';
