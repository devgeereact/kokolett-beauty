-- Two fixes to the same trigger.
--
-- 1. A cancellation now emails the owner. Every other customer-initiated event
--    already did — a new booking, a move, an availability request — but the one
--    event that frees a chair at short notice reached her only as an in-app
--    notification, which requires the dashboard to be open to be of any use.
--    The customer-facing copy on /my has always said that later cancellations
--    mean "the salon is told"; now that is true by email as well.
--
-- 2. Superseded reminders retire as `cancelled` rather than `failed` (see
--    0040). `last_error` goes back to null, because there was no error.
--
-- The payload gains the customer's own contact details on every branch rather
-- than only on the `rescheduled` one. Both owner notifications need them, and
-- building the same object twice is how the two drift apart later.

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

-- Historic rows carry the old marker. They were retirements too, and leaving
-- them as failures would keep the Failed count wrong for the life of the log.
update public.email_messages
   set status = 'cancelled',
       last_error = null
 where status = 'failed'
   and last_error like 'Appointment % before send';

insert into public.email_templates
  (key, category, subject, html_body, active, allow_edit_before_sending, include_in_automation)
values (
  'owner_cancelled',
  'Owner notifications',
  'A customer cancelled',
  '<p>{{customer_name}} cancelled their appointment on {{appointment_date}} at {{appointment_time}}.</p>' ||
  '<p>The time is free again on your calendar.</p>',
  true,
  true,
  false
)
on conflict (key) do nothing;
