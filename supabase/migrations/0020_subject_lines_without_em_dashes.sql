-- =====================================================================
-- 0020_subject_lines_without_em_dashes.sql
--
-- Cosmetic, but in the most visible place there is.
--
-- 0018 was applied to the live database before the em dashes were taken out
-- of its subject lines, so every confirmation, reminder and cancellation that
-- has gone out since reads "Your appointment is confirmed — KB-XXXXXX" in the
-- inbox list. The file on disk was corrected; the database was not. This
-- re-applies the three functions exactly as 0018 now defines them, so the two
-- agree and new mail uses the middle dot.
--
-- Nothing else changes: same logic, same triggers, same payloads. Mail already
-- queued keeps whatever subject it was written with.
-- =====================================================================

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
