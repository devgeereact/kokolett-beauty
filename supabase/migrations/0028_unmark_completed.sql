-- Marking an appointment complete is sometimes a mis-tap, and the owner
-- needs a way back. `set_appointment_status`'s transition table (migration
-- 0003) gave 'completed' no outgoing edges at all, same as every other
-- terminal status. This adds exactly one: completed -> confirmed, clearing
-- completed_at so it stops counting as done.
--
-- No other terminal status (cancelled, no_show) gets this — those weren't
-- asked for, and carry different implications (a cancelled slot may already
-- be re-offered to someone else).
--
-- notify_appointment_status_changed (0016) only queues its 'confirmed' email
-- when old.status = 'pending_approval', so this transition queues nothing —
-- a silent revert, not a second "you're confirmed" email to the customer.
-- It does need its own cleanup the shared trigger doesn't do: marking
-- complete may have queued a review_request email for ~2h later, which
-- un-completing should retract, the same "retire an unwanted queued email"
-- pattern reschedule_appointment_as_owner (0024) already uses.

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
         cancelled_at  = case when p_status = 'cancelled' then now() else cancelled_at end,
         cancellation_reason = case
           when p_status = 'cancelled' then coalesce(nullif(trim(p_reason), ''), 'Cancelled by the salon')
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

  return v_row;
end;
$$;
