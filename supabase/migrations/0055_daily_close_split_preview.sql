-- =====================================================================
-- 0055_daily_close_split_preview.sql
--
-- 0054's close_day() computes and logs today's numbers in one step. The
-- Daily Close page needs to show a live preview of those numbers *before*
-- the owner decides to close — and calling close_day() just to preview
-- would spuriously write a day.closed audit row on every page visit.
--
-- Splits the computation into daily_close_summary() (read-only, no side
-- effect) and redefines close_day() to call it, then log the result.
-- Same shape, same signature, same grants — nothing about 0054's
-- behaviour changes from the caller's point of view, only that the
-- numbers are now also readable without triggering a close.
-- =====================================================================

create or replace function public.daily_close_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz        text;
  v_today     date;
  v_day_start timestamptz;
  v_day_end   timestamptz;
  v_summary   jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  select timezone into v_tz from public.booking_settings where id;
  v_today     := (now() at time zone v_tz)::date;
  v_day_start := (v_today::timestamp at time zone v_tz);
  v_day_end   := ((v_today + 1)::timestamp at time zone v_tz);

  select jsonb_build_object(
    'date', v_today,
    'scheduled_count', (
      select count(*) from public.appointments a
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
    ),
    'completed_count', (
      select count(*) from public.appointments a
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status = 'completed'
    ),
    'cancelled_count', (
      select count(*) from public.appointments a
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
        and a.status in ('cancelled', 'no_show', 'rejected')
    ),
    'collected_pence', (
      select coalesce(sum(p.amount_pence), 0)
      from public.payments p
      join public.appointments a on a.id = p.appointment_id
      where a.starts_at >= v_day_start and a.starts_at < v_day_end
    ),
    'unpaid_completed_count', (
      select count(*) from public.appointments_detailed ad
      where ad.starts_at >= v_day_start and ad.starts_at < v_day_end
        and ad.status = 'completed' and ad.paid_pence = 0
    ),
    'pending_requests_count', (
      select count(*) from public.availability_requests r where r.status = 'new'
    ),
    'failed_email_count', (
      select count(*) from public.email_messages m where m.status in ('failed', 'bounced')
    )
  ) into v_summary;

  return v_summary;
end;
$$;

revoke all on function public.daily_close_summary() from public, anon;
grant execute on function public.daily_close_summary() to authenticated;

create or replace function public.close_day()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  if not public.is_owner() then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;

  v_summary := public.daily_close_summary();

  perform public.log_audit_event(
    'day.closed', 'day', null,
    format('Day closed: %s scheduled, %s completed, %s collected',
      v_summary->>'scheduled_count', v_summary->>'completed_count',
      v_summary->>'collected_pence'),
    null, v_summary);

  return v_summary;
end;
$$;

revoke all on function public.close_day() from public, anon;
grant execute on function public.close_day() to authenticated;
