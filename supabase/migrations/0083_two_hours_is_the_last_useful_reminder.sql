-- =====================================================================
-- 0083_two_hours_is_the_last_useful_reminder.sql
--
-- Three of the nineteen email templates were wired to nothing.
--
--   * `reminder_2h` was written and catalogued and never queued, so the
--     Templates screen offered the owner wording that could not reach anybody.
--   * `review_request` was the same, and its absence was the real gap: the
--     salon asked for no reviews at all.
--   * `reminder_1h` did send, an hour before the appointment, by which point
--     the customer is already travelling and the email can change nothing.
--
-- The owner's call, taken 2026-09-06: reminders at 24 hours and 2 hours, and
-- the Google review ask folded into the thank-you rather than sent as its own
-- email. Two hours is the last point a reminder is useful, because she can
-- still leave on time or ring the salon; one hour is a notification, not a
-- reminder. Two emails per visit rather than three, and one after it rather
-- than two, because the fastest way onto a spam list is to send more mail than
-- the relationship warrants.
--
-- `reminder_1h` and `review_request` therefore stop being scheduled. Both
-- renderers stay in `_shared/templates.ts` so a row already queued under
-- either still renders correctly on its way out, and both come out of the
-- Templates catalogue so the owner is not editing copy that no longer sends.
-- The review link now rides on `appointment_completed`, which already goes out
-- two hours after an appointment is marked completed.
--
-- Both functions are restated in full from 0020 and 0063 with only the
-- reminder block changed, which is how every other migration in this project
-- redefines a trigger function.
-- =====================================================================

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
    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email(
        'reminder_2h', v_customer.email::text,
        'See you in a couple of hours · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
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

create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
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

  select p.email into v_owner
    from public.staff s join public.profiles p on p.id = s.id
   order by s.created_at limit 1;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'customer_email', v_customer.email::text,
    'customer_mobile', v_customer.mobile,
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
    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email('reminder_2h', v_customer.email::text,
        'See you in a couple of hours · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
    end if;

  elsif old.status = 'cancelled' then
    -- Undo: the cancellation notice hasn't necessarily shipped yet (the
    -- outbox drains every 5 minutes; Undo is an 8-second window), so fail it
    -- before it does. Re-queue the reminders the cancellation retired,
    -- exactly the same way a fresh approval schedules them -- if the
    -- appointment is now too close for one to make sense, the same interval
    -- guard that already protects the approval path skips it here too.
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment un-cancelled by the owner before this was sent'
     where appointment_id = new.id
       and status = 'queued'
       and template in ('booking_cancelled', 'owner_cancelled');

    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email('reminder_24h', v_customer.email::text,
        'Your appointment tomorrow · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;
    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email('reminder_2h', v_customer.email::text,
        'See you in a couple of hours · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
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

    -- The chair is now free at a time the owner had already committed. Late
    -- notice is exactly when she most needs to hear about it away from the
    -- dashboard, so this is deliberately not gated on how close the booking is.
    if v_owner is not null then
      perform public.queue_email(
        'owner_cancelled', v_owner,
        'Cancelled: ' || v_customer.full_name,
        new.id, v_customer.id, null, v_payload);
    end if;

  elsif new.status = 'rescheduled' then
    if v_owner is not null then
      perform public.queue_email(
        'owner_booking_moved', v_owner,
        'Moved: ' || v_customer.full_name,
        new.id, v_customer.id, null, v_payload);
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
       set status = 'cancelled',
           last_error = null
     where appointment_id = new.id
       and status = 'queued'
       and template = any (public.retired_booking_templates());
  end if;

  return new;
end;
$function$;

-- ---------- Reminders already queued for bookings on the books -------------
-- Anything queued under `reminder_1h` is now copy nothing will schedule again.
-- Move the ones that still have time onto the two-hour slot rather than
-- dropping them, so somebody who booked before this migration still gets her
-- reminder. Sent rows are history and are left exactly as they are.
update public.email_messages m
   set template = 'reminder_2h',
       subject = replace(m.subject, 'See you in an hour', 'See you in a couple of hours'),
       scheduled_for = a.starts_at - interval '2 hours'
  from public.appointments a
 where a.id = m.appointment_id
   and m.template = 'reminder_1h'
   and m.status = 'queued'
   and a.starts_at - interval '2 hours' > now();

-- Whatever is left is now too close for a two-hour reminder to mean anything.
update public.email_messages
   set status = 'cancelled',
       last_error = 'Retired by 0083: the one hour reminder is no longer sent'
 where template = 'reminder_1h'
   and status = 'queued';

