-- =====================================================================
-- 0076_the_sign_in_gate_holds_its_own_rules.sql
--
-- Three defects in the secret sign-in gate (0051), all found by reading it
-- against what it claims to do.
--
-- 1. **The reserved-slug list had drifted.** `set_owner_login_slug()` carries
--    its own copy of `RESERVED_SLUGS` from `src/lib/routes.ts`, and says so:
--    "no shared source of truth across the TS/SQL boundary, so this needs
--    manual care whenever a new top-level route is added." Four routes were
--    added and the SQL copy was not updated. `cookies`, `accessibility`,
--    `complaints` and `unsubscribe` are all real public paths and all
--    settable as the owner's sign-in slug today, which would shadow the real
--    page for every visitor: `SecretGate` is the catch-all, so the sign-in
--    form would render at a URL the footer links to.
--
-- 2. **A four-character slug was allowed.** The whole feature is obscurity,
--    and four characters of [a-z0-9-] is 1.7 million candidates. That was
--    survivable only because of the per-IP lockout, and the lockout was
--    keyed on the first `X-Forwarded-For` entry, which the caller controls
--    (fixed the same day in `_shared/auth.ts`). Eight characters is still
--    something a person can type on a phone and is 2.8 trillion candidates.
--    Existing slugs are untouched; this only governs the next change.
--
-- 3. **The distributed-attack alert could silently never fire.** The
--    threshold test was `if v_global_recent = 50`. Two concurrent inserts can
--    take the count from 49 to 51, and under the sustained concurrency that
--    characterises the attack it is meant to report, exact equality is the
--    one condition likely to be skipped. A band (>= 50 and < 60) keeps the
--    "fires once per crossing rather than on every request" behaviour its
--    comment describes, without depending on hitting a single integer.
--
-- Plus the index that count needs. `secret_login_attempts_ip_recent_idx` leads
-- with `ip_hash`, so a predicate on `attempted_at` alone cannot use it: every
-- failed attempt scanned up to a day of rows, and rows are purged only daily.
-- The cost of an attack to the attacker is constant; to the database it was
-- quadratic in attempt volume.
--
-- NOT changed here, deliberately: the seeded slug value. `0051:21` sets it to
-- 'christy', which is the owner's first name as published on the About page
-- and is in a public repository, so the live value needs checking. Rotating it
-- from a migration would be worse than leaving it: `get_own_login_slug()`
-- requires a session, a session requires the sign-in form, and the sign-in
-- form is only reachable at the slug. Changing it out from under a signed-out
-- owner locks her out of her own dashboard. It is an owner action, from
-- Settings, Security, while signed in.
-- =====================================================================

create index if not exists secret_login_attempts_recent_idx
  on public.secret_login_attempts (attempted_at desc);

comment on index public.secret_login_attempts_recent_idx is
  'Serves the hourly global count in record_secret_login_attempt(). The ip_hash '
  'index cannot: its leading column is not in that predicate.';

create or replace function public.record_secret_login_attempt(p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global_recent integer;
  v_owner_email   text;
begin
  insert into public.secret_login_attempts (ip_hash) values (p_ip_hash);

  select count(*) into v_global_recent
    from public.secret_login_attempts
   where attempted_at > now() - interval '1 hour';

  -- A band, not an equality. Fires once per crossing rather than on every
  -- request past the threshold, which is what the original comment intended,
  -- but without depending on the count landing on exactly 50: concurrent
  -- inserts step over a single integer, and concurrency is what an attack
  -- looks like. A rolling window means this can still fire more than once an
  -- hour under sustained attack, which is the point.
  if v_global_recent >= 50 and v_global_recent < 60 then
    select p.email into v_owner_email
      from public.staff s join public.profiles p on p.id = s.id
     order by s.created_at limit 1;

    if v_owner_email is not null then
      perform public.queue_email(
        'secret_login_under_attack',
        v_owner_email,
        'Unusual activity on your sign-in link',
        null, null, null,
        jsonb_build_object('recent_attempts', v_global_recent)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.record_secret_login_attempt(text) from public, anon, authenticated;

create or replace function public.set_owner_login_slug(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(p_slug));
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  -- Eight, not four. See this migration's header.
  if length(v_slug) < 8 or length(v_slug) > 40 then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  if v_slug !~ '^[a-z0-9-]+$' then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  -- Keep in sync with RESERVED_SLUGS in src/lib/routes.ts. There is still no
  -- shared source of truth across the TS/SQL boundary, and this list had
  -- already drifted by four entries once, so check both when a top-level
  -- route is added. `cookies`, `accessibility`, `complaints` and
  -- `unsubscribe` are the four that were missing.
  if v_slug = any (array[
    'about','gallery','services','testimonials','faqs','contact','book',
    'request-availability','subscribe','privacy','cookies','booking-policy',
    'terms','accessibility','complaints',
    'my','access','dashboard','login','reset-password','unsubscribe',
    'admin','owner','staff','signin','signup','logout','api','app'
  ]) then
    raise exception 'SLUG_RESERVED' using errcode = 'P0001';
  end if;

  update public.staff
     set login_slug = v_slug,
         login_slug_updated_at = timezone('utc', now())
   where id = auth.uid();
end;
$$;

revoke all on function public.set_owner_login_slug(text) from public, anon;
grant execute on function public.set_owner_login_slug(text) to authenticated;
