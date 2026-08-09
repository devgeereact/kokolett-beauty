-- =====================================================================
-- 0018_service_menu_and_mail.sql — the menu, the mailing list, the mail
--
-- Three things the owner could not do without a deploy, and one email the
-- customer never got.
--
--   1. The list of styles on the home page was a constant in a .tsx file.
--      A salon adds a style the week it becomes popular; that cannot wait on
--      a build. It moves into `service_menu`.
--
--   2. There was nowhere for someone to say "tell me when you have offers"
--      without booking first. `subscribers` is that list, and the owner gets a
--      link she can paste into an Instagram bio.
--
--   3. A finished appointment sent a review request, but only if a Google link
--      happened to be configured, and it said nothing about the appointment.
--      Completion now always sends a proper thank-you, with the review ask
--      folded in when there is somewhere to send it.
--
-- Also: the second reminder moves from two hours out to one. The owner asked
-- for an hour, and an hour before is when a customer can still do something
-- about it.
--
-- Note on `service_menu` vs `services`: these are different things and the
-- names are unavoidably close. `services` holds the ONE bookable appointment
-- type (its length and price) and is what `book_appointment()` reads.
-- `service_menu` is the marketing list of styles offered. Nothing in the
-- booking path reads `service_menu`, and nothing in the menu is bookable
-- separately. Keeping them apart is deliberate: the salon sells time, and the
-- style is decided in the chair.
-- =====================================================================

-- ---------- 1. The menu of styles ---------------------------------------
create table if not exists public.service_menu (
  id          uuid primary key default gen_random_uuid(),
  group_name  text not null,
  name        text not null,
  /** Free text: "about 4 hours", "half a day". Never a price. */
  note        text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create unique index if not exists service_menu_unique_name
  on public.service_menu (lower(group_name), lower(name));

create index if not exists service_menu_order_idx
  on public.service_menu (active, sort_order, group_name, name);

drop trigger if exists service_menu_set_updated_at on public.service_menu;
create trigger service_menu_set_updated_at
  before update on public.service_menu
  for each row execute function public.set_updated_at();

alter table public.service_menu enable row level security;

-- The menu is a shop window; anyone may read the active rows.
drop policy if exists service_menu_public_read on public.service_menu;
create policy service_menu_public_read on public.service_menu
  for select using (active);

drop policy if exists service_menu_owner_all on public.service_menu;
create policy service_menu_owner_all on public.service_menu
  for all using (public.is_owner()) with check (public.is_owner());

/**
 * The menu as the home page wants it: grouped, ordered, active only.
 *
 * Returned as one jsonb document so the page makes a single call and does no
 * grouping of its own. An empty menu returns an empty array, which the page
 * renders as nothing rather than as an error.
 */
create or replace function public.public_service_menu()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(g order by g->>'sort_order', g->>'group_name'),
    '[]'::jsonb
  )
  from (
    select jsonb_build_object(
             'group_name', group_name,
             'sort_order', lpad(min(sort_order)::text, 6, '0'),
             'items', jsonb_agg(
                        jsonb_build_object('name', name, 'note', note)
                        order by sort_order, name)
           ) as g
      from public.service_menu
     where active
     group by group_name
  ) grouped;
$$;

grant execute on function public.public_service_menu() to anon, authenticated;

