-- Trigger functions stop being part of the public API surface.
--
-- Every function here was created with Postgres's default grant, which is
-- EXECUTE to PUBLIC — so `anon` held execute on seven `security definer`
-- trigger functions, including the two that queue outbound mail and the one
-- that runs when an auth user is created. Postgres checks EXECUTE on a trigger
-- function when the trigger is *created*, not when it fires, so revoking costs
-- the triggers nothing and removes the grant entirely.
--
-- Nothing here was exploitable on its own: Postgres refuses a direct call to a
-- function returning `trigger`. The point is that the grant had no reason to
-- exist, and "not reachable through today's call path" is a weak thing to have
-- standing between anon and a security definer function.

revoke all on function public.handle_new_user()                     from public, anon, authenticated;
revoke all on function public.notify_appointment_created()          from public, anon, authenticated;
revoke all on function public.notify_appointment_status_changed()   from public, anon, authenticated;
revoke all on function public.notify_availability_request()         from public, anon, authenticated;
revoke all on function public.rescheduled_mail()                    from public, anon, authenticated;
revoke all on function public.validate_availability_request()       from public, anon, authenticated;

-- `set_updated_at` also carried a mutable `search_path`. A trigger function
-- without one resolves unqualified names against whatever the calling session
-- happens to have set, which is the standard shape of a search-path hijack.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Same treatment for the reference generator: pinned, and no longer callable by
-- a customer. It is an implementation detail of `book_appointment`, which is
-- `security definer` and calls it as the owner regardless.
create or replace function public.generate_booking_reference()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ACDEFGHJKLMNPQRSTUVWXYZ2345679'; -- no I/O/0/1/B/8
  candidate text;
begin
  loop
    candidate := 'KB-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.appointments a where a.reference = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_booking_reference() from public, anon, authenticated;
