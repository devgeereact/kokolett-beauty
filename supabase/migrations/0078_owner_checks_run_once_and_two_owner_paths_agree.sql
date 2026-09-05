-- =====================================================================
-- 0078_owner_checks_run_once_and_two_owner_paths_agree.sql
--
-- Three items from the 2026-09-05 audit's P2/P3 tail
-- (docs/KOKO_GAP.md §11), none of which changes what anyone is allowed to
-- do. The first is cost, the other two are two owner-side write paths that
-- did not do what their siblings do.
--
-- 1. **Twenty-two RLS policies called `is_owner()` once per row.**
--    `is_owner()` is `language sql stable security definer`, and Postgres
--    never inlines a SECURITY DEFINER function, so `using (public.is_owner())`
--    is a real function call for every row scanned: on `appointments`,
--    `customers`, `email_messages`, `payments`, `audit_events` and seventeen
--    others. Wrapping it in a scalar subquery makes it an InitPlan, evaluated
--    once per query. Semantically identical, which is why this is safe to do
--    in bulk.
--
--    `0070` already did exactly this for the four `profiles`/`app_settings`
--    policies, because those are the four Supabase's `auth_rls_initplan` lint
--    reports: that lint matches direct `auth.*()` references in a policy
--    expression, and these twenty-two call `auth.uid()` indirectly through
--    `is_owner()`, so the advisor never saw them. `docs/SCHEMA.md` §28 records
--    "the measurable win today is nothing", which was true of the two one-row
--    tables `0070` touched and is not true of `appointments`.
--
-- 2. **`offer_slot_to_request()` created a booking at a time the owner's own
--    day panel could not show.** Its sibling `reschedule_appointment_as_owner`
--    publishes the destination time into `availability_slots` before writing
--    the appointment (`0052`). This one did not. `owner_day_slots()` reads
--    only `availability_slots`, so offering a waiting customer a time that was
--    not already published produced a real, confirmed, calendar-blocking
--    booking that the day panel showed nothing at. The customer arrives; the
--    screen says the hour is free. Same failure `0012` was written to prevent,
--    reachable through a different door.
--
-- 3. **`customer_reschedule_appointment()` ignored the daily cap.**
--    `book_appointment` takes `pg_advisory_xact_lock` on the local date and
--    re-checks `max_appointments_per_day` before inserting, and `0022`
--    explains at length why. The customer reschedule path is the other write
--    granted to `anon`; it validates alignment, lead time, horizon and slot
--    existence, and never counts the day. A customer booked for Friday could
--    move onto a Saturday already at its cap, pushing it over, after which
--    `available_slots` correctly reports the day as full to everyone else.
--
--    The appointment being moved is excluded from the count, since it is
--    being vacated. Owner-side paths still skip the cap deliberately: an owner
--    overriding her own limit is a decision, not an accident.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. One owner check per query, not per row.
-- ---------------------------------------------------------------------
alter policy appointments_owner_all on public.appointments
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy availability_requests_owner_all on public.availability_requests
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy availability_slots_owner_all on public.availability_slots
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy booking_settings_owner_all on public.booking_settings
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy calendar_feeds_owner_all on public.calendar_feeds
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy customer_access_tokens_owner_all on public.customer_access_tokens
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy customers_owner_all on public.customers
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy day_decided_owner_all on public.day_decided
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy email_messages_owner_all on public.email_messages
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy email_templates_owner_all on public.email_templates
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy google_place_owner_all on public.google_place_snapshot
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy google_reviews_owner_all on public.google_reviews
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy payments_owner_all on public.payments
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy service_categories_owner_all on public.service_categories
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy service_menu_owner_all on public.service_menu
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy services_owner_all on public.services
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy staff_owner_all on public.staff
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy subscribers_owner_all on public.subscribers
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy weekly_template_owner_all on public.weekly_template
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

alter policy audit_events_owner_read on public.audit_events
  using ((select public.is_owner()));

alter policy email_template_revisions_owner_select on public.email_template_revisions
  using ((select public.is_owner()));

alter policy product_events_owner_select on public.product_events
  using ((select public.is_owner()));

-- ---------------------------------------------------------------------
-- 2. Offering a slot publishes it, so the owner's day panel shows the booking.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.offer_slot_to_request(p_request_id uuid, p_starts_at timestamp with time zone, p_override_reason text DEFAULT NULL::text)
 RETURNS TABLE(appointment_id uuid, reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_request  public.availability_requests%rowtype;
  v_service  public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_date     date;
  v_ahead    text;
  v_customer uuid;
  v_ref      text;
  v_id       uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select * into v_settings from public.booking_settings where id;
  select * into v_service from public.hair_appointment();
  select * into v_request from public.availability_requests where id = p_request_id;

  if v_request.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_request.status not in ('new', 'awaiting_response', 'offer_sent') then
    raise exception 'REQUEST_CLOSED' using errcode = 'P0001';
  end if;

  v_date := (p_starts_at at time zone v_settings.timezone)::date;

  -- First come, first served, enforced rather than displayed.
  if p_override_reason is null or trim(p_override_reason) = '' then
    select string_agg(earlier.full_name || ' (' ||
                      to_char(earlier.created_at, 'DD Mon HH24:MI') || ')', ', '
                      order by earlier.created_at)
      into v_ahead
      from public.availability_requests earlier
     where earlier.status in ('new', 'awaiting_response')
       and earlier.created_at < v_request.created_at
       and (cardinality(earlier.preferred_dates) = 0 or v_date = any(earlier.preferred_dates));

    if v_ahead is not null then
      raise exception 'EARLIER_REQUEST_WAITING' using errcode = 'P0001', detail = v_ahead;
    end if;
  end if;

  insert into public.customers (email, full_name, mobile, last_seen_at)
  values (v_request.email, v_request.full_name, v_request.mobile, now())
  on conflict (lower(email::text)) where deleted_at is null
  do update set
    full_name    = excluded.full_name,
    mobile       = coalesce(excluded.mobile, public.customers.mobile),
    last_seen_at = now()
  returning id into v_customer;

  -- Publish the destination time before booking into it, exactly as
  -- reschedule_appointment_as_owner does (0052). owner_day_slots() reads only
  -- availability_slots, so without this the appointment exists and blocks the
  -- hour while the owner's day panel shows nothing there at all.
  insert into public.availability_slots (on_date, starts_at)
  values (v_date, (p_starts_at at time zone v_settings.timezone)::time)
  on conflict (on_date, starts_at) do nothing;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approved_at, approved_by)
    values
      (v_ref, v_customer, v_service.id, p_starts_at,
       p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min),
       v_service.price_pence, v_request.notes, 'availability_request', 'confirmed',
       false, now(), auth.uid())
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  update public.availability_requests
     set status = 'converted',
         converted_appointment_id = v_id,
         customer_id = v_customer,
         responded_at = now(),
         owner_response = coalesce(nullif(trim(p_override_reason), ''),
                                   'Offered a slot and booked in')
   where id = p_request_id;

  return query select v_id, v_ref;
