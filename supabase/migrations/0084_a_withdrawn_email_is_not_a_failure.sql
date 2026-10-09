-- Four retirements that still called themselves failures.
--
-- 0040 added `cancelled` to `email_status` and 0041 taught the main retirement
-- path to use it, for the reason 0040's header sets out: pulling a queued
-- reminder because the reason to send it stopped existing is the system
-- working, and counting it as a delivery failure trains the owner to ignore
-- the one number on the Email screen that should mean something.
--
-- Four statements never got the message, and three of them arrived after 0041:
--
--   reschedule_appointment_as_owner  (0024/0026)  two statements
--   notify_appointment_status_changed (0063, the un-cancel path)
--   set_appointment_status            (0028, the un-complete path)
--
-- Measured on the live outbox before this migration: 12 rows sat at `failed`,
-- of which 8 were "Rescheduled by the salon" and only 4 were real SMTP 550
-- bounces. Daily Close reads `status in ('failed','bounced')`, so it showed a
-- red "Failed emails 12" for four actual failures. Christy had no way to tell
-- them apart.
--
-- Two things this migration deliberately does not do:
--
--   It does not add a column for the reason. `last_error` is the outbox's one
--   free-text "what became of this" field, and a second, mutually exclusive
--   column for the same concept would be worse shaped than a single field the
--   UI labels by status. EmailPage names it "Why it was not sent" on a
--   withdrawn row and "Last error" on a failed one.
--
--   It does not touch the enum. `cancelled` has existed since 0040 and
--   EmailStatusBadge has rendered it as "Withdrawn", in a neutral tone, ever
--   since. Only the writers were wrong.
--
-- Every function below is byte-identical to the live definition except for the
-- statements named above, so nothing 0063, 0074, 0083 or 0028 established is
-- rolled back by re-creating them here. `create or replace` keeps the existing
-- grants, which migrations do not re-issue.

-- ---------------------------------------------------------------------------
-- 1. The un-cancel path, plus a reason on the main retirement.
-- ---------------------------------------------------------------------------

create or replace function public.notify_appointment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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
    -- outbox drains every 5 minutes; Undo is an 8-second window), so pull it
    -- before it does. Re-queue the reminders the cancellation retired,
    -- exactly the same way a fresh approval schedules them: if the
    -- appointment is now too close for one to make sense, the same interval
    -- guard that already protects the approval path skips it here too.
    --
    -- `cancelled`, not `failed`. Nothing went wrong here. The owner pressed
    -- Undo inside eight seconds and the notice she had just triggered stopped
    -- being true.
    update public.email_messages
       set status = 'cancelled',
           last_error = 'The appointment was un-cancelled before this was sent'
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
    -- Already `cancelled` since 0041. What changes here is that the row now
    -- says why: a blank reason left the owner looking at a withdrawn message
    -- with no account of what withdrew it.
    update public.email_messages
       set status = 'cancelled',
           last_error = case new.status
             when 'cancelled'   then 'The appointment was cancelled before this was sent'
             when 'rejected'    then 'The booking request was declined before this was sent'
             when 'no_show'     then 'The appointment was marked a no-show before this was sent'
             when 'rescheduled' then 'The appointment was moved before this was sent'
           end
     where appointment_id = new.id
       and status = 'queued'
       and template = any (public.retired_booking_templates());
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. The un-complete path.
-- ---------------------------------------------------------------------------

