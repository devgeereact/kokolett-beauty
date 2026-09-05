-- =====================================================================
-- 0075_system_health_can_see_a_stranded_send.sql
--
-- `system_health_summary()` counted exactly two email buckets, `queued` and
-- `failed | bounced`. A row in `sending` is in neither, so the one screen the
-- owner has for spotting mail trouble reported a clean queue while a booking
-- confirmation sat claimed and undelivered.
--
-- `sending` is a real state a row can be stuck in: `send-emails` claims a row
-- by moving it to `sending` (a compare-and-swap, so two overlapping cron runs
-- cannot double-send) and moves it on only if the isolate survives to the end
-- of that iteration. The function now recovers rows stranded there for more
-- than fifteen minutes, but recovery being visible matters too: a count that
-- keeps climbing means sends are being interrupted, and that is worth knowing
-- before customers start saying they never got their confirmation.
--
-- Also adds `cancelled`, which `0040` introduced and this summary never
-- counted, so a retired reminder was invisible here as well.
--
-- Read-only, one extra count on an indexed column. Nothing else changes.
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
    'failed_count', (select count(*) from public.email_messages where status in ('failed', 'bounced')),
    -- Claimed by a send that has not reported back. Should be zero or close to
    -- it between runs; a persistent figure means sends are being interrupted.
    'sending_count', (select count(*) from public.email_messages where status = 'sending'),
    'cancelled_count', (select count(*) from public.email_messages where status = 'cancelled')
  ) into v_email;

  select jsonb_build_object(
    'last_fetched_at', fetched_at,
    'last_error', last_error
  ) into v_review
  from public.google_place_snapshot;

  return jsonb_build_object(
    'jobs', v_jobs,
    'email', v_email,
    -- `coalesce` because `google_place_snapshot` can legitimately be empty on a
    -- project whose reviews have never synced, and `select ... into` leaves the
    -- variable NULL there. The page dereferences `reviews.last_fetched_at`, so
    -- returning a bare NULL threw and blanked the whole route. `v_jobs` above
    -- has always been coalesced; this was simply missed.
    'reviews', coalesce(v_review, jsonb_build_object('last_fetched_at', null, 'last_error', null))
  );
end;
$$;

revoke all on function public.system_health_summary() from public, anon;
grant execute on function public.system_health_summary() to authenticated;
