-- =====================================================================
-- 0021_tokens_are_single_use.sql
--
-- Four security fixes found by auditing the final state after 0020. Each one
-- closes something an unauthenticated caller could actually do today.
--
--   1. A redeemed magic link kept working as a session for its full 30 minutes.
--   2. Anyone could make the salon send email to any address, without limit.
--   3. The reviews sync had no authentication, and every call costs money.
--   4. Three cron-only functions were still executable by PUBLIC.
--
-- The `customer-access` wildcard-injection fix that goes with these lives in
-- the Edge Function, not here.
-- =====================================================================

-- ---------- 1. A magic link works once, as the email promises -----------
--
-- `redeem_access_token` marked the link spent, but `customer_from_session`
-- looked tokens up on `token_hash + purpose + expires_at` and never checked
-- `used_at`. Both classes of token lived in one table under the same
-- `purpose = 'manage'`, so they were interchangeable: the raw link from the
-- email went on working as a *session* token for the rest of its 30-minute TTL
-- after the customer had already used it. Anyone who saw the link inside that
-- window — a forwarded mail, a shared family inbox, a corporate mail scanner,
-- browser history on a borrowed laptop — could read that customer's whole
-- appointment history and cancel or reschedule on their behalf.
--
-- The email says the opposite ("It works once and expires in 30 minutes",
-- _shared/templates.ts), and 0005 said it too: "short enough that a forwarded
-- link stops working". The code did not do it.
--
-- Filtering on `used_at is null` alone would be enough, but it would leave the
-- two token classes structurally identical and one edit away from merging
-- again. Giving sessions their own `purpose` makes them non-interchangeable.

alter table public.customer_access_tokens
  drop constraint if exists customer_access_tokens_purpose_check;

alter table public.customer_access_tokens
  add constraint customer_access_tokens_purpose_check
  check (purpose in ('manage', 'booking_offer', 'session'));

-- Reclassify the sessions that already exist, so nobody is signed out by this
-- migration. A magic link is minted with a 30-minute TTL and a session with a
-- 30-day one, so the gap between `created_at` and `expires_at` tells them apart
-- with no ambiguity anywhere near the boundary.
update public.customer_access_tokens
   set purpose = 'session'
 where purpose = 'manage'
   and used_at is null
   and expires_at - created_at > interval '1 day';

create or replace function public.redeem_access_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash     text := encode(digest(p_token, 'sha256'), 'hex');
  v_row      public.customer_access_tokens%rowtype;
  v_customer public.customers%rowtype;
  v_session  text;
