-- =====================================================================
-- 0007_availability_is_the_gate.sql
--
-- A change of booking policy, decided by the owner on 2026-08-07.
--
-- Before: availability was generous and *trust* was the gate — first-time
-- customers were held for approval, returning ones confirmed instantly.
--
-- After: **availability is the gate.** The owner publishes exactly the hours
-- she is willing to work, and anything inside them books instantly for anyone.
-- When nothing is open, the customer asks, and it is the *request* that gets
-- approved — which is what makes a last-minute cancellation reachable.
--
-- Consequences, in order of how much they matter:
--
--   1. `approve_first_time` goes off. The hybrid machinery stays in the schema
--      because it costs nothing and is a genuine fallback, but it is not the
--      operating model any more.
--   2. Publishing hours per date becomes the owner's main daily act, so it
--      gets a proper function instead of hand-assembled exception rows.
--   3. Requests are answered first come, first served. Being second in the
--      queue and served first is exactly the unfairness the owner wants to
--      avoid, so the order is enforced here rather than left to the UI.
-- =====================================================================

update public.booking_settings set approve_first_time = false where id;

comment on column public.booking_settings.approve_first_time is
  'Off since 0007. Availability is the gate: published hours book instantly. Turning this back on restores the first-time approval hold.';

-- ---------- Publishing a day's hours ----------------------------------
-- Replaces whatever governs one date:
--   p_windows = null  → clear overrides, fall back to the standing weekly hours
--   p_windows = '[]'  → closed all day
--   p_windows = [{"starts_at":"09:00","ends_at":"13:00"}, …]
--                     → exactly these hours, standing rules ignored
--
-- The "exactly these hours" case is expressed as a whole-day closure plus
-- extra_hours windows, which is what available_slots() already understands: a
-- whole-day closure suppresses the weekday rule, and extra_hours are added back
-- independently of it.
--
-- Breaks are left alone. They are a separate act — "I am out between 12 and 1"
-- survives a change to the day's opening hours.
create or replace function public.set_day_availability(
  p_date    date,
  p_windows jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window jsonb;
  v_starts time;
  v_ends   time;
  v_count  integer := 0;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  -- Clear only what this function owns.
  delete from public.availability_exceptions
   where on_date = p_date
     and (kind = 'extra_hours' or (kind = 'closure' and starts_at is null));

  if p_windows is null then
    return jsonb_build_object('mode', 'standard', 'windows', 0);
  end if;

  if jsonb_typeof(p_windows) <> 'array' then
    raise exception 'INVALID_WINDOWS' using errcode = 'P0001';
  end if;

  -- Closed, or open only for what follows.
  insert into public.availability_exceptions (kind, on_date, starts_at, ends_at, reason)
  values ('closure', p_date, null, null,
          case when jsonb_array_length(p_windows) = 0 then 'Closed' else 'Custom hours' end);

  for v_window in select * from jsonb_array_elements(p_windows) loop
    v_starts := (v_window ->> 'starts_at')::time;
    v_ends   := (v_window ->> 'ends_at')::time;

    if v_starts is null or v_ends is null or v_ends <= v_starts then
      raise exception 'INVALID_WINDOW' using errcode = 'P0001',
        detail = coalesce(v_window::text, 'null');
    end if;

    insert into public.availability_exceptions (kind, on_date, starts_at, ends_at, reason)
    values ('extra_hours', p_date, v_starts, v_ends, 'Published hours');
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'mode', case when v_count = 0 then 'closed' else 'custom' end,
    'windows', v_count);
end;
$$;

revoke all on function public.set_day_availability(date, jsonb) from public, anon;
grant execute on function public.set_day_availability(date, jsonb) to authenticated;

