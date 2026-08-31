-- No client role should be able to EXECUTE a trigger function.
--
-- Supabase's security advisor flags `log_email_template_revision` as executable
-- by `anon` and `authenticated`. It is the only one of the eight trigger
-- functions in this schema with any client grant; the other seven have none.
--
-- `0061` did try. It ran `revoke all on function ... from public`, which revokes
-- the grant held by the PUBLIC pseudo-role. It does not touch `anon` and
-- `authenticated`, which hold their own explicit grants from Supabase's platform
-- setup (see docs/SCHEMA.md on why a database rebuilt from migrations alone has
-- no grants at all). So the revoke read as complete and did nothing.
--
-- The exposure is small: Postgres refuses to run a trigger function outside a
-- trigger context, so calling it returns an error rather than writing a
-- revision row. It is fixed because it is the odd one out, and because the
-- protection here is Postgres refusing on the caller's behalf rather than
-- anything this schema decided. A later edit that made the function callable
-- would silently hand `anon` a writer into `email_template_revisions`, which is
-- an append-only audit table.

revoke all on function public.log_email_template_revision() from anon, authenticated;

-- The same, defensively, for every other trigger function in the schema. All
-- seven already have no client grant; this makes that a stated property rather
-- than an accident of how each migration happened to be written.
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.notify_appointment_created() from anon, authenticated;
revoke all on function public.notify_appointment_status_changed() from anon, authenticated;
revoke all on function public.notify_availability_request() from anon, authenticated;
revoke all on function public.rescheduled_mail() from anon, authenticated;
revoke all on function public.set_updated_at() from anon, authenticated;
revoke all on function public.validate_availability_request() from anon, authenticated;

-- `secret_login_attempts` has RLS enabled and no policies, which the advisor
-- reports as `rls_enabled_no_policy`. That is deliberate and must stay: the
-- table is the rate limiter behind the owner's secret sign-in slug (`0051`),
-- written only by `owner-secret-login` through the service role, which bypasses
-- RLS. Enabled-with-no-policy is deny-all to every client role, which is the
-- correct posture. Adding a policy to silence the advisor would open it.
comment on table public.secret_login_attempts is
  'Rate limiter for the owner secret-slug sign-in (0051). RLS is enabled with NO '
  'policies on purpose: that is deny-all to anon and authenticated. Written only '
  'by the owner-secret-login Edge Function under the service role, which bypasses '
  'RLS. Supabase advisor reports this as rls_enabled_no_policy; it is a false '
  'positive. Do not add a policy.';
