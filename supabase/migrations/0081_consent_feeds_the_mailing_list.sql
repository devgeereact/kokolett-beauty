-- =====================================================================
-- 0081_consent_feeds_the_mailing_list.sql
--
-- `customers.marketing_consent` and `public.subscribers` were two separate
-- opt-in systems that never spoke to each other. 0060 said so out loud
-- ("Deliberately not touching public.subscribers"), and the consequence only
-- shows up on the Broadcasts screen: a customer who ticks the marketing box
-- while booking, or has it ticked for her by the owner on the Customers page,
-- is never a broadcast recipient. `send_broadcast_as_owner` (0058) reads
-- `subscribers` alone, so the owner sees "Nobody has confirmed their
-- subscription yet" while looking at a customer list full of ticked consent
-- boxes.
--
-- Two systems with two answers to "may we email this person" is the bug. This
-- makes `subscribers` the single mailing list and feeds consent into it at the
-- moment consent is given, rather than teaching the broadcast query to union
-- two sources at send time: the count on the screen is then the same row set
-- the send will use, and it is right the instant the box is ticked instead of
-- only when somebody presses Send.
--
-- Consent flows in; opting out flows back. `unsubscribe_via_link` now also
-- clears `customers.marketing_consent`, so a person who unsubscribes is not
-- re-added by the next consent write, and the customer record stops claiming
-- a consent she has withdrawn.
--
-- What this deliberately does NOT do: clear `unsubscribed_at`. 0071 removed
-- that from `subscribe_to_updates` because it let anyone who knew an address
-- undo somebody else's opt-out, and the same reasoning holds here. A ticked
-- consent box does not resurrect an explicit unsubscribe. Those people are
-- counted separately by `broadcast_audience()` below so the owner can see
-- why a recipient is missing rather than wondering.
-- =====================================================================

-- ---------- Consent writes reach the mailing list -------------------------

create or replace function public.sync_marketing_consent_to_subscribers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only ever acts on consent being present. Setting it to false does
  -- nothing here, which is what keeps `unsubscribe_via_link` (which writes
  -- exactly that) from re-entering this trigger.
  if not coalesce(new.marketing_consent, false) then
    return new;
  end if;

  -- An erased or anonymised customer keeps a row (0042 leaves one behind when
  -- payments force it) with an `@invalid` address. Never mail it.
  if new.deleted_at is not null or new.email is null then
    return new;
  end if;

  insert into public.subscribers (email, full_name, source)
  values (new.email, nullif(trim(coalesce(new.full_name, '')), ''), 'customer_consent')
  on conflict (email) do update
    set full_name = coalesce(public.subscribers.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists customers_consent_to_subscribers on public.customers;
create trigger customers_consent_to_subscribers
  after insert or update of marketing_consent, email, deleted_at
  on public.customers
  for each row
  execute function public.sync_marketing_consent_to_subscribers();

-- ---------- Backfill the consent already given ----------------------------
-- Same rules as the trigger: live customers only, and an existing row is
-- never resurrected or reconfirmed.
insert into public.subscribers (email, full_name, source)
select c.email, nullif(trim(coalesce(c.full_name, '')), ''), 'customer_consent'
  from public.customers c
 where c.marketing_consent
   and c.deleted_at is null
   and c.email is not null
on conflict (email) do update
  set full_name = coalesce(public.subscribers.full_name, excluded.full_name);

-- ---------- Opting out reaches the customer record ------------------------

create or replace function public.unsubscribe_via_link(p_subscriber_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email citext;
begin
  update public.subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now())
   where id = p_subscriber_id
  returning email into v_email;

  -- Withdrawing consent has to reach the other record too, or the trigger
  -- above puts them straight back on the list the next time anything touches
  -- their customer row, and the Customers page goes on showing a consent they
  -- have just revoked.
  if v_email is not null then
    update public.customers
       set marketing_consent = false,
           consent_updated_at = now()
     where email = v_email
       and marketing_consent;
  end if;
end;
$$;

revoke all on function public.unsubscribe_via_link(uuid) from public;
grant execute on function public.unsubscribe_via_link(uuid) to anon, authenticated;

-- ---------- One audience, read by both the screen and the send ------------

create or replace function public.broadcast_audience()
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

  select jsonb_build_object(
    'recipient_count', count(*) filter (where confirmed and unsubscribed_at is null),
    'from_consent',    count(*) filter (where confirmed and unsubscribed_at is null
                                          and source = 'customer_consent'),
    'from_website',    count(*) filter (where confirmed and unsubscribed_at is null
                                          and source <> 'customer_consent'),
    'opted_out',       count(*) filter (where unsubscribed_at is not null)
  )
  into v_result
  from public.subscribers;

  return v_result;
end;
$$;

revoke all on function public.broadcast_audience() from public, anon;
grant execute on function public.broadcast_audience() to authenticated;

-- ---------- The broadcast carries its own headline ------------------------
-- Redefined from 0058 with one addition: `broadcast_subject` in the payload.
-- Every other template renders a real headline ("You are booked in"); this one
-- had the salon name as its <h1>, because the subject lived on
-- `email_messages.subject` and `render()` only ever sees the payload. Same
-- signature and same grants as 0058, so none are restated.
create or replace function public.send_broadcast_as_owner(
  p_subject text,
  p_body    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count      integer := 0;
  v_subscriber record;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if p_subject is null or trim(p_subject) = '' then
    raise exception 'INVALID_SUBJECT' using errcode = 'P0001';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'INVALID_BODY' using errcode = 'P0001';
  end if;

  for v_subscriber in
    select id, email, full_name from public.subscribers
    where confirmed and unsubscribed_at is null
  loop
    perform public.queue_email(
      'owner_broadcast', v_subscriber.email, p_subject, null, null, null,
      jsonb_build_object(
        'full_name', v_subscriber.full_name,
        'custom_body', p_body,
        'broadcast_subject', p_subject,
        'subscriber_id', v_subscriber.id
      )
    );
    v_count := v_count + 1;
  end loop;

  perform public.log_audit_event(
    'broadcast.sent', 'broadcast', null,
    format('Broadcast sent to %s subscriber(s): %s', v_count, p_subject),
    null, jsonb_build_object('recipient_count', v_count, 'subject', p_subject));

  return jsonb_build_object('recipient_count', v_count);
end;
$$;
