-- =====================================================================
-- 0060_customer_communication_preferences.sql
--
-- KOKO_GAP.md P2: "Owner-side marketing-consent toggle only... no
-- customer-facing self-service preference centre." `customers.marketing_
-- consent` is the checkbox a customer ticks at booking time (BookPage.tsx)
-- and, until now, the only way to change it afterwards was to ask the
-- owner to flip it from the Customers page. This adds the customer's own
-- side: two session-scoped RPCs, following the exact pattern
-- `customer_appointments`/`customer_cancel_appointment` already use —
-- `customer_from_session()` resolves the opaque session token to a
-- customer_id or raises INVALID_SESSION, and the function only ever
-- touches that customer's own row.
--
-- Deliberately not touching `public.subscribers` (the broadcast-messaging
-- opt-in list, 0058) — that is a separate system with its own /subscribe
-- and unsubscribe-link flow, and the gap this closes is specifically the
-- marketing_consent flag named in KOKO_GAP.md's evidence column.
-- =====================================================================

create or replace function public.customer_communication_preferences(p_session_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer uuid := public.customer_from_session(p_session_token);
  v_consent  boolean;
begin
  select marketing_consent into v_consent
    from public.customers
   where id = v_customer;

  return coalesce(v_consent, false);
end;
$$;

create or replace function public.customer_set_marketing_consent(
  p_session_token text,
  p_consent       boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := public.customer_from_session(p_session_token);
begin
  if p_consent is null then
    raise exception 'INVALID_CONSENT' using errcode = 'P0001';
  end if;

  update public.customers
     set marketing_consent = p_consent,
         consent_updated_at = now()
   where id = v_customer;
end;
$$;

revoke all on function public.customer_communication_preferences(text) from public;
revoke all on function public.customer_set_marketing_consent(text, boolean) from public;
grant execute on function public.customer_communication_preferences(text) to anon, authenticated;
grant execute on function public.customer_set_marketing_consent(text, boolean) to anon, authenticated;
