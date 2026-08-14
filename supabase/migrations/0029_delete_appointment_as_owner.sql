-- A genuine hard delete, not a status change — kept deliberately narrow.
-- Only 'cancelled' / 'rejected' / 'no_show' rows qualify: this is a
-- housekeeping tool for clearing out junk/duplicate entries, not a way to
-- erase a live booking (still Cancel for that) or a completed one (that's
-- real revenue/attendance history). Rows with a logged payment are refused
-- outright, the same protective instinct as `payments.appointment_id`
-- being `on delete restrict` — a paid appointment is a financial record.
--
-- Everything referencing this row already degrades safely: `email_messages`
-- and `availability_requests.converted_appointment_id` are `on delete set
-- null` (migration 0002/0005), and `rescheduled_from` self-references the
-- same way, so history in those tables survives with the link cleared
-- rather than being deleted itself.

create or replace function public.delete_appointment_as_owner(
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status      public.appointment_status;
  v_has_payment boolean;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select status into v_status from public.appointments where id = p_appointment_id;
  if v_status is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status not in ('cancelled', 'rejected', 'no_show') then
    raise exception 'NOT_DELETABLE' using errcode = 'P0001',
      detail = format('status is %s', v_status);
  end if;

  select exists(
    select 1 from public.payments where appointment_id = p_appointment_id
  ) into v_has_payment;

  if v_has_payment then
    raise exception 'HAS_PAYMENT' using errcode = 'P0001';
  end if;

  delete from public.appointments where id = p_appointment_id;
end;
$$;

revoke all on function public.delete_appointment_as_owner(uuid) from public, anon;
grant execute on function public.delete_appointment_as_owner(uuid) to authenticated;
