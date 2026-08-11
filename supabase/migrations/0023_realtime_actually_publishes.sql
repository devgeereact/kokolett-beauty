-- =====================================================================
-- 0023_realtime_actually_publishes.sql
--
-- The dashboard's live updates have never worked.
--
-- `useRealtimeAppointments` subscribes to `postgres_changes` on
-- `public.appointments`, and TodayPage renders a green "Live" dot from the
-- channel's subscribe state. The channel does connect, so the dot has always
-- been green — but `public.appointments` was never added to the
-- `supabase_realtime` publication, and Postgres change streams come from
-- replication. A table that is not published produces no changes to stream.
--
-- So the owner has been looking at an indicator that says "Live" on a screen
-- that only ever updates when she reloads it. That is worse than having no
-- indicator: the whole point of the Today screen is that a booking taken on the
-- website while she is between clients appears without her doing anything, and
-- the dot told her it was working.
--
-- Publishing the base table rather than `appointments_detailed` is deliberate
-- and matches the hook's own comment: views do not replicate. The payload is
-- un-joined, which is why the consumers refetch on any event rather than
-- rendering straight from it.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    -- A project that has never had realtime enabled has no publication at all.
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

-- `full` so an UPDATE payload carries the previous row as well as the new one.
-- The default (`default`, i.e. primary key only) is enough for the refetch the
-- client actually does, but a status change from `confirmed` to `cancelled`
-- otherwise arrives with no way to see what it changed *from*, which is the one
-- thing a future consumer would reach for.
alter table public.appointments replica identity full;

-- Realtime honours RLS for `postgres_changes`, so this grants nothing new: the
-- owner already reads `appointments` through her own policies, and anon still
-- receives nothing because anon can select nothing.
