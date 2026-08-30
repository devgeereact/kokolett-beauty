-- =====================================================================
-- 0056_customer_data_export.sql
--
-- The GDPR subject-access counterpart to erase_customer_as_owner (0042):
-- same table list, read instead of deleted. Owner-triggered, per
-- customer, no new table.
--
-- The audit row records THAT an export happened, never a copy of the
-- exported data — audit_events must not become a second store of the
-- personal data an export or erasure is about, same care as
-- erase_customer_as_owner logging no email.
-- =====================================================================

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'appointment.created',
    'appointment.status_changed',
    'appointment.rescheduled',
    'appointment.deleted',
    'customer.erased',
    'payment.recorded',
    'settings.login_slug_changed',
    'day.closed',
    'customer.data_exported'
  ));

create or replace function public.export_customer_data(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer jsonb;
  v_appointments jsonb;
  v_payments jsonb;
  v_emails jsonb;
  v_requests jsonb;
  v_subscriber jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select to_jsonb(c) - 'id' into v_customer
  from (
    select full_name, email, mobile, notes, marketing_consent, consent_updated_at,
           first_seen_at, last_seen_at, created_at
    from public.customers where id = p_customer_id
  ) c;

  if v_customer is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.starts_at), '[]'::jsonb) into v_appointments
  from (
    select reference, starts_at, ends_at, status, customer_note, owner_note,
           cancellation_reason, rejection_reason, created_at
    from public.appointments where customer_id = p_customer_id
  ) a;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at), '[]'::jsonb) into v_payments
  from (
    select pay.amount_pence, pay.note, pay.created_at
    from public.payments pay
    join public.appointments appt on appt.id = pay.appointment_id
    where appt.customer_id = p_customer_id
  ) p;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb) into v_emails
  from (
    select subject, template, status, created_at, sent_at
    from public.email_messages where customer_id = p_customer_id
  ) e;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) into v_requests
  from (
    select preferred_dates, preferred_times, flexibility, notes, status, created_at
    from public.availability_requests where customer_id = p_customer_id
  ) r;

  select to_jsonb(s) into v_subscriber
  from (
    select email, source, confirmed, unsubscribed_at, created_at
    from public.subscribers
    where lower(email) = lower((select email::text from public.customers where id = p_customer_id))
    limit 1
  ) s;

  perform public.log_audit_event(
    'customer.data_exported', 'customer', p_customer_id,
    'Customer data exported',
    null, jsonb_build_object('exported_at', now()));

  return jsonb_build_object(
    'exported_at', now(),
    'customer', v_customer,
    'appointments', v_appointments,
    'payments', v_payments,
    'emails', v_emails,
    'availability_requests', v_requests,
    'mailing_list', v_subscriber
  );
end;
$$;

revoke all on function public.export_customer_data(uuid) from public, anon;
grant execute on function public.export_customer_data(uuid) to authenticated;
