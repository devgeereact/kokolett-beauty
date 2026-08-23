-- Personal data stops accumulating forever.
--
-- Two tables held customer personal data with no end date at all:
--
--   * `email_messages` keeps every message the salon has ever sent, each with
--     the recipient's address and a payload carrying their name. Live links are
--     already scrubbed on send, which was the urgent half; the address and name
--     stayed indefinitely, so the outbox slowly became the largest store of
--     customer data in the system and the one nobody thinks of as a store.
--   * `availability_requests` keeps `full_name`, `email` and `mobile` for every
--     enquiry, including ones answered or declined years earlier.
--
-- Keeping either beyond the point it is useful is exactly what storage
-- limitation exists to prevent. Two years is the retention: comfortably longer
-- than the salon would ever look back through a delivery log or an old enquiry,
-- and short enough that data does not outlive its purpose.
--
-- Appointments, payments and customers are deliberately untouched. Those are
-- the salon's business records, they are what the books are built from, and
-- erasing a specific person from them is what `erase_customer_as_owner` is for.

create or replace function public.purge_expired_personal_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emails   integer;
  v_requests integer;
begin
  -- Only messages that have reached a final state. A queued reminder for an
  -- appointment two years out is still work waiting to happen.
  with deleted as (
    delete from public.email_messages
     where status in ('sent', 'failed', 'bounced', 'cancelled')
       and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_emails from deleted;

  -- Only requests the owner has finished with. A request still sitting in the
  -- inbox is not stale, however old it is — it is overdue.
  with deleted as (
    delete from public.availability_requests
     where status <> 'new'
       and created_at < now() - interval '2 years'
    returning 1
  )
  select count(*) into v_requests from deleted;

  return jsonb_build_object(
    'email_messages_deleted', v_emails,
    'availability_requests_deleted', v_requests
  );
end;
$$;

revoke all on function public.purge_expired_personal_data() from public, anon, authenticated;

-- Weekly is the right cadence: this deletes rows that crossed a two-year line,
-- so running it nightly would only ever find a handful and running it monthly
-- would leave data up to a month past its retention.
select cron.schedule(
  'purge-expired-personal-data',
  '31 3 * * 0',
  $cron$select public.purge_expired_personal_data()$cron$
);
