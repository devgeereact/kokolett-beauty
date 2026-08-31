-- =====================================================================
-- 0062_customer_session_revocation.sql
--
-- KOKO_GAP.md P3: "Magic-link security (rate limit, single-use, expiry,
-- revocation) is real, but there's no bulk 'revoke all sessions for this
-- customer'." A leaked device or a customer asking "can you sign me out
-- everywhere" previously had no owner-side answer beyond waiting out the
-- 30-day session token's natural expiry.
--
-- revoke_customer_sessions() marks every one of a customer's live session
-- tokens as used -- customer_from_session() (0021) already treats
-- `used_at is not null` as invalid, so this is an immediate, real
-- revocation, not a flag nothing reads. Audited: this is exactly the kind
-- of high-risk owner action audit_events already covers (erasure, login-
-- slug change), not a routine read.
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
    'customer.data_exported',
    'broadcast.sent',
    'customer.sessions_revoked'
  ));

create or replace function public.revoke_customer_sessions(p_customer_id uuid)
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

  update public.customer_access_tokens
     set used_at = now()
   where customer_id = p_customer_id
     and purpose = 'session'
     and used_at is null
     and expires_at > now();

  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform public.log_audit_event(
      'customer.sessions_revoked',
      'customer',
      p_customer_id,
      format('Revoked %s active session(s)', v_count)
    );
  end if;

  return v_count;
end;
$$;

revoke all on function public.revoke_customer_sessions(uuid) from public, anon;
grant execute on function public.revoke_customer_sessions(uuid) to authenticated;