-- Seeded with a working list for an African hair salon. The owner strikes
-- anything she does not do: a style listed here that gets turned down at the
-- door costs more goodwill than it wins.
insert into public.service_menu (group_name, name, sort_order)
select g.group_name, s.name, (g.ord * 100) + s.ord
from (values
  ('Braids', 1),
  ('Twists and locs', 2),
  ('Weaves, wigs and extensions', 3),
  ('Natural hair and styling', 4),
  ('Colour', 5),
  ('Treatments', 6)
) as g(group_name, ord)
join (values
  ('Braids', 'Knotless braids', 1),
  ('Braids', 'Box braids', 2),
  ('Braids', 'Cornrows', 3),
  ('Braids', 'Feed-in braids', 4),
  ('Braids', 'Ghana braids', 5),
  ('Braids', 'Fulani braids', 6),
  ('Braids', 'Lemonade braids', 7),
  ('Braids', 'Stitch braids', 8),
  ('Braids', 'Tribal braids', 9),
  ('Braids', 'Micro braids', 10),
  ('Braids', 'Kids braids', 11),
  ('Twists and locs', 'Senegalese twists', 1),
  ('Twists and locs', 'Passion twists', 2),
  ('Twists and locs', 'Spring twists', 3),
  ('Twists and locs', 'Marley twists', 4),
  ('Twists and locs', 'Two strand twists', 5),
  ('Twists and locs', 'Faux locs', 6),
  ('Twists and locs', 'Butterfly locs', 7),
  ('Twists and locs', 'Soft locs', 8),
  ('Twists and locs', 'Starter locs', 9),
  ('Twists and locs', 'Loc retwist and styling', 10),
  ('Weaves, wigs and extensions', 'Sew-in weave', 1),
  ('Weaves, wigs and extensions', 'Closure and frontal install', 2),
  ('Weaves, wigs and extensions', 'Quick weave', 3),
  ('Weaves, wigs and extensions', 'Crochet braids', 4),
  ('Weaves, wigs and extensions', 'Wig install', 5),
  ('Weaves, wigs and extensions', 'Wig customising and revamp', 6),
  ('Weaves, wigs and extensions', 'Tape-in extensions', 7),
  ('Weaves, wigs and extensions', 'Micro-link extensions', 8),
  ('Weaves, wigs and extensions', 'Take-down and detangle', 9),
  ('Natural hair and styling', 'Wash and go', 1),
  ('Natural hair and styling', 'Silk press', 2),
  ('Natural hair and styling', 'Blow dry and style', 3),
  ('Natural hair and styling', 'Twist-out and braid-out', 4),
  ('Natural hair and styling', 'Cut, trim and shaping', 5),
  ('Natural hair and styling', 'Big chop and transitioning', 6),
  ('Natural hair and styling', 'Bridal and occasion styling', 7),
  ('Natural hair and styling', 'Relaxer and texturiser', 8),
  ('Colour', 'Full colour', 1),
  ('Colour', 'Root touch-up', 2),
  ('Colour', 'Highlights and lowlights', 3),
  ('Colour', 'Bleaching and lifting', 4),
  ('Colour', 'Toning and glossing', 5),
  ('Treatments', 'Deep conditioning', 1),
  ('Treatments', 'Protein and bond repair', 2),
  ('Treatments', 'Scalp treatment', 3),
  ('Treatments', 'Steam treatment', 4),
  ('Treatments', 'Hot oil treatment', 5),
  ('Treatments', 'Trim and split-end care', 6)
) as s(group_name, name, ord) on s.group_name = g.group_name
on conflict do nothing;

-- ---------- 2. The mailing list ------------------------------------------
create table if not exists public.subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          citext not null unique,
  full_name      text,
  source         text not null default 'website',
  confirmed      boolean not null default true,
  unsubscribed_at timestamptz,
  created_at     timestamptz not null default timezone('utc', now())
);

alter table public.subscribers enable row level security;

-- No public select. A mailing list that anyone can read is a leaked mailing
-- list; subscribing goes through the function below, which returns nothing.
drop policy if exists subscribers_owner_all on public.subscribers;
create policy subscribers_owner_all on public.subscribers
  for all using (public.is_owner()) with check (public.is_owner());

/**
 * Join the list.
 *
 * Deliberately returns void and never reports whether the address was already
 * present. Telling an anonymous caller "that one is already subscribed" turns
 * the form into a membership oracle for any address someone cares to try.
 */
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
begin
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;

  insert into public.subscribers (email, full_name, source)
  values (lower(trim(p_email))::citext, nullif(trim(p_full_name), ''),
          coalesce(nullif(trim(p_source), ''), 'website'))
  on conflict (email) do update
    set unsubscribed_at = null,
        full_name = coalesce(public.subscribers.full_name, excluded.full_name);
