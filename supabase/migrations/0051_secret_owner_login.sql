-- The owner's sign-in page moves from a guessable, publicly-linked `/login`
-- to a secret, owner-chosen, changeable slug — see docs/ARCHITECTURE.md and
-- `owner-secret-login` Edge Function.
--
-- The slug lives on `staff`, not `booking_settings`: the latter is
-- world-readable via the anon key (`booking_settings_public_read`, 0002) and
-- is fetched on every marketing page, which would leak the secret to every
-- visitor. `staff` has no public/anon select policy at all, so this is safe
-- by construction.
--
-- Resolution and rate-limiting happen entirely inside `owner-secret-login`
-- (an Edge Function, not a client-callable RPC): the functions below are
-- revoked from anon/authenticated and reachable only via the service-role
-- key, so the real slug is never fetched into a browser to compare locally
-- — the one thing that would defeat this feature.

alter table public.staff
  add column if not exists login_slug text unique,
  add column if not exists login_slug_updated_at timestamptz not null default timezone('utc', now());

update public.staff set login_slug = 'christy' where login_slug is null;

-- ---------- Guessing lockout -------------------------------------------
-- Keyed by hashed IP, not by the attempted slug: a dictionary attack never
-- repeats the same wrong path twice, so a per-path counter would never
-- reach the threshold. IP is hashed (SHA-256, computed in the Edge
-- Function) before it ever reaches this table.
create table if not exists public.secret_login_attempts (
  id           bigint generated always as identity primary key,
  ip_hash      text not null,
  attempted_at timestamptz not null default timezone('utc', now())
);

create index if not exists secret_login_attempts_ip_recent_idx
  on public.secret_login_attempts (ip_hash, attempted_at desc);

alter table public.secret_login_attempts enable row level security;
-- No policies: default-deny for anon/authenticated. Only the service-role
-- client inside `owner-secret-login` ever touches this table.

-- ---------- Resolution (service-role only) ------------------------------
create or replace function public.resolve_owner_slug(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff where lower(login_slug) = lower(p_slug)
  );
$$;

revoke all on function public.resolve_owner_slug(text) from public, anon, authenticated;

create or replace function public.check_login_lockout(p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 5
    from public.secret_login_attempts
   where ip_hash = p_ip_hash
     and attempted_at > now() - interval '15 minutes';
$$;

revoke all on function public.check_login_lockout(text) from public, anon, authenticated;

-- Records a failed attempt and, once failures across every IP cross a
-- generous hourly threshold, queues the owner a heads-up email through the
-- existing outbox. A per-IP attacker never reaches this; only a
-- distributed one does, which the per-IP lockout alone cannot catch.
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

  -- Fires once per crossing rather than on every request past the
  -- threshold — a rolling window means this can still fire more than once
  -- an hour under sustained attack, which is the point.
  if v_global_recent = 50 then
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

-- ---------- Owner-facing management (authenticated, is_owner()) --------
create or replace function public.get_own_login_slug()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  return (select login_slug from public.staff where id = auth.uid());
end;
$$;

revoke all on function public.get_own_login_slug() from public, anon;
grant execute on function public.get_own_login_slug() to authenticated;

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

  if length(v_slug) < 4 or length(v_slug) > 40 then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  if v_slug !~ '^[a-z0-9-]+$' then
    raise exception 'SLUG_INVALID' using errcode = 'P0001';
  end if;

  -- Keep in sync with RESERVED_SLUGS in src/lib/routes.ts — no shared
  -- source of truth across the TS/SQL boundary, so this needs manual care
  -- whenever a new top-level route is added.
  if v_slug = any (array[
    'about','gallery','services','testimonials','faqs','contact','book',
    'request-availability','subscribe','privacy','booking-policy','terms',
    'my','access','dashboard','login','reset-password',
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

-- ---------- Housekeeping -------------------------------------------------
create or replace function public.purge_login_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.secret_login_attempts where attempted_at < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_login_attempts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'purge-secret-login-attempts';

    perform cron.schedule(
      'purge-secret-login-attempts',
      '17 3 * * *',
      $cron$select public.purge_login_attempts()$cron$
    );
  end if;
exception when others then
  raise notice 'Could not schedule purge-secret-login-attempts (%).', sqlerrm;
end $$;
