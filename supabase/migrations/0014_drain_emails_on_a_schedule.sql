-- =====================================================================
-- 0014_drain_emails_on_a_schedule.sql
--
-- The outbox has worked since 0005 and SMTP is now configured, but nothing
-- calls the drain — every confirmation sits in `email_messages` until someone
-- pokes the function by hand. This schedules it.
--
-- The awkward part is the shared secret. `send-emails` is deployed with
-- `--no-verify-jwt`, so `EMAIL_CRON_SECRET` is the only thing standing between
-- the internet and the salon's mail queue. It therefore must not appear in this
-- file: the repository is public, and a migration is forever.
--
-- So the secret lives in Supabase Vault, inserted out of band, and this reads it
-- by name at call time. A migration that cannot run without a secret it does not
-- contain is the correct shape here — if the secret is missing the job logs a
-- notice and does nothing, rather than silently posting an unauthenticated
-- request every five minutes.
-- =====================================================================

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net unavailable (%). Email will need an external scheduler.', sqlerrm;
end $$;

/**
 * Ask the send-emails function to drain the queue.
 *
 * Returns the pg_net request id, or null when it could not be sent. Safe to
 * call by hand — that is also how it is tested.
 */
create or replace function public.drain_email_queue()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
  v_url    text;
  v_id     bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_net is not installed; cannot call the function.';
    return null;
  end if;

  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'email_cron_secret'
     limit 1;
  exception when others then
    raise notice 'Vault unreadable (%).', sqlerrm;
    return null;
  end;

  if v_secret is null then
    raise notice 'No email_cron_secret in the vault; not calling the function.';
    return null;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'send_emails_url'
   limit 1;

  if v_url is null then
    raise notice 'No send_emails_url in the vault; not calling the function.';
    return null;
  end if;

  select net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_id;

  return v_id;
end;
$$;

revoke all on function public.drain_email_queue() from public, anon;
grant execute on function public.drain_email_queue() to authenticated;

-- Every five minutes. A reminder due at 09:00 goes out by 09:05, which is well
-- inside what anyone would notice, and it keeps the batch small enough that one
-- slow SMTP handshake cannot back the whole queue up.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'drain-email-queue';
    perform cron.schedule('drain-email-queue', '*/5 * * * *',
      $cron$select public.drain_email_queue()$cron$);
  end if;
exception when others then
  raise notice 'Could not schedule drain-email-queue (%).', sqlerrm;
end $$;
