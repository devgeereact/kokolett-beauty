-- =====================================================================
-- 0058_broadcast_messaging.sql
--
-- send_broadcast_as_owner() queues one email_messages row per confirmed,
-- not-unsubscribed subscriber — no new sending pathway, the existing
-- outbox/drain job/retry behaviour applies unchanged. Logged via
-- log_audit_event() with the subject and recipient count only, never the
-- recipient list or body (same principle as erasure/export).
--
-- unsubscribe_via_link() is anon-callable by design: a visitor clicking
-- the link has no session. It's keyed on the subscriber's own id rather
-- than a hashed token table (see docs/superpowers/specs/2026-08-30-
-- ai-broadcast-messaging-design.md §5.2 for why this is safe) —
-- idempotent, and reveals nothing about whether an id exists or was
-- already unsubscribed.
-- =====================================================================

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'appointment.created',
    'appointment.status_changed',
    'appointment.rescheduled',
    'appointment.deleted',
    'customer.erased',
    'payment.recorded',
    'settings.login_slug_changed',
    'day.closed',
    'customer.data_exported',
    'broadcast.sent'
  ));

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

  -- Goes through queue_email() (0005), not a raw insert — it's what sets
  -- scheduled_for to now() when none is given. A raw insert leaving that
  -- column null would never be picked up by the drain job at all: its
  -- `scheduled_for <= now()` filter compares false-or-null against null,
  -- never true. security definer lets this call queue_email() even though
  -- that function is revoked from every client role — the same reasoning
  -- every other RPC in this app already relies on for log_audit_event().
  for v_subscriber in
    select id, email, full_name from public.subscribers
    where confirmed and unsubscribed_at is null
  loop
    perform public.queue_email(
      'owner_broadcast', v_subscriber.email, p_subject, null, null, null,
      jsonb_build_object(
        'full_name', v_subscriber.full_name,
        'custom_body', p_body,
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

revoke all on function public.send_broadcast_as_owner(text, text) from public, anon;
grant execute on function public.send_broadcast_as_owner(text, text) to authenticated;

create or replace function public.unsubscribe_via_link(p_subscriber_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now())
   where id = p_subscriber_id;
end;
$$;

revoke all on function public.unsubscribe_via_link(uuid) from public;
grant execute on function public.unsubscribe_via_link(uuid) to anon, authenticated;

-- ---------- Reserved-slug housekeeping ------------------------------------
-- 'unsubscribe' is a new top-level public route (src/pages/UnsubscribePage.tsx).
-- Redefined verbatim from 0051 with one addition to the array — same
-- signature, same validation, same grants (grants persist across
-- `create or replace function`, so none are restated here).
create or replace function public.set_owner_login_slug(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug     text := lower(trim(p_slug));
  v_old_slug text;
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

  if v_slug = any (array[
    'about','gallery','services','testimonials','faqs','contact','book',
    'request-availability','subscribe','privacy','booking-policy','terms',
    'my','access','dashboard','login','reset-password',
    'admin','owner','staff','signin','signup','logout','api','app',
    'unsubscribe'
  ]) then
    raise exception 'SLUG_RESERVED' using errcode = 'P0001';
  end if;

  select login_slug into v_old_slug from public.staff where id = auth.uid();

  update public.staff
     set login_slug = v_slug,
         login_slug_updated_at = timezone('utc', now())
   where id = auth.uid();

  perform public.log_audit_event(
    'settings.login_slug_changed', 'staff', auth.uid(),
    'Owner sign-in link changed',
    jsonb_build_object('login_slug', v_old_slug),
    jsonb_build_object('login_slug', v_slug));
end;
$$;
