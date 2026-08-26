-- The contact form cannot be used to flood the owner's inbox.
--
-- `0047` added `submit_contact_message()` and granted it to `anon`, which is
-- correct for a public contact form and is also, unguarded, a way for anyone
-- who reads the schema to make the salon's own SMTP identity send mail to the
-- owner as fast as they can loop. This is the same hole 0021 closed on
-- `availability_requests`, and it is worth restating why it matters here: the
-- expensive part is not the flooded inbox, it is the sending reputation of the
-- domain every confirmation, reminder and magic link depends on.
--
-- The RPC is reachable in production right now — 0047 was applied before the
-- Contact page that calls it had shipped — so this is a live gap, not a
-- pre-emptive one.
--
-- Two caps, because one address is not the only unit of abuse:
--
--   * three per address per 24 hours, the same figure and the same reasoning
--     as `validate_availability_request()` in 0021 — a genuine enquirer does
--     not send the form three times in a day, a script does it forever;
--   * ten in total per hour, which a single-owner salon will never reach, and
--     which is the only thing that stops a script that varies the address on
--     every request.
--
-- Deliberately NOT rate-limited by IP. `request.headers` would give us
-- `x-forwarded-for`, but storing it makes the salon a controller of a new
-- category of personal data under UK GDPR, with a retention duty and an
-- erasure duty attached (`docs/SCHEMA.md` §12), in exchange for a signal that
-- a determined abuser rotates anyway. The two caps above need no new data at
-- all: `email_messages` already records every queued message.

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

  -- Cap one address. Counted from the queue itself rather than a new table:
  -- every accepted message is already a row here, so there is nothing extra to
  -- write, nothing extra to purge, and no second source of truth to drift.
  select count(*) into v_recent
    from public.email_messages m
   where m.template = 'contact_message_received'
     and lower(m.payload ->> 'email') = lower(v_email)
     and m.created_at > now() - interval '24 hours';

  if v_recent >= 3 then
    raise exception 'TOO_MANY_MESSAGES' using errcode = 'P0001';
  end if;

  -- Cap everyone. The per-address limit is trivially beaten by generating a
  -- new address per request; this is the backstop that makes that pointless.
  -- Ten an hour is roughly an order of magnitude above anything this salon
  -- will legitimately receive, so it costs a real enquirer nothing.
  select count(*) into v_recent
    from public.email_messages m
   where m.template = 'contact_message_received'
     and m.created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'TOO_MANY_MESSAGES' using errcode = 'P0001';
  end if;

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

-- Both counts above are the hot path of a public endpoint, so neither may be a
-- sequential scan over every message the salon has ever sent. The index is
-- partial on the template, which keeps it small — contact messages are a thin
-- slice of the table — and carries the address expression the per-address cap
-- compares on.
create index if not exists email_messages_contact_recent_idx
  on public.email_messages (lower(payload ->> 'email'), created_at desc)
  where template = 'contact_message_received';
