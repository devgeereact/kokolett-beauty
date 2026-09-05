-- =====================================================================
-- 0073_erasure_reaches_the_contact_form.sql
--
-- Two gaps in the "leave nothing behind" promise, both created by a table or
-- a column that arrived after the erasure path was written and was never
-- added to it.
--
-- 1. **Contact-form enquiries survived an erasure request.**
--    `submit_contact_message()` (0049) does not store the enquiry in a table
--    of its own. It queues an email TO THE OWNER whose `payload` carries the
--    enquirer's name, address and message body, and whose `to_email` is
--    therefore the owner's address, not theirs. `erase_customer_as_owner`
--    matched `email_messages` on `customer_id or lower(to_email)`, and a
--    contact message has neither: no `customer_id`, and a `to_email` that
--    belongs to the salon. So someone who wrote in and later asked to be
--    erased kept their name, address and words in the database until
--    `purge_expired_personal_data()` (0046) reached them two years later.
--    `0047` shipped three migrations after `0042`, which is how it was missed.
--
--    The fix matches on the payload address as well. The partial index at
--    `0049:110` is already `(lower(payload ->> 'email'), created_at desc)`
--    over exactly these rows, so the added predicate is indexed.
--
-- 2. **"Revoke all sessions" left unredeemed magic links alive.**
--    `revoke_customer_sessions()` (0062) filters on `purpose = 'session'`. A
--    `purpose = 'manage'` token that customer-access has minted and emailed
--    but nobody has clicked yet stays valid for the rest of its 30 minutes.
--    The reason to press that button is a mailbox someone else can read, and
--    the link sitting in that mailbox is the thing it does not reach.
--
-- Both are additive changes to existing functions. Nothing else moves.
-- =====================================================================

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

  delete from public.subscribers where lower(email) = lower(v_email::text);

  delete from public.availability_requests
   where customer_id = p_customer_id
      or lower(email) = lower(v_email::text);

  -- The third clause is the contact form. A `contact_message_received` row is
  -- addressed to the OWNER and carries the enquirer in its payload, so neither
  -- of the first two clauses has ever matched one.
  delete from public.email_messages
   where customer_id = p_customer_id
      or lower(to_email) = lower(v_email::text)
      or lower(payload ->> 'email') = lower(v_email::text);

  delete from public.customer_access_tokens where customer_id = p_customer_id;

  select exists(
    select 1
    from public.payments pay
    join public.appointments appt on appt.id = pay.appointment_id
    where appt.customer_id = p_customer_id
  ) into v_has_payment;

  if v_has_payment then
    update public.appointments
       set customer_note = null,
           owner_note = null,
           cancellation_reason = null,
           rejection_reason = null
     where customer_id = p_customer_id;

    update public.customers
       set full_name = 'Erased customer',
           email = ('erased+' || p_customer_id::text || '@invalid')::citext,
           mobile = null,
           notes = null,
           marketing_consent = false,
           consent_updated_at = now(),
           deleted_at = now()
     where id = p_customer_id;

    -- No email or other identifying detail logged: only that an erasure
    -- happened. The audit log must never become a second place a
    -- "deleted" customer's address still lives.
    --
    -- The wording loses 0052's em dash, which the copy gate now catches on
    -- any migration from 0065 onwards. This string is read by a person, on
    -- the Audit screen.
    perform public.log_audit_event(
      'customer.erased', 'customer', p_customer_id,
      'Customer erased. Anonymised rather than deleted, because a payment is logged against them.');

    return 'anonymised';
  end if;

  delete from public.appointments where customer_id = p_customer_id;
  delete from public.customers where id = p_customer_id;

  perform public.log_audit_event(
    'customer.erased', 'customer', p_customer_id,
    'Customer erased');

  return 'deleted';
end;
$$;

comment on function public.erase_customer_as_owner(uuid) is
  'Erases everything the salon holds about one customer: mailing list, enquiries, '
  'outbox (including contact-form messages, matched on the payload address since '
  '0073), access tokens, appointment free text, and the customer row itself. '
  'Anonymises rather than deletes when a payment is logged, because a financial '
  'record may not be destroyed. Logs that an erasure happened and nothing about who.';

-- ---------------------------------------------------------------------
-- Revocation now reaches an unredeemed magic link, not only live sessions.
-- ---------------------------------------------------------------------
create or replace function public.revoke_customer_sessions(
  p_customer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Both purposes, not just 'session'. A 'manage' token is a magic link that
  -- has been emailed and not yet clicked; leaving it alive means the mailbox
  -- that prompted the revocation still holds a working way in. Everything
  -- else about this function is 0062's, including the `expires_at > now()`
  -- filter and logging only when something was actually revoked.
  update public.customer_access_tokens
     set used_at = now()
   where customer_id = p_customer_id
     and purpose in ('session', 'manage')
     and used_at is null
     and expires_at > now();

  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform public.log_audit_event(
      'customer.sessions_revoked',
      'customer',
      p_customer_id,
      format('Revoked %s active session(s) or unused sign-in link(s)', v_count)
    );
  end if;

  return v_count;
end;
$$;

revoke all on function public.revoke_customer_sessions(uuid) from public, anon;
grant execute on function public.revoke_customer_sessions(uuid) to authenticated;

comment on function public.revoke_customer_sessions(uuid) is
  'Marks every unused customer access token spent, both live 30-day sessions and '
  'unredeemed 30-minute magic links (the latter added 0073). Returns how many.';
