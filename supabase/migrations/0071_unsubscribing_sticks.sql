-- An unsubscribe cannot be undone by anyone who knows the address.
--
-- `subscribe_to_updates()` (0018) is granted to `anon`, which is correct for a
-- public sign-up form, and its upsert ended with:
--
--     on conflict (email) do update set unsubscribed_at = null, ...
--
-- so calling it with an address that had already unsubscribed cleared the
-- unsubscribe and put that person back on the list. `confirmed` defaults to
-- true and is never touched by the upsert, so a previously confirmed
-- subscriber went straight back into the broadcast audience
-- (`0058`: `where confirmed and unsubscribed_at is null`) and received the
-- next newsletter.
--
-- The caller does not have to be the person. The anon key ships inside the
-- browser bundle, so anybody who knows an address can re-subscribe its owner,
-- and the RFC 8058 one-click unsubscribe added in 0058 is exactly the header
-- that makes the address worth harvesting. Marketing to a person who opted out
-- is a PECR problem, not a bug report.
--
-- Three changes, all inside the existing function:
--
--   1. Never clear `unsubscribed_at`. A row that has opted out stays opted
--      out, and the function still returns void either way so an anonymous
--      caller cannot use the result to learn whether an address is on the list
--      (the property `subscriberService.ts` documents and 0018 designed for).
--      The way back in is the owner's own Mailing list card, which now lists
--      unsubscribed people and can add one back deliberately. That is the
--      right place for a re-consent decision: a person, looking at a name.
--
--   2. Length ceilings. `p_email` was pattern-checked but unbounded, and
--      `p_full_name` and `p_source` were not checked at all, so the one public
--      write into this table accepted arbitrarily large text.
--
--   3. A global rate limit, matching `submit_contact_message()` in 0049 and
--      for the same reason: without one, the sign-up form is a way for anyone
--      to write rows into the salon's database in a loop. Twenty an hour is
--      far above anything a single-owner salon sees and costs a real visitor
--      nothing. There is deliberately no per-address cap here: the upsert
--      makes repeat calls for one address idempotent already, so the only
--      unit of abuse is volume across addresses.

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
  v_email     text := lower(trim(p_email));
  v_full_name text := nullif(trim(p_full_name), '');
  v_source    text := coalesce(nullif(trim(p_source), ''), 'website');
  v_recent    integer;
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

  select count(*) into v_recent
    from public.subscribers s
   where s.created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    raise exception 'TOO_MANY_SIGNUPS' using errcode = 'P0001';
  end if;

  -- `unsubscribed_at` is absent from the update list on purpose. See the note
  -- at the top of this file: putting it back is what made an unsubscribe
  -- reversible by a stranger. `full_name` is still filled in when it was
  -- previously blank, because that is new information about somebody who is
  -- already on the list rather than a change of their consent.
  insert into public.subscribers (email, full_name, source)
  values (v_email::citext, v_full_name, v_source)
  on conflict (email) do update
    set full_name = coalesce(public.subscribers.full_name, excluded.full_name);
end;
$$;

revoke all on function public.subscribe_to_updates(text, text, text) from public;
grant execute on function public.subscribe_to_updates(text, text, text)
  to anon, authenticated;

-- The hourly count above runs on every public sign-up, so it must not be a
-- sequential scan over the whole list as it grows.
create index if not exists subscribers_created_at_idx
  on public.subscribers (created_at desc);
