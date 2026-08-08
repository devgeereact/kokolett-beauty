-- =====================================================================
-- 0017_marketing_and_reviews.sql — the public face of the salon
--
-- Two things the marketing page needs and did not have: somewhere to keep the
-- salon's own links, and somewhere to keep Google reviews.
--
-- Reviews are **cached**, not fetched from the browser. Two reasons, and both
-- matter:
--
--   1. The Google Places key would be visible in the bundle. A referrer
--      restriction helps, but the honest position is that a key shipped to the
--      browser is a public key, and this one is billable.
--   2. Every visitor would cost a Places call. A salon's reviews change a few
--      times a month; refetching per page view is paying Google for the same
--      five paragraphs thousands of times.
--
-- So an Edge Function pulls them on a schedule into these tables and the site
-- reads the cache. Google's terms permit temporary caching for performance;
-- the refresh is hourly and the fetch timestamp is kept so staleness is
-- visible rather than assumed.
-- =====================================================================

-- ---------- The salon's own links ---------------------------------------
alter table public.booking_settings
  add column if not exists instagram_url text,
  add column if not exists google_place_id text,
  add column if not exists address_line text,
  add column if not exists phone text;

comment on column public.booking_settings.google_place_id is
  'Google Place ID (ChIJ…). Needed by sync-reviews; the share.google link in google_review_url is not the same thing and cannot be used for the API.';

-- ---------- Cached reviews ----------------------------------------------
create table if not exists public.google_reviews (
  id                text primary key,
  author_name       text not null,
  author_url        text,
  profile_photo_url text,
  rating            smallint not null check (rating between 1 and 5),
  body              text,
  relative_time     text,
  published_at      timestamptz,
  fetched_at        timestamptz not null default timezone('utc', now())
);

create index if not exists google_reviews_published_idx
  on public.google_reviews (published_at desc nulls last);

/** The headline rating, which Places returns separately from the review list. */
create table if not exists public.google_place_snapshot (
  id           boolean primary key default true check (id),
  rating       numeric(2,1),
  rating_count integer,
  fetched_at   timestamptz not null default timezone('utc', now()),
  last_error   text
);

insert into public.google_place_snapshot (id) values (true) on conflict (id) do nothing;

alter table public.google_reviews        enable row level security;
alter table public.google_place_snapshot enable row level security;

-- Reviews are public by definition — they are already published on Google.
drop policy if exists google_reviews_public_read on public.google_reviews;
create policy google_reviews_public_read on public.google_reviews
  for select using (true);

drop policy if exists google_place_public_read on public.google_place_snapshot;
create policy google_place_public_read on public.google_place_snapshot
  for select using (true);

drop policy if exists google_reviews_owner_all on public.google_reviews;
create policy google_reviews_owner_all on public.google_reviews
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists google_place_owner_all on public.google_place_snapshot;
create policy google_place_owner_all on public.google_place_snapshot
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- What the marketing page reads -------------------------------
/**
 * Everything the public site needs about reviews, in one call.
 *
 * Returns the rating, the count, and the most recent reviews that actually say
 * something — a bare five stars with no words is fine for the average but adds
 * nothing to a page trying to persuade someone.
 */
create or replace function public.public_reviews(p_limit integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_snapshot public.google_place_snapshot%rowtype;
  v_reviews  jsonb;
begin
  select * into v_snapshot from public.google_place_snapshot where id;

  select coalesce(jsonb_agg(r order by r.published_at desc nulls last), '[]'::jsonb)
    into v_reviews
    from (
      select author_name, profile_photo_url, rating, body, relative_time,
             published_at, author_url
        from public.google_reviews
       where body is not null and length(trim(body)) > 0
       order by published_at desc nulls last
       limit greatest(1, least(coalesce(p_limit, 6), 20))
    ) r;

  return jsonb_build_object(
    'rating', v_snapshot.rating,
    'rating_count', v_snapshot.rating_count,
    'fetched_at', v_snapshot.fetched_at,
    'reviews', v_reviews
  );
end;
$$;

revoke all on function public.public_reviews(integer) from public;
grant execute on function public.public_reviews(integer) to anon, authenticated;

-- ---------- Refreshing the cache ----------------------------------------
create or replace function public.sync_google_reviews()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url text;
  v_id  bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return null;
  end if;

  -- Same pattern as the email drain: the endpoint lives in the vault so no
  -- secret or project URL is baked into a migration in a public repository.
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'sync_reviews_url' limit 1;

  if v_url is null then
    raise notice 'No sync_reviews_url in the vault; not fetching reviews.';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_id;

  return v_id;
end;
$$;

revoke all on function public.sync_google_reviews() from public, anon;
grant execute on function public.sync_google_reviews() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sync-google-reviews';
    -- Hourly, at :41. Reviews for a small salon change a few times a month;
    -- anything more frequent is paying Google to tell us nothing has changed.
    perform cron.schedule('sync-google-reviews', '41 * * * *',
      $cron$select public.sync_google_reviews()$cron$);
  end if;
exception when others then
  raise notice 'Could not schedule sync-google-reviews (%).', sqlerrm;
end $$;