begin
  select * into v_row
    from public.customer_access_tokens
   where token_hash = v_hash
     and purpose = 'manage'
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

  -- 30-day session, per docs/PRD.md. Minted as 'session', so it can never be
  -- redeemed as a magic link and a magic link can never be presented as one.
  v_session := encode(gen_random_bytes(32), 'hex');
  insert into public.customer_access_tokens (customer_id, token_hash, purpose, expires_at)
  values (v_customer.id, encode(digest(v_session, 'sha256'), 'hex'), 'session',
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

create or replace function public.customer_from_session(p_session_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  select t.customer_id into v_id
    from public.customer_access_tokens t
    join public.customers c on c.id = t.customer_id and c.deleted_at is null
   where t.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
     and t.purpose = 'session'
     and t.used_at is null
     and t.expires_at > now();

  if v_id is null then
    raise exception 'INVALID_SESSION' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

revoke all on function public.redeem_access_token(text) from public;
revoke all on function public.customer_from_session(text) from public, anon, authenticated;
grant execute on function public.redeem_access_token(text) to anon, authenticated;


-- ---------- 2. An enquiry cannot be used to mail a stranger --------------
--
-- `availability_requests` is anon-insertable, which is right for a public
-- enquiry form, and `notify_availability_request()` then queues an email to
-- `new.email` — a value that is entirely attacker-supplied and was never
-- checked. So `POST /rest/v1/availability_requests` with any recipient made the
-- salon's own SMTP identity send attacker-written text to anyone, repeatedly,
-- and put an alert in the owner's inbox each time. For a business whose entire
-- confirmation flow depends on email arriving, burning sending reputation is
-- the expensive part; the owner's flooded inbox is merely the obvious part.
--
-- Validation belongs here rather than in the form, for the same reason the name
-- and mobile checks moved into `book_appointment` in 0013: a validation that
-- lives in the browser is a suggestion.

create or replace function public.validate_availability_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_recent integer;
begin
  new.email := lower(trim(coalesce(new.email, '')));

  -- Deliberately the same shape the Edge Function accepts. It is not a full
  -- RFC 5322 parser and does not need to be; it rejects the empty, the
  -- unroutable and the obviously fabricated.
  if new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_INVALID' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(new.full_name, ''))) < 2 then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;

  -- Cap how often one address can make the salon send. A genuine enquirer does
  -- not submit the form three times in a day; a script does it forever.
  select count(*) into v_recent
    from public.availability_requests r
   where lower(r.email) = new.email
     and r.created_at > now() - interval '24 hours';

  if v_recent >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists availability_requests_validate on public.availability_requests;
create trigger availability_requests_validate
  before insert on public.availability_requests
  for each row execute function public.validate_availability_request();

-- Makes the rate-limit count an index scan rather than a sequential one.
create index if not exists availability_requests_email_recent_idx
  on public.availability_requests (lower(email), created_at desc);

-- The insert policy let an anon caller set `customer_id` to any UUID it could
-- guess, which would attach a stranger's enquiry to a real customer record.
-- Nothing legitimate sets it — the owner links the request when converting it.
drop policy if exists availability_requests_public_insert on public.availability_requests;
create policy availability_requests_public_insert on public.availability_requests
  for insert with check (
    status = 'new'
    and converted_appointment_id is null
    and customer_id is null
  );


-- ---------- 3. The reviews sync proves it is the scheduler --------------
--
-- `sync-reviews` is deployed `--no-verify-jwt` and its handler took no request
-- argument at all, so there was nothing to authenticate against: anyone who
-- found the URL could POST to it in a loop and spend the owner's Google Places
-- budget, one billable call per request. The function now demands
-- `x-cron-secret`, so this caller has to send it — same vault pattern as
-- `drain_email_queue()` in 0014.
--
-- Set the secret in both places before deploying:
--   supabase secrets set REVIEWS_CRON_SECRET=<value>
--   select vault.create_secret('<value>', 'reviews_cron_secret');

create or replace function public.sync_google_reviews()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url    text;
  v_secret text;
  v_id     bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return null;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'sync_reviews_url' limit 1;

  if v_url is null then
    raise notice 'No sync_reviews_url in the vault; not fetching reviews.';
    return null;
  end if;

  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'reviews_cron_secret' limit 1;
  exception when others then
    raise notice 'Vault unreadable (%).', sqlerrm;
    return null;
  end;

  if v_secret is null then
    raise notice 'No reviews_cron_secret in the vault; not fetching reviews.';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_id;

  return v_id;
end;
$$;

revoke all on function public.sync_google_reviews() from public, anon;
grant execute on function public.sync_google_reviews() to authenticated;


-- ---------- 4. Cron-only functions are not callable over the API --------
--
-- Postgres grants EXECUTE to PUBLIC by default. Every other function in this
-- tree pairs a `revoke all ... from public` with an explicit grant; these three
-- were the omissions, which left SECURITY DEFINER writes reachable at
-- /rest/v1/rpc/... by anyone. All three are driven by pg_cron and have no
-- client caller anywhere in `src/`, so nothing needs the grant back — cron runs
-- as a superuser and is unaffected by these revokes.
--
-- (This may already be closed on the live project: `supabase/config.toml`
-- documents the newer cloud default where entities are not auto-exposed to
-- anon/authenticated without an explicit GRANT. Being explicit costs nothing
-- and does not depend on which default the project was created under.)

revoke all on function public.expire_pending_approvals()      from public, anon, authenticated;
revoke all on function public.purge_expired_access_tokens()   from public, anon, authenticated;
revoke all on function public.extend_weekly_template()        from public, anon, authenticated;