end;
$function$
;

-- ---------------------------------------------------------------------
-- 3. A customer reschedule respects the daily cap.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_reschedule_appointment(p_session_token text, p_appointment_id uuid, p_new_starts_at timestamp with time zone)
 RETURNS TABLE(appointment_id uuid, reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_customer   uuid := public.customer_from_session(p_session_token);
  v_old        public.appointments%rowtype;
  v_settings   public.booking_settings%rowtype;
  v_local_date date;
  v_local_time time;
  v_late       boolean;
  v_ref        text;
  v_id         uuid;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;

  select * into v_old from public.appointments
   where id = p_appointment_id and customer_id = v_customer
   for update;

  if v_old.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only a booking that is still going to happen can be moved. A completed or
  -- cancelled one is history, and rescheduling history is a different idea.
  if v_old.status not in ('pending_approval', 'confirmed') then
    raise exception 'NOT_RESCHEDULABLE' using errcode = 'P0001';
  end if;
  if v_old.starts_at < now() then
    raise exception 'ALREADY_PASSED' using errcode = 'P0001';
  end if;
  if p_new_starts_at = v_old.starts_at then
    raise exception 'SAME_TIME' using errcode = 'P0001';
  end if;

  v_local_date := (p_new_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_new_starts_at at time zone v_settings.timezone)::time;

  -- The new time faces exactly the checks a fresh booking would, including the
  -- same salon-clock alignment rule.
  if (extract(hour from v_local_time) * 60 + extract(minute from v_local_time))::integer
       % v_settings.slot_granularity_min <> 0
     or extract(second from v_local_time) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;
  if p_new_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;
  if p_new_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.availability_slots sl
     where sl.on_date = v_local_date and sl.starts_at = v_local_time
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  -- The daily cap, which this path had never checked. Serialised on the local
  -- date exactly as book_appointment does (0039), so two customers moving onto
  -- the same day at the same moment cannot both slip past a cap of one. The
  -- appointment being moved is excluded: it is being vacated, so counting it
  -- would refuse a move within the same day.
  perform pg_advisory_xact_lock(hashtext('book_day:' || v_local_date::text)::bigint);

  if (
    select count(*) from public.appointments a
     where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
       and a.id <> p_appointment_id
       and (a.starts_at at time zone v_settings.timezone)::date = v_local_date
  ) >= v_settings.max_appointments_per_day then
    raise exception 'DAILY_CAPACITY_REACHED' using errcode = 'P0001';
  end if;

  -- Moving inside the cancellation window is allowed but recorded. Refusing it
  -- just turns into a no-show, which costs the salon the slot anyway.
  v_late := v_old.starts_at < now() + make_interval(hours => v_settings.cancellation_window_h);

  -- A still-pending booking gets a deadline measured from the move, against the
  -- time it was actually moved to. Copying the old one forward handed the new
  -- booking a deadline belonging to the old date, often already past, which the
  -- hourly expiry sweep would then act on.
  if v_old.status = 'pending_approval' then
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_new_starts_at);
  else
    v_deadline := null;
  end if;

  v_ref := public.generate_booking_reference();

  -- Retire the old one first. It has to stop occupying the calendar before the
  -- new row is inserted, or moving to an adjacent time would collide with
  -- itself through the overlap constraint.
  update public.appointments
     set status = 'rescheduled',
         cancellation_reason = case
           when v_late then 'Moved by the customer (inside the cancellation window)'
           else 'Moved by the customer'
         end
   where id = p_appointment_id;

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, owner_note, source, status, requires_approval,
       approval_deadline, approved_at, approved_by, rescheduled_from)
    values
      (v_ref, v_customer, v_old.service_id, p_new_starts_at,
       p_new_starts_at + (v_old.ends_at - v_old.starts_at),
       v_old.price_pence, v_old.customer_note, v_old.owner_note, v_old.source,
       v_old.status, v_old.requires_approval, v_deadline,
       v_old.approved_at, v_old.approved_by, p_appointment_id)
    returning id into v_id;
  exception when exclusion_violation then
    -- Somebody took the new time in the meantime. Put the old booking back —
    -- losing an appointment because a reschedule half-failed would be far
    -- worse than the move simply not happening.
    update public.appointments
       set status = v_old.status, cancellation_reason = v_old.cancellation_reason
     where id = p_appointment_id;
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref;
end;
$function$
;