end;
$$;

revoke all on function public.subscribe_to_updates(text, text, text) from public;
grant execute on function public.subscribe_to_updates(text, text, text)
  to anon, authenticated;

-- ---------- 3. The mail the customer actually gets ------------------------
-- Rewritten wholesale rather than patched. Three changes from 0015:
--   * the second reminder is an hour out, not two;
--   * completion always emails the customer, review link or not;
--   * a moved booking says so, instead of arriving as a bare confirmation.
create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer public.customers;
  v_service  public.services;
  v_settings public.booking_settings;
  v_owner    text;
  v_payload  jsonb;
begin
  if new.status = old.status then
    return new;
  end if;

  select * into v_customer from public.customers where id = new.customer_id;
  select * into v_service  from public.services  where id = new.service_id;
  select * into v_settings from public.booking_settings where id;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'service_name', v_service.name,
    'starts_at', new.starts_at,
    'ends_at', new.ends_at,
    'timezone', v_settings.timezone,
    'reason', coalesce(new.rejection_reason, new.cancellation_reason),
    'cancellation_window_h', v_settings.cancellation_window_h,
    'approval_window_h', v_settings.approval_window_h,
    'salon_address', v_settings.address_line,
    'salon_phone', v_settings.phone,
    'instagram_url', v_settings.instagram_url,
    'google_review_url', v_settings.google_review_url
  );

  if new.status = 'confirmed' and old.status = 'pending_approval' then
    perform public.queue_email(
      'booking_approved', v_customer.email::text,
      'Your appointment is confirmed · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email('reminder_24h', v_customer.email::text,
        'Your appointment tomorrow · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '1 hour' > now() then
      perform public.queue_email('reminder_1h', v_customer.email::text,
        'See you in an hour · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '1 hour', v_payload);
    end if;

  elsif new.status = 'rejected' then
    perform public.queue_email(
      'booking_declined', v_customer.email::text,
      'About your booking request · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'cancelled' then
    perform public.queue_email(
      'booking_cancelled', v_customer.email::text,
      'Your appointment is cancelled · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'rescheduled' then
    select p.email into v_owner
      from public.staff s join public.profiles p on p.id = s.id
     order by s.created_at limit 1;

    if v_owner is not null then
      perform public.queue_email(
        'owner_booking_moved', v_owner,
        'Moved: ' || v_customer.full_name,
        new.id, v_customer.id, null,
        v_payload || jsonb_build_object(
          'customer_email', v_customer.email::text,
          'customer_mobile', v_customer.mobile));
    end if;

  elsif new.status = 'completed' then
    -- Always. The thank-you is the email that asks for the next booking, and
    -- whether a Google link is configured is the salon's business, not a
    -- reason for the customer to hear nothing.
    perform public.queue_email(
      'appointment_completed', v_customer.email::text,
      'Thank you for coming in · ' || new.reference,
      new.id, v_customer.id, now() + interval '2 hours',
      v_payload || jsonb_build_object('owner_note', new.owner_note));
  end if;

  if new.status in ('cancelled', 'rejected', 'no_show', 'rescheduled') then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment ' || new.status || ' before send'
     where appointment_id = new.id
       and status = 'queued'
       and template in ('reminder_24h', 'reminder_2h', 'reminder_1h',
                        'review_request', 'appointment_completed');
  end if;

  return new;
end;
$$;

-- Reminders scheduled at booking time move to the same one-hour mark.
create or replace function public.notify_appointment_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer public.customers;
  v_service  public.services;
  v_settings public.booking_settings;
  v_owner    text;
  v_payload  jsonb;
begin
  select * into v_customer from public.customers where id = new.customer_id;
  select * into v_service  from public.services  where id = new.service_id;
  select * into v_settings from public.booking_settings where id;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'customer_email', v_customer.email::text,
    'customer_mobile', v_customer.mobile,
    'customer_note', new.customer_note,
    'service_name', v_service.name,
    'starts_at', new.starts_at,
    'ends_at', new.ends_at,
    'timezone', v_settings.timezone,
    'approval_window_h', v_settings.approval_window_h,
    'cancellation_window_h', v_settings.cancellation_window_h,
    'salon_address', v_settings.address_line,
    'salon_phone', v_settings.phone,
    'instagram_url', v_settings.instagram_url,
    'google_review_url', v_settings.google_review_url
  );

  if new.status = 'confirmed' then
    perform public.queue_email(
      'booking_confirmed', v_customer.email::text,
      'Your appointment is confirmed · ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    -- Never schedule a reminder for a moment that has already passed. A
    -- same-day booking would otherwise be told "see you tomorrow" at once.
    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email(
        'reminder_24h', v_customer.email::text,
        'Your appointment tomorrow · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '1 hour' > now() then
      perform public.queue_email(
        'reminder_1h', v_customer.email::text,
        'See you in an hour · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '1 hour', v_payload);
    end if;

  elsif new.status = 'pending_approval' then
    perform public.queue_email(
      'booking_held', v_customer.email::text,
      'We have your booking request · ' || new.reference,
      new.id, v_customer.id, null, v_payload);
  end if;

  select p.email into v_owner
    from public.staff s join public.profiles p on p.id = s.id
   order by s.created_at limit 1;

  if v_owner is not null then
    perform public.queue_email(
      case when new.status = 'pending_approval'
           then 'owner_approval_needed' else 'owner_new_booking' end,
      v_owner,
      case when new.status = 'pending_approval'
           then 'Approval needed: ' || v_customer.full_name
           else 'New booking: ' || v_customer.full_name end,
      new.id, v_customer.id, null, v_payload);
  end if;

  return new;
end;
$$;

-- ---------- 4. A moved booking reads as moved -----------------------------
/**
 * Turn the replacement booking's confirmation into a reschedule notice.
 *
 * `customer_reschedule_appointment()` inserts a new appointment, and the insert
 * trigger queues a plain `booking_confirmed` for it. That is technically true
 * and practically wrong: the customer asked to move an appointment and should
 * be told what moved, from when, to when. This runs after the insert, finds
 * that queued message while it is still unsent, and rewrites it.
 */
create or replace function public.rescheduled_mail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.appointments;
begin
  if new.rescheduled_from is null then
    return new;
  end if;

  select * into v_old from public.appointments where id = new.rescheduled_from;
  if v_old is null then
    return new;
  end if;

  update public.email_messages
     set template = 'booking_rescheduled',
         subject  = 'Your appointment has moved · ' || new.reference,
         payload  = payload || jsonb_build_object(
                      'previous_starts_at', v_old.starts_at)
   where appointment_id = new.id
     and status = 'queued'
     and template in ('booking_confirmed', 'booking_approved');

  return new;
end;
$$;

-- Named to sort AFTER `appointments_notify_created`. Postgres fires same-event
-- triggers in name order, and this one rewrites a row that trigger queues, so
-- firing first would find nothing.
drop trigger if exists appointments_zz_rescheduled_mail on public.appointments;
create trigger appointments_zz_rescheduled_mail
  after insert on public.appointments
  for each row execute function public.rescheduled_mail();

-- Anything already queued as a two-hour reminder becomes a one-hour one, so
-- the change applies to bookings taken before this migration ran.
update public.email_messages
   set template = 'reminder_1h',
       subject = replace(subject, 'See you shortly', 'See you in an hour'),
       scheduled_for = scheduled_for + interval '1 hour'
 where status = 'queued'
   and template = 'reminder_2h';
