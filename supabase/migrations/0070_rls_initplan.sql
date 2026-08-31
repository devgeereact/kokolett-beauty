-- Evaluate auth.uid() once per query instead of once per row.
--
-- Supabase's performance advisor flags four policies that call `auth.uid()`
-- bare. Postgres treats that as a volatile expression referencing the row, so
-- it re-evaluates it for every row scanned. Wrapping it in a scalar subquery
-- makes it an InitPlan: computed once, then compared.
--
-- Honest about the size of the win here: `profiles` and `app_settings` hold one
-- row each, for the single owner. The measurable difference today is nothing.
-- It is done because it is mechanical, semantically identical, and free, and
-- because leaving four advisor warnings standing trains people to skim the list
-- rather than read it. The remaining performance lints are deliberately NOT
-- being acted on, and docs/SCHEMA.md §28 says why.
--
-- `(select auth.uid())` is exactly equivalent to `auth.uid()` in a policy: same
-- value, same null behaviour for an unauthenticated caller. Only the number of
-- evaluations changes.

drop policy if exists app_settings_all_own on public.app_settings;
create policy app_settings_all_own on public.app_settings
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
