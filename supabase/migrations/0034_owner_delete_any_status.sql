-- Owner asked to be able to delete an appointment "regardless of its
-- completed, confirmed or whatever" — 0029's status allowlist
-- (cancelled/rejected/no_show only) was deliberately narrow as a
-- housekeeping-only tool. Loosening it to any status per that request.
--
-- The payment guard stays: a row with a logged payment is still refused
-- outright. That protects a financial record, a different concern from
-- "which booking statuses are junk", and wasn't part of what was asked to
-- change.

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

  select exists(
    select 1 from public.payments where appointment_id = p_appointment_id
  ) into v_has_payment;

  if v_has_payment then
    raise exception 'HAS_PAYMENT' using errcode = 'P0001';
  end if;

  delete from public.appointments where id = p_appointment_id;
end;
$$;
