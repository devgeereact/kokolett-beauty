-- =====================================================================
-- 0072_a_booking_does_not_rewrite_a_customer.sql
--
-- `book_appointment()` is granted to `anon` (0039). Its upsert branch treated
-- whoever booked last as the authority on an existing customer's record:
--
--   full_name         = excluded.full_name,
--   mobile            = coalesce(excluded.mobile, public.customers.mobile),
--   marketing_consent = public.customers.marketing_consent or excluded.marketing_consent,
--
-- Three separate problems, all reachable by anyone who knows a customer's
-- email address, five times per address per day:
--
--   1. **Consent could be turned back on.** `or excluded.marketing_consent`
--      raises the flag and never lowers it, so a customer who opted out on
--      /my (`customer_set_marketing_consent`, 0060) is silently re-consented
--      by a stranger ticking the box on a booking form. `consent_updated_at`
--      is not touched on the update branch either, so the record then shows
--      consent with a timestamp from whenever it was first given. This is the
--      same defect class as the unsubscribe resurrection `0071` fixed for
--      `subscribers`, left unfixed for `customers`. Under UK GDPR consent has
--      to be an act of the data subject; it cannot be restored by a third
--      party, and it cannot be restored silently.
--
--   2. **Name could be overwritten.** The salon's diary is the only place the
--      owner has a customer's name, and a booking made against someone else's
--      address rewrote it. The confirmation email then goes to the victim.
--
--   3. **The rate limit could not use its index.** The 24-hour cap joins on
--      `lower(c.email::text)`, but the only matching index is partial
--      (`where deleted_at is null`, 0002:115). Without that predicate the
--      planner cannot use it and every anonymous booking attempt sequentially
--      scans `customers`. Adding the predicate is also more correct: an erased
--      customer's tombstone should not spend a live caller's allowance.
--
-- What the conflict branch does now: fills a field only when the stored value
-- is absent, never replaces one, and never raises consent. A customer whose
-- name really has changed is corrected by the owner from the Customers page,
-- which is an authenticated, audited path.
--
-- Everything else is 0039's function unchanged.
-- =====================================================================

