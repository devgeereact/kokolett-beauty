-- A genuine hard delete for a customer's profile — `soft_delete` (the
-- existing "Erase details" GDPR path, still the right tool when the
-- customer has real appointment history worth keeping for accounting) only
-- ever anonymised the row in place; the row itself, and every appointment
-- attached to it, stayed in the database. This instead removes it outright.
--
-- `appointments.customer_id` is `on delete restrict` (0002), so a bare
-- `delete from customers` fails while any of their appointments exist.
-- Rather than change that constraint (it protects every other caller too),
-- this deletes the customer's own appointments first — reusing the same
-- payment guard as `delete_appointment_as_owner` (0029/0034): if any of
-- their appointments has a logged payment, the whole delete is refused, so
-- a hard delete can never silently erase billing history. Everything else
-- referencing the customer already degrades safely on its own
-- (`availability_requests.customer_id`, `email_messages.customer_id`
-- `on delete set null`; `customer_access_tokens.customer_id`
-- `on delete cascade`).

create or replace function public.delete_customer_as_owner(
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists      boolean;
  v_has_payment boolean;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select exists(
    select 1 from public.customers where id = p_customer_id
  ) into v_exists;
  if not v_exists then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists(
    select 1
    from public.payments pay
    join public.appointments appt on appt.id = pay.appointment_id
    where appt.customer_id = p_customer_id
  ) into v_has_payment;

  if v_has_payment then
    raise exception 'HAS_PAYMENT' using errcode = 'P0001';
  end if;

  delete from public.appointments where customer_id = p_customer_id;
  delete from public.customers where id = p_customer_id;
end;
$$;

revoke all on function public.delete_customer_as_owner(uuid) from public, anon;
grant execute on function public.delete_customer_as_owner(uuid) to authenticated;
