-- =====================================================================
-- 0010_no_reminders_in_the_past.sql
--
-- Bug, surfaced by re-running the email suite after the 0007 policy change:
-- a booking made for later the same day was queued a 24-hour reminder dated in
-- the past, which the drain would send immediately — telling someone their
-- appointment is "tomorrow" three hours before it starts.
--
-- `notify_appointment_status_changed` already guarded this when approving a
-- held booking. `notify_appointment_created` never did. Under the old hybrid
-- policy that rarely mattered: first-time customers were held, so most
-- bookings reached their reminders through the approval path. Since 0007
-- everything confirms instantly, so the unguarded path is now the normal one.
--
-- A reminder whose moment has passed is not queued at all. There is no value
-- in a late reminder, and sending one is worse than silence.
-- =====================================================================

create or replace function public.notify_appointment_created()
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
  select * into v_customer from public.customers where id = new.customer_id;
  select * into v_service  from public.services  where id = new.service_id;
  select * into v_settings from public.booking_settings where id;

  v_payload := jsonb_build_object(
    'reference', new.reference,
    'customer_name', v_customer.full_name,
    'service_name', v_service.name,
    'starts_at', new.starts_at,
    'ends_at', new.ends_at,
    'price_pence', new.price_pence,
    'timezone', v_settings.timezone,
    'approval_window_h', v_settings.approval_window_h,
    'cancellation_window_h', v_settings.cancellation_window_h
  );

  if new.status = 'pending_approval' then
    perform public.queue_email(
      'booking_held', v_customer.email::text,
      'We have your booking request — ' || new.reference,
      new.id, v_customer.id, null, v_payload);
  else
    perform public.queue_email(
      'booking_confirmed', v_customer.email::text,
      'Your appointment is confirmed — ' || new.reference,
      new.id, v_customer.id, null, v_payload);

    -- Reminders ride on the booking, not on a nightly sweep, so a scheduler
    -- outage delays one rather than losing it — but only if it is still ahead.
    if new.starts_at - interval '24 hours' > now() then
      perform public.queue_email(
        'reminder_24h', v_customer.email::text,
        'Your appointment tomorrow — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '24 hours', v_payload);
    end if;

    if new.starts_at - interval '2 hours' > now() then
      perform public.queue_email(
        'reminder_2h', v_customer.email::text,
        'See you shortly — ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '2 hours', v_payload);
    end if;
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
      new.id, v_customer.id, null,
      v_payload || jsonb_build_object(
        'customer_email', v_customer.email::text,
        'customer_mobile', v_customer.mobile,
        'customer_note', new.customer_note));
  end if;

  return new;
end;
$$;

-- Anything already queued in the past is dead on arrival; retire it rather
-- than let the first drain send a batch of stale reminders.
update public.email_messages
   set status = 'failed',
       last_error = 'Reminder time had already passed when queued (fixed in 0010)'
 where status = 'queued'
   and template in ('reminder_24h', 'reminder_2h')
   and scheduled_for < now();
