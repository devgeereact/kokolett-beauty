-- =====================================================================
-- 0053_system_health.sql
--
-- The owner has no single place to check "is anything broken." pg_cron
-- already records every scheduled-job run in cron.job_run_details —
-- nothing has ever surfaced it. No new table, no new logging mechanism:
-- this reads pg_cron's own history.
--
-- security definer, so no grant on the `cron` schema is needed — the
-- function runs as its owner (the migration-applying role) regardless of
-- the caller's own privileges, same as every other definer function here.
-- =====================================================================

create or replace function public.system_health_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jobs   jsonb;
  v_email  jsonb;
  v_review jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', j.jobname,
      'active', j.active,
      'schedule', j.schedule,
      'last_status', r.status,
      'last_start', r.start_time,
      'last_end', r.end_time,
      'last_message', r.return_message
    ) order by j.jobname
  ), '[]'::jsonb)
  into v_jobs
  from cron.job j
  left join lateral (
    select rd.status, rd.start_time, rd.end_time, rd.return_message
    from cron.job_run_details rd
    where rd.jobid = j.jobid
    order by rd.start_time desc
    limit 1
  ) r on true;

  select jsonb_build_object(
    'queued_count', (select count(*) from public.email_messages where status = 'queued'),
    'failed_count', (select count(*) from public.email_messages where status in ('failed', 'bounced'))
  ) into v_email;

  select jsonb_build_object(
    'last_fetched_at', fetched_at,
    'last_error', last_error
  ) into v_review
  from public.google_place_snapshot;

  return jsonb_build_object(
    'jobs', v_jobs,
    'email', v_email,
    'reviews', v_review
  );
end;
$$;

revoke all on function public.system_health_summary() from public, anon;
grant execute on function public.system_health_summary() to authenticated;
