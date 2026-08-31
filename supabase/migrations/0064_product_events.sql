-- =====================================================================
-- 0064_product_events.sql
--
-- KOKO_GAP.md P3: "no PostHog/Plausible/Mixpanel/gtag anywhere... no
-- booking funnel, no conversion tracking." Deliberately first-party, not
-- a third-party vendor -- that would mean provisioning a new external
-- service and API key for a single-owner product, a real new-account
-- decision, not a same-night gap-fill. This holds no personal data at
-- all: an event name from a fixed vocabulary, a random per-tab session
-- id generated client-side (sessionStorage, not a cookie, never linked
-- to anything else), and nothing more.
--
-- Rate-limited two ways, same "cap one, cap everyone" shape
-- submit_contact_message() (0049) already uses: a per-session cap that
-- stops one runaway tab, and a global cap that stops a flood from many
-- sessions at once. Both count existing rows rather than a second
-- tracking table, so there is nothing extra to purge and no second
-- source of truth to drift.
-- =====================================================================

create table if not exists public.product_events (
  id         uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'book_page_viewed',
    'slot_selected',
    'booking_submitted',
    'booking_confirmed'
  )),
  session_id text not null check (length(session_id) between 1 and 100),
  metadata   jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists product_events_name_created_at_idx
  on public.product_events (event_name, created_at desc);
create index if not exists product_events_session_created_at_idx
  on public.product_events (session_id, created_at desc);

alter table public.product_events enable row level security;

drop policy if exists product_events_owner_select on public.product_events;
create policy product_events_owner_select on public.product_events
  for select using (public.is_owner());

-- No insert/update/delete policy for any role -- written only by
-- track_product_event() below.

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

-- ---------- Owner-facing summary ---------------------------------------

create or replace function public.product_event_funnel_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'days', p_days,
    'book_page_viewed', count(*) filter (where event_name = 'book_page_viewed'),
    'slot_selected', count(*) filter (where event_name = 'slot_selected'),
    'booking_submitted', count(*) filter (where event_name = 'booking_submitted'),
    'booking_confirmed', count(*) filter (where event_name = 'booking_confirmed')
  ) into v_result
  from public.product_events
  where created_at > now() - make_interval(days => p_days);

  return v_result;
end;
$$;

revoke all on function public.product_event_funnel_summary(integer) from public, anon;
grant execute on function public.product_event_funnel_summary(integer) to authenticated;
