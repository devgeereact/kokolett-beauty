-- =====================================================================
-- 0019_calendar_feed_and_owner_booking.sql
--
-- Two things the owner asked for.
--
--   1. A calendar she can subscribe to. Her bookings should appear in the
--      calendar she already looks at, beside the dentist and the school run,
--      without opening this dashboard.
--
--   2. Manual bookings that can run to a length she chooses. Taking a booking
--      by hand already worked and already sent the customer their confirmation;
--      what it could not do was set aside five hours for a full head when the
--      appointment type says four.
--
-- ---------------------------------------------------------------------
-- On the calendar URL being a password
--
-- Calendar applications cannot send an Authorization header. Apple Calendar,
-- Google Calendar and Outlook all fetch a subscription URL anonymously, so the
-- only credential a feed can carry is the URL itself. That makes the URL a
-- bearer token: anyone holding it sees customer names, emails and phone
-- numbers, for as long as it exists.
--
-- Three consequences, all handled here:
--   * The token is 256 bits of randomness, so it cannot be guessed.
--   * Only its SHA-256 hash is stored. A leak of this table does not leak a
--     working feed URL.
--   * It is shown exactly once, at creation, and can be revoked. Revoking is
--     the fix for a URL that ended up somewhere it should not be, and the
--     owner needs that to be one click rather than a support request.
-- =====================================================================

create table if not exists public.calendar_feeds (
  id              uuid primary key default gen_random_uuid(),
  /** SHA-256 of the token, hex. The token itself is never stored. */
  token_hash      text not null unique,
  /** Which device or calendar this was made for, so revoking is informed. */
  label           text not null default 'My calendar',
  created_at      timestamptz not null default timezone('utc', now()),
  last_fetched_at timestamptz,
  fetch_count     integer not null default 0,
  revoked_at      timestamptz
);

alter table public.calendar_feeds enable row level security;

-- No anon policy at all. The Edge Function reads this with the service role
-- after checking the token; nothing else has any business here.
drop policy if exists calendar_feeds_owner_all on public.calendar_feeds;
create policy calendar_feeds_owner_all on public.calendar_feeds
  for all using (public.is_owner()) with check (public.is_owner());

/**
 * Mint a feed token.
 *
 * Returns the plaintext exactly once. There is no way to read it back, which
 * is the point: if the owner loses it she makes a new one and revokes the old,
 * and a copy of this table is worth nothing to anybody.
 */
create or replace function public.create_calendar_feed(p_label text default null)
returns table (id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_id    uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.calendar_feeds (token_hash, label)
  values (encode(digest(v_token, 'sha256'), 'hex'),
          coalesce(nullif(trim(p_label), ''), 'My calendar'))
  returning calendar_feeds.id into v_id;

  return query select v_id, v_token;
end;
$$;

revoke all on function public.create_calendar_feed(text) from public, anon;
grant execute on function public.create_calendar_feed(text) to authenticated;

create or replace function public.revoke_calendar_feed(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  update public.calendar_feeds
     set revoked_at = now()
   where id = p_id and revoked_at is null;
end;
$$;

revoke all on function public.revoke_calendar_feed(uuid) from public, anon;
grant execute on function public.revoke_calendar_feed(uuid) to authenticated;

/**
 * What the feed serves.
 *
 * Validates the token, records the fetch so the owner can see the subscription
 * is alive, and returns the appointments worth putting in a calendar.
 *
 * Cancelled bookings are included, not filtered out. A calendar that has
 * already been told about an appointment keeps showing it until it is told
 * otherwise; returning it with a cancelled status is the only way to make it
 * disappear from the owner's phone. They are only carried for sixty days,
 * after which no subscriber can still be holding a stale copy.
 *
 * Not granted to anon or authenticated. The Edge Function calls it with the
 * service role after the token arrives in the URL, so PostgREST cannot be used
 * to grind through guesses with the public key.
 */
create or replace function public.calendar_feed_events(p_token text)
returns table (
  id uuid,
  reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.appointment_status,
  created_at timestamptz,
  updated_at timestamptz,
  customer_name text,
  customer_email text,
  customer_mobile text,
  customer_note text,
  owner_note text,
  first_visit boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_feed public.calendar_feeds;
begin
  select * into v_feed
    from public.calendar_feeds
   where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and revoked_at is null;

  if v_feed.id is null then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  update public.calendar_feeds
     set last_fetched_at = now(),
         fetch_count = fetch_count + 1
   where calendar_feeds.id = v_feed.id;

  return query
    select a.id,
           a.reference,
           a.starts_at,
           a.ends_at,
           a.status,
           a.created_at,
           a.updated_at,
           c.full_name,
           c.email::text,
           c.mobile,
           a.customer_note,
           a.owner_note,
           (select count(*) = 0
              from public.appointments prior
             where prior.customer_id = a.customer_id
               and prior.status = 'completed'
               and prior.starts_at < a.starts_at)
      from public.appointments a
      join public.customers c on c.id = a.customer_id
     where a.starts_at >= now() - interval '60 days'
       and a.starts_at <= now() + interval '365 days'
       and (a.status <> 'cancelled' or a.cancelled_at >= now() - interval '60 days')
       and a.status not in ('rejected', 'rescheduled')
     order by a.starts_at;
end;
$$;

revoke all on function public.calendar_feed_events(text) from public, anon, authenticated;

-- ---------- Manual bookings, at a length the owner picks -----------------
/**
 * Take a booking by hand.
 *
 * Unchanged in every way that matters: it skips the first-visit trust gate
 * (she is looking at the customer, or holding the phone), it never skips the
 * overlap constraint, and it lands as `confirmed`, so the insert trigger sends
 * the customer their confirmation straight away.
 *
 * What is new is `p_duration_min`. The appointment type carries one length,
 * which is the right default for the website. In the salon a retouch and a
 * full head of knotless braids are not the same afternoon, and blocking the
 * wrong amount of time is how the next customer ends up waiting.
 */
drop function if exists public.create_appointment_as_owner(timestamptz, text, text, text, text);

create function public.create_appointment_as_owner(
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

  return query select v_id, v_ref;
end;
$$;

revoke all on function
  public.create_appointment_as_owner(timestamptz, text, text, text, text, integer)
  from public, anon;
grant execute on function
  public.create_appointment_as_owner(timestamptz, text, text, text, text, integer)
  to authenticated;