-- ---------- The request queue ------------------------------------------
-- Requests waiting on an answer, oldest first, each carrying its position.
-- The position is the transparency promise made concrete: it is computed from
-- `created_at` and cannot be reordered from the interface.
create or replace function public.open_requests_in_order()
returns table (
  -- `position` is reserved in Postgres, hence the prefix.
  id uuid, queue_position integer, full_name text, email text, mobile text,
  service_id uuid, service_name text, preferred_dates date[], preferred_times text,
  flexibility text, notes text, status public.availability_request_status,
  owner_response text, created_at timestamptz, waiting_hours numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  return query
    select r.id,
           row_number() over (order by r.created_at)::integer,
           r.full_name, r.email, r.mobile, r.service_id, s.name,
           r.preferred_dates, r.preferred_times, r.flexibility, r.notes,
           r.status, r.owner_response, r.created_at,
           round(extract(epoch from (now() - r.created_at)) / 3600.0, 1)
      from public.availability_requests r
      left join public.services s on s.id = r.service_id
     where r.status in ('new', 'awaiting_response')
     order by r.created_at;
end;
$$;

revoke all on function public.open_requests_in_order() from public, anon;
grant execute on function public.open_requests_in_order() to authenticated;

-- ---------- Turning a request into a booking ---------------------------
-- The owner offers a freed slot to somebody who asked for one.
--
-- First come, first served is enforced, not merely displayed: if an older open
-- request could also have taken this date, the call is refused and names who is
-- ahead. `p_override_reason` is the deliberate escape hatch — skipping is
-- sometimes right (a different service, an impossible time), but it should cost
-- a sentence and leave a record.
--
-- "Could also have taken this date" means: asked for this date, or expressed no
-- date preference at all. Someone who asked for a specific Tuesday is not
-- ahead of you for a Friday slot.
create or replace function public.offer_slot_to_request(
  p_request_id      uuid,
  p_service_id      uuid,
  p_starts_at       timestamptz,
  p_override_reason text default null
)
returns table (appointment_id uuid, reference text)
language plpgsql
security definer
set search_path = public
as $$
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
  select * into v_request from public.availability_requests where id = p_request_id;

  if v_request.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_request.status not in ('new', 'awaiting_response', 'offer_sent') then
    raise exception 'REQUEST_CLOSED' using errcode = 'P0001';
  end if;

  select * into v_service from public.services
   where id = p_service_id and archived_at is null;
  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_date := (p_starts_at at time zone v_settings.timezone)::date;

  if p_override_reason is null or trim(p_override_reason) = '' then
    select string_agg(earlier.full_name || ' (' ||
                      to_char(earlier.created_at, 'DD Mon HH24:MI') || ')', ', '
                      order by earlier.created_at)
      into v_ahead
      from public.availability_requests earlier
     where earlier.status in ('new', 'awaiting_response')
       and earlier.created_at < v_request.created_at
       and (
         cardinality(earlier.preferred_dates) = 0
         or v_date = any(earlier.preferred_dates)
       );

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
         owner_response = coalesce(
           nullif(trim(p_override_reason), ''),
           'Offered a slot and booked in')
   where id = p_request_id;

  return query select v_id, v_ref;
end;
$$;

revoke all on function public.offer_slot_to_request(uuid, uuid, timestamptz, text)
  from public, anon;
grant execute on function public.offer_slot_to_request(uuid, uuid, timestamptz, text)
  to authenticated;

-- ---------- Declining a request ----------------------------------------
create or replace function public.decline_request(
  p_request_id uuid,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_request public.availability_requests%rowtype;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  update public.availability_requests
     set status = 'declined',
         responded_at = now(),
         owner_response = coalesce(nullif(trim(p_reason), ''),
                                   'We could not find a time on this occasion')
   where id = p_request_id
     and status in ('new', 'awaiting_response', 'offer_sent')
  returning * into v_request;

  if v_request.id is null then
    raise exception 'REQUEST_CLOSED' using errcode = 'P0001';
  end if;

  perform public.queue_email(
    'request_declined', v_request.email,
    'About your enquiry',
    null, v_request.customer_id, null,
    jsonb_build_object('full_name', v_request.full_name,
                       'reason', v_request.owner_response));
end;
$$;

revoke all on function public.decline_request(uuid, text) from public, anon;
grant execute on function public.decline_request(uuid, text) to authenticated;
