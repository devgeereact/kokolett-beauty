-- =====================================================================
-- 0036_owner_custom_email.sql — a one-off email the owner (or the AI
-- assistant, on her behalf) can send to an existing customer.
--
-- No client path could send an arbitrary email before this: `queue_email()`
-- is revoked from every client role and only ever called from trigger
-- functions on the appointment lifecycle. This adds exactly one more
-- security-definer entry point, gated the same way `create_appointment_as_
-- owner()` already is — `is_owner()` — and it still only *enqueues* into
-- `email_messages`, so the existing outbox, retry and audit trail apply
-- unchanged. Nothing sends until the scheduled drain job picks the row up.
-- =====================================================================

create or replace function public.send_custom_email_as_owner(
  p_customer_email text,
  p_customer_name  text,
  p_subject        text,
  p_body           text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_email_id    uuid;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  if trim(coalesce(p_subject, '')) = '' then
    raise exception 'SUBJECT_REQUIRED' using errcode = 'P0001';
  end if;
  if trim(coalesce(p_body, '')) = '' then
    raise exception 'BODY_REQUIRED' using errcode = 'P0001';
  end if;

  -- Best-effort link to a real customer row for the outbox's own records
  -- (Communications › Email shows this). Not required — the email still
  -- sends to the address given even if nobody matches, same as any
  -- non-customer enquiry reply would.
  select id into v_customer_id
    from public.customers
   where lower(email::text) = lower(p_customer_email)
     and deleted_at is null
   limit 1;

  v_email_id := public.queue_email(
    p_template    => 'owner_custom_message',
    p_to_email    => p_customer_email,
    p_subject     => p_subject,
    p_customer_id => v_customer_id,
    p_payload     => jsonb_build_object(
      'full_name', coalesce(p_customer_name, ''),
      'custom_body', p_body
    )
  );

  return v_email_id;
end;
$$;

revoke all on function public.send_custom_email_as_owner(text, text, text, text) from public, anon;
grant execute on function public.send_custom_email_as_owner(text, text, text, text) to authenticated;
