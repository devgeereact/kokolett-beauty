-- =====================================================================
-- 0006_fix_crypto_search_path.sql
--
-- 0005 declared the customer-session functions with `set search_path = public`
-- and then called `digest()` and `gen_random_bytes()`. On Supabase pgcrypto is
-- installed into the `extensions` schema, so those names did not resolve and
-- every call failed with:
--
--   42883: function digest(text, unknown) does not exist
--
-- Pinning a search_path on a security-definer function is right — it is what
-- stops a caller shadowing a table with their own. The mistake was pinning it
-- too narrowly. `public, extensions` keeps the protection and resolves
-- pgcrypto wherever it is installed.
-- =====================================================================

create or replace function public.redeem_access_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash     text := encode(digest(p_token, 'sha256'), 'hex');
  v_row      public.customer_access_tokens%rowtype;
  v_customer public.customers%rowtype;
  v_session  text;
begin
  select * into v_row
    from public.customer_access_tokens
   where token_hash = v_hash
     and used_at is null
     and expires_at > now();

  if v_row.id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;

  update public.customer_access_tokens set used_at = now() where id = v_row.id;

  select * into v_customer from public.customers
   where id = v_row.customer_id and deleted_at is null;

  if v_customer.id is null then
    raise exception 'INVALID_TOKEN' using errcode = 'P0001';
  end if;

  v_session := encode(gen_random_bytes(32), 'hex');
  insert into public.customer_access_tokens (customer_id, token_hash, purpose, expires_at)
  values (v_customer.id, encode(digest(v_session, 'sha256'), 'hex'), 'manage',
          now() + interval '30 days');

  return jsonb_build_object(
    'session_token', v_session,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'full_name', v_customer.full_name,
      'email', v_customer.email::text,
      'mobile', v_customer.mobile));
end;
$$;

create or replace function public.customer_from_session(p_session_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  select t.customer_id into v_id
    from public.customer_access_tokens t
    join public.customers c on c.id = t.customer_id and c.deleted_at is null
   where t.token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
     and t.purpose = 'manage'
     and t.expires_at > now();

  if v_id is null then
    raise exception 'INVALID_SESSION' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

-- `customer_appointments` and `customer_cancel_appointment` call
-- `customer_from_session`, which now resolves pgcrypto itself. They touch no
-- crypto directly, so their own search_path stays narrow.

revoke all on function public.redeem_access_token(text) from public;
revoke all on function public.customer_from_session(text) from public, anon, authenticated;
grant execute on function public.redeem_access_token(text) to anon, authenticated;
