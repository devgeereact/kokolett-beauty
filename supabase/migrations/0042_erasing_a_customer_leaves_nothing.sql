-- Erasing a customer now erases the customer.
--
-- `delete_customer_as_owner` (0035) removed the `customers` row and their
-- appointments and stopped there, which left their personal data sitting in
-- four other places the owner never sees from that screen:
--
--   * `subscribers`            — their address stayed on the mailing list, so an
--                                erased customer could still be marketed to.
--   * `availability_requests`  — carries `full_name`, `email` and `mobile` in
--                                its own columns; the FK was only set to null.
--   * `email_messages`         — `to_email` on every message ever sent to them,
--                                plus a `payload` holding their name and, for
--                                an access link, a live magic-link URL.
--   * `customer_access_tokens` — cascaded already, and still does.
--
-- It also refused outright when any of their appointments had a logged payment.
-- That is the wrong answer to an erasure request: it leaves the owner unable to
-- honour one at all. The rule that actually applies is that personal data goes
-- and the financial record stays, so this keeps those appointments, strips every
-- personal field from them, and anonymises the customer row in place. Either
-- way the caller gets the same promise: nothing identifying survives.

create or replace function public.erase_customer_as_owner(
  p_customer_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       citext;
  v_has_payment boolean;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select email into v_email from public.customers where id = p_customer_id;
  if v_email is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Off the mailing list first. This is the one that keeps costing the salon
  -- something if it is missed, because it is the only table here that leads to
  -- another message being sent.
  delete from public.subscribers where lower(email) = lower(v_email::text);

  -- Requests hold their own copy of the contact details, matched on address as
  -- well as on the foreign key: a request raised before they were ever linked
  -- to a customer row carries the same personal data and no `customer_id`.
  delete from public.availability_requests
   where customer_id = p_customer_id
      or lower(email) = lower(v_email::text);

  -- The outbox holds their address, their name, and for an access link a token
  -- URL that is still redeemable. Delete before the customer row goes, while
  -- the foreign key is still there to match on.
  delete from public.email_messages
   where customer_id = p_customer_id
      or lower(to_email) = lower(v_email::text);

  delete from public.customer_access_tokens where customer_id = p_customer_id;

  select exists(
    select 1
    from public.payments pay
    join public.appointments appt on appt.id = pay.appointment_id
    where appt.customer_id = p_customer_id
  ) into v_has_payment;

  if v_has_payment then
    -- Keep the money, lose the person. The appointment rows stay so the books
    -- still balance, with every free-text field they carry stripped: a customer
    -- note is whatever the customer chose to tell the salon, and an owner note
    -- is whatever the salon wrote down about them.
    update public.appointments
       set customer_note = null,
           owner_note = null,
           cancellation_reason = null,
           rejection_reason = null
     where customer_id = p_customer_id;

    -- `customers_email_key` is unique on `lower(email)` only where `deleted_at`
    -- is null, so a tombstoned row can hold any placeholder without colliding.
    update public.customers
       set full_name = 'Erased customer',
           email = ('erased+' || p_customer_id::text || '@invalid')::citext,
           mobile = null,
           notes = null,
           marketing_consent = false,
           consent_updated_at = now(),
           deleted_at = now()
     where id = p_customer_id;

    return 'anonymised';
  end if;

  delete from public.appointments where customer_id = p_customer_id;
  delete from public.customers where id = p_customer_id;

  return 'deleted';
end;
$$;

revoke all on function public.erase_customer_as_owner(uuid) from public, anon;
grant execute on function public.erase_customer_as_owner(uuid) to authenticated;

-- The old name stays as a delegate. Anything still calling it — another
-- session, a saved script — gets the complete erasure rather than the partial
-- one it used to get.
create or replace function public.delete_customer_as_owner(
  p_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.erase_customer_as_owner(p_customer_id);
end;
$$;

revoke all on function public.delete_customer_as_owner(uuid) from public, anon;
grant execute on function public.delete_customer_as_owner(uuid) to authenticated;