create or replace function public.book_appointment(
  p_starts_at  timestamptz,
  p_full_name  text,
  p_email      text,
  p_mobile     text default null,
  p_note       text default null,
  p_consent    boolean default false
)
returns table (appointment_id uuid, reference text, status public.appointment_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.booking_settings%rowtype;
  v_service    public.services%rowtype;
  v_local_date date;
  v_local_time time;
  -- Whitespace collapsed, which also removes CR and LF: the name is
  -- concatenated into an email Subject header downstream, and a raw newline
  -- there is header injection.
  v_name       text := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_email      text := lower(trim(coalesce(p_email, '')));
  -- Control characters stripped, ordinary newlines kept: a note is free text
  -- the owner reads, but nothing in it should be able to steer a downstream
  -- consumer that treats control bytes as structure.
  v_note       text := regexp_replace(
                         coalesce(p_note, ''),
                         E'[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g');
  v_mobile     text := trim(coalesce(p_mobile, ''));
  v_customer   uuid;
  v_ref        text;
  v_id         uuid;
  v_returning  boolean;
  v_status     public.appointment_status;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- A first name alone is not enough to tell two customers apart in a diary.
  if array_length(string_to_array(v_name, ' '), 1) is null
     or array_length(string_to_array(v_name, ' '), 1) < 2
     or length(v_name) < 3 then
    raise exception 'NAME_INCOMPLETE' using errcode = 'P0001';
  end if;

  -- Enough digits to be a real number, ignoring spaces, brackets and +.
  if length(regexp_replace(v_mobile, '\D', '', 'g')) < 7 then
    raise exception 'MOBILE_REQUIRED' using errcode = 'P0001';
  end if;

  -- The address the confirmation and the manage link both go to. This was
  -- never checked here at all: `customers.email` is citext with no CHECK, so a
  -- booking could create a customer row with an unroutable address, which then
  -- became an outbox row that failed five times and stopped. Same expression
  -- validate_availability_request() has used since 0021.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_INVALID' using errcode = 'P0001';
  end if;

  -- Upper bounds. Nothing legitimate is near these; without them a single
  -- request could put a megabyte of text into a name and carry it into every
  -- email, the dashboard and the AI assistant's context.
  if length(v_name) > 120 then
    raise exception 'NAME_TOO_LONG' using errcode = 'P0001';
  end if;
  if length(v_note) > 2000 then
    raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
  end if;

  -- Cap how often one address can book. `availability_requests` has had this
  -- since 0021 and the reasoning is identical, only the stakes are higher: a
  -- script could otherwise fill the published diary up to
  -- max_appointments_per_day and generate two emails per booking on the way.
  -- Counted on completed inserts, so a customer who genuinely rebooks after a
  -- cancellation is unaffected.
  --
  -- `c.deleted_at is null` added 0072: it is what lets the planner use
  -- customers_email_key, which is a partial index carrying that same
  -- predicate, and it stops an erased customer's tombstone counting against a
  -- live caller.
  if (
    select count(*) from public.appointments a
      join public.customers c on c.id = a.customer_id
     where lower(c.email::text) = lower(v_email)
       and c.deleted_at is null
       and a.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'TOO_MANY_BOOKINGS' using errcode = 'P0001';
  end if;

  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_starts_at at time zone v_settings.timezone)::time;

  -- Against the salon's clock, exactly as the publish side checks it.
  if (extract(hour from v_local_time) * 60 + extract(minute from v_local_time))::integer
       % v_settings.slot_granularity_min <> 0
     or extract(second from v_local_time) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.availability_slots sl
     where sl.on_date = v_local_date and sl.starts_at = v_local_time
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  -- Serialise the capacity check against other bookings on the same local day.
  -- Transaction-scoped, so it is released on commit or rollback either way.
  -- Single-argument (bigint) form; the two-argument form takes int4s.
  perform pg_advisory_xact_lock(hashtext('book_day:' || v_local_date::text)::bigint);

  if (
    select count(*) from public.appointments a
    where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
      and (a.starts_at at time zone v_settings.timezone)::date = v_local_date
  ) >= v_settings.max_appointments_per_day then
    raise exception 'DAILY_CAPACITY_REACHED' using errcode = 'P0001';
  end if;

  insert into public.customers (email, full_name, mobile, marketing_consent, consent_updated_at, last_seen_at)
  values (v_email, v_name, v_mobile, p_consent,
          case when p_consent then now() end, now())
  on conflict (lower(email::text)) where deleted_at is null
  do update set
    -- Fill, never replace. An anonymous caller may complete a record that has
    -- a gap in it; it may not correct one that does not.
    full_name         = coalesce(nullif(public.customers.full_name, ''), excluded.full_name),
    mobile            = coalesce(nullif(public.customers.mobile, ''), excluded.mobile),
    -- Consent is never raised here. Only the initial insert above, or the
    -- customer's own `customer_set_marketing_consent()` (0060), may set it
    -- true; the owner can still lower it from the Customers page. A stranger
    -- ticking a box on a booking form is not the data subject.
    marketing_consent = public.customers.marketing_consent,
    last_seen_at      = now()
  returning id into v_customer;

  select exists (
    select 1 from public.appointments a
    where a.customer_id = v_customer and a.status = 'completed'
  ) into v_returning;

  if v_returning or not v_settings.approve_first_time then
    v_status := 'confirmed';
    v_deadline := null;
  else
    v_status := 'pending_approval';
    v_deadline := least(now() + make_interval(hours => v_settings.approval_window_h), p_starts_at);
  end if;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approval_deadline, approved_at)
    values
      (v_ref, v_customer, v_service.id, p_starts_at,
       p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_service.price_pence, nullif(v_note, ''), 'web', v_status, not v_returning, v_deadline,
       case when v_status = 'confirmed' then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref, v_status;
end;
$$;

revoke all on function public.book_appointment(timestamptz, text, text, text, text, boolean) from public;
grant execute on function public.book_appointment(timestamptz, text, text, text, text, boolean)
  to anon, authenticated;

comment on function public.book_appointment(timestamptz, text, text, text, text, boolean) is
  'The sole public booking write path. Validates and bounds its input (0039), '
  'serialises the daily-capacity check with an advisory lock, and relies on the '
  'appointments_no_overlap exclusion constraint for the slot race. Since 0072 it '
  'fills gaps in an existing customer record but never overwrites a stored value, '
  'and never raises marketing consent.';
