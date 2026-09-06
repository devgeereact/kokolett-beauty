-- =====================================================================
-- 0082_the_consent_trigger_is_not_client_callable.sql
--
-- `sync_marketing_consent_to_subscribers()` (0081) shipped without a revoke,
-- so it carried Postgres's default EXECUTE grant to PUBLIC and was reachable
-- by anon and authenticated. The pgTAP suite catches this
-- ("no trigger function is executable by anon or authenticated",
-- supabase/tests/rls_test.sql) and 0069 already had to do this same sweep for
-- the eight trigger functions that existed then. A ninth was added and the
-- rule was not applied to it.
--
-- Postgres refuses to run a trigger function outside a trigger context, so
-- this is closing a grant rather than an exploit. That is exactly why 0069
-- did it defensively: the grant is the thing that lasts, and the next edit to
-- a `security definer` trigger function is the one that turns an unreachable
-- grant into a writer into somebody else's table.
--
-- Revoking from `public` alone is not enough and never was — see 0069's
-- header. `public` does not touch an explicit grant held by anon or
-- authenticated, so both are named.
-- =====================================================================

revoke all on function public.sync_marketing_consent_to_subscribers()
  from public, anon, authenticated;
