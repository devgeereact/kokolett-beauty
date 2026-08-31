-- =====================================================================
-- 0063_undo_cancellation.sql
--
-- KOKO_GAP.md P3: "No 'Undo · Ns' pattern found... accidental
-- cancellation is not reversible without redoing the booking." The
-- generic Toast `action` (label + onClick, 8s auto-dismiss) already
-- exists -- ToastContext.tsx's own comment says it "generalises the
-- undo-banner pattern that used to live as page-local state in
-- TodayPage" -- and TodayPage.changeStatus() already wires it up for
-- every status change, restoring the previous status on click. That
-- code path is already correct; what's missing is that the database
-- has never allowed 'cancelled' to transition anywhere at all, so
-- clicking Undo after a cancellation on TodayPage today hits
-- ILLEGAL_TRANSITION.
--
-- This migration is the fix: allow 'cancelled' -> whatever it was
-- cancelled from (confirmed/checked_in/in_service), and teach the
-- notification trigger to fail the queued cancellation-notice emails
-- before they ship and re-queue the reminder emails the cancellation
-- retired -- the same undo-affects-the-outbox-too pattern 0052 already
-- uses for un-completing an appointment.
--
-- Deliberately NOT extending this to reschedule: rescheduleAppointmentAsOwner
-- retires the old row and creates a new one (0024), so "undo" there
-- means cancelling the new booking and reviving the old one -- a real
-- slot-conflict and email design question of its own, not a same-shape
-- fix. Left open, documented in KOKO_GAP.md rather than half-built.
-- =====================================================================

create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     public.appointments;
  v_current public.appointment_status;
  v_allowed public.appointment_status[];
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select status into v_current from public.appointments where id = p_appointment_id;
  if v_current is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  v_allowed := case v_current
    when 'confirmed'  then array['checked_in','in_service','completed','cancelled','no_show']::public.appointment_status[]
    when 'checked_in' then array['in_service','completed','cancelled','no_show']::public.appointment_status[]
    when 'in_service' then array['completed','cancelled']::public.appointment_status[]
    when 'completed'  then array['confirmed']::public.appointment_status[]
    -- Undo: restore to whichever active status it was cancelled from. Any of
    -- the three is a legitimate prior state (TodayPage's Undo restores the
    -- exact prevStatus it captured before the cancel call).
    when 'cancelled'  then array['confirmed','checked_in','in_service']::public.appointment_status[]
    else array[]::public.appointment_status[]
  end;

  if not (p_status = any(v_allowed)) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001',
      detail = format('%s -> %s', v_current, p_status);
  end if;

  update public.appointments
     set status = p_status,
         checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end,
         completed_at  = case
           when p_status = 'completed' then now()
           when p_status = 'confirmed' and v_current = 'completed' then null
           else completed_at
         end,
         cancelled_at  = case
           when p_status = 'cancelled' then now()
           when v_current = 'cancelled' then null
           else cancelled_at
         end,
         cancellation_reason = case
           when p_status = 'cancelled' then coalesce(nullif(trim(p_reason), ''), 'Cancelled by the salon')
           when v_current = 'cancelled' then null
           else cancellation_reason
         end
   where id = p_appointment_id
  returning * into v_row;

  if v_current = 'completed' and p_status = 'confirmed' then
    update public.email_messages
       set status = 'failed',
           last_error = 'Appointment un-completed by the owner before this was sent'
     where appointment_id = p_appointment_id
       and status = 'queued'
       and template = 'review_request';
  end if;

  perform public.log_audit_event(
    'appointment.status_changed', 'appointment', p_appointment_id,
    format('Appointment %s: %s -> %s', v_row.reference, v_current, p_status),
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_status));

  return v_row;
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
    if new.starts_at - interval '1 hour' > now() then
      perform public.queue_email('reminder_1h', v_customer.email::text,
        'See you in an hour · ' || new.reference,
        new.id, v_customer.id, new.starts_at - interval '1 hour', v_payload);
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
