-- =====================================================================
-- 0016_retire_unsent_mail.sql — an email about a booking that no longer exists
--
-- Caught while testing reschedule. When a booking stops being live, the trigger
-- retired its queued reminders and review request — but not its queued
-- *confirmation*.
--
-- The queue drains every five minutes, so anyone who booked and then cancelled
-- or moved within that window would receive "You are booked in" for an
-- appointment that had already been retired, immediately followed by the
-- cancellation or the new confirmation. Confusing on its own, and actively bad
-- for a first-time customer deciding whether this salon has its act together.
--
-- It was invisible before because the tests inspected the queue rather than
-- what came out of it, and a human testing by hand would rarely be quick enough.
--
-- Only unsent rows are touched. Anything already delivered is history, and
-- rewriting history in the outbox would make `sent_at` a lie.
-- =====================================================================

create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_service  public.services%rowtype;
  v_settings public.booking_settings%rowtype;
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
    'price_pence', new.price_pence,
    'timezone', v_settings.timezone,
    'reason', coalesce(new.rejection_reason, new.cancellation_reason),
    'google_review_url', v_settings.google_review_url
  );

  if new.status = 'confirmed' and old.status = 'pending_approval' then
    perform public.queue_email(
      'booking_approved', v_customer.email::text,
      'Your appointment is confirmed — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email('reminder_24h', v_customer.email::text,
        'Your appointment tomorrow — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email('reminder_2h', v_customer.email::text,
        'See you shortly — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
    end if;

  elsif new.status = 'rejected' then
    perform public.queue_email(
      'booking_declined', v_customer.email::text,
      'About your booking request — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

  elsif new.status = 'cancelled' then
    perform public.queue_email(
      'booking_cancelled', v_customer.email::text,
      'Your appointment is cancelled — ' || new.reference,
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
    if v_settings.google_review_url is not null then
      perform public.queue_email(
        'review_request', v_customer.email::text,
        'How did we do?',
        new.id, v_customer.id, now() + interval '2 hours', v_payload);
    end if;
  end if;

  -- Nothing unsent about a booking that is no longer happening should go out:
  -- not the reminders, and not the confirmation that had not left the queue yet.
  -- Already-sent rows are left alone; they are history.
  if new.status in ('cancelled', 'rejected', 'no_show', 'rescheduled') then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment ' || new.status || ' before this was sent'
     where appointment_id = new.id
       and status = 'queued'
       and template in (
         'reminder_24h', 'reminder_2h', 'review_request',
         'booking_confirmed', 'booking_held', 'booking_approved',
         'owner_new_booking', 'owner_approval_needed'
       );
  end if;

  return new;
end;
$$;

-- Retire anything already sitting in the queue for a retired booking.
update public.email_messages m
   set status = 'failed',
       last_error = 'Appointment no longer live when the queue was corrected (0016)'
  from public.appointments a
 where a.id = m.appointment_id
   and m.status = 'queued'
   and a.status in ('cancelled', 'rejected', 'no_show', 'rescheduled')
   and m.template in (
     'reminder_24h', 'reminder_2h', 'review_request',
     'booking_confirmed', 'booking_held', 'booking_approved',
     'owner_new_booking', 'owner_approval_needed'
   );