create or replace function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $function$
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
    when 'pending_approval' then array['confirmed','rejected','cancelled']::public.appointment_status[]
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

  -- The exclusion constraint can fire here, and only here: a cancelled row is
  -- outside `appointments_no_overlap` and re-enters it on the way back to an
  -- active status. See 0003's header.
  begin
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
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  if v_current = 'completed' and p_status = 'confirmed' then
    -- `cancelled`, not `failed`. Un-completing an appointment withdraws the
    -- review request that completing it queued; the send never got the chance
    -- to go wrong.
    update public.email_messages
       set status = 'cancelled',
           last_error = 'The appointment was un-completed before this was sent'
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. The two reschedule retirements, and the eight rows they left behind.
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_appointment_as_owner(
  p_appointment_id uuid,
  p_new_starts_at timestamptz
)
returns table(appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_old        public.appointments%rowtype;
  v_settings   public.booking_settings%rowtype;
  v_local_date date;
  v_local_time time;
  v_ref        text;
  v_id         uuid;
  v_deadline   timestamptz;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;

  select * into v_old from public.appointments where id = p_appointment_id for update;
  if v_old.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_old.status not in ('pending_approval', 'confirmed') then
    raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001';
  end if;
  if v_old.starts_at < now() then
    raise exception 'ALREADY_PASSED' using errcode = 'P0001';
  end if;
  if p_new_starts_at < now() then
    raise exception 'ALREADY_PASSED' using errcode = 'P0001';
  end if;
  if p_new_starts_at = v_old.starts_at then
    raise exception 'SAME_TIME' using errcode = 'P0001';
  end if;

  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_new_starts_at at time zone v_settings.timezone)::time;

  insert into public.availability_slots (on_date, starts_at)
  values (v_local_date, v_local_time)
  on conflict (on_date, starts_at) do nothing;

  if v_old.status = 'pending_approval' then
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_new_starts_at);
  else
    v_deadline := null;
  end if;

  v_ref := public.generate_booking_reference();

  update public.appointments
     set status = 'rescheduled',
         cancellation_reason = 'Moved by the salon'
   where id = p_appointment_id;

  -- `cancelled`, not `failed`: the owner moved the booking, so the notice
  -- about the old time stopped being true before it went out. Eight rows in
  -- the live outbox were sitting at `failed` for exactly this, which is two
  -- thirds of everything Daily Close was counting as a delivery failure.
  update public.email_messages
     set status = 'cancelled', last_error = 'The appointment was moved before this was sent'
   where email_messages.appointment_id = p_appointment_id
     and status = 'queued'
     and template = 'owner_booking_moved';

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, owner_note, source, status, requires_approval,
       approval_deadline, approved_at, approved_by, rescheduled_from)
    values
      (v_ref, v_old.customer_id, v_old.service_id, p_new_starts_at,
       p_new_starts_at + (v_old.ends_at - v_old.starts_at),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, v_old.approved_by, p_appointment_id)
    returning id into v_id;
  exception when exclusion_violation then
    update public.appointments
       set status = v_old.status, cancellation_reason = v_old.cancellation_reason
     where id = p_appointment_id;
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  -- The new row's own "you have a new booking" notices, withdrawn for the
  -- same reason: this is a move the owner made by hand, not a booking she
  -- needs telling about.
  update public.email_messages
     set status = 'cancelled', last_error = 'The appointment was moved before this was sent'
   where email_messages.appointment_id = v_id
     and status = 'queued'
     and template in ('owner_new_booking', 'owner_approval_needed');

  -- entity_id is the NEW row's id (the one that exists going forward and
  -- is worth clicking through to). The OLD id/time are preserved in
  -- old_value instead, since the old row itself is now just a retired
  -- 'rescheduled' husk.
  perform public.log_audit_event(
    'appointment.rescheduled', 'appointment', v_id,
    format('Appointment %s rescheduled from %s to %s', v_ref, v_old.starts_at, p_new_starts_at),
    jsonb_build_object('appointment_id', v_old.id, 'starts_at', v_old.starts_at),
    jsonb_build_object('appointment_id', v_id, 'starts_at', p_new_starts_at));

  return query select v_id, v_ref;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Backfill.
-- ---------------------------------------------------------------------------
--
-- Matched on the exact strings the three functions above wrote, and on nothing
-- else. A real SMTP refusal is a 550 from the mail server and shares no wording
-- with any of these, so it cannot be swept up by accident. Anything unrecognised
-- is left at `failed` on purpose: a status this screen exists to make
-- trustworthy is not the place to guess.

update public.email_messages
   set status = 'cancelled',
       last_error = 'The appointment was moved before this was sent'
 where status = 'failed'
   and last_error = 'Rescheduled by the salon';

update public.email_messages
   set status = 'cancelled',
       last_error = 'The appointment was un-cancelled before this was sent'
 where status = 'failed'
   and last_error = 'Appointment un-cancelled by the owner before this was sent';

update public.email_messages
   set status = 'cancelled',
       last_error = 'The appointment was un-completed before this was sent'
 where status = 'failed'
   and last_error = 'Appointment un-completed by the owner before this was sent';

update public.email_messages
   set status = 'cancelled',
       last_error = 'The appointment was cancelled, declined or moved before this was sent'
 where status = 'failed'
   and last_error like 'Appointment % before send';
