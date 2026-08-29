-- =====================================================================
-- 0054_daily_close.sql
--
-- End-of-day reconciliation. Reuses the audit trail (0052) rather than a
-- new table: closing the day is itself an audited action, so its history
-- is free — one more value in audit_events.action's existing vocabulary.
--
-- Scoped to today only, in the salon's own timezone, matching the same
-- v_today/day-bounds calculation owner_dashboard_summary() already uses
-- (docs/KOKO_GAP.md: single-owner, don't overbuild — no historical date
-- picker, no "reopen a closed day"). Re-closable, not blocked: closing
-- again just logs another day.closed row, matching the log's own
-- append-only philosophy.
--
-- Superseded by 0055: this version computes and logs in one function,
-- which turned out to have no way to preview today's numbers without
-- spuriously logging a close. Left as originally applied rather than
-- edited in place — see 0055's header, same precedent as 0024/0025→0026.
-- =====================================================================

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in (
    'appointment.created',
    'appointment.status_changed',
    'appointment.rescheduled',
    'appointment.deleted',
    'customer.erased',
    'payment.recorded',
    'settings.login_slug_changed',
    'day.closed'
  ));

create or replace function public.close_day()
returns jsonb
language plpgsql
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
    -- Same definition owner_dashboard_summary() uses for
    -- today_collected_pence: every payment logged against a booking
    -- starting today, regardless of that booking's current status.
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
