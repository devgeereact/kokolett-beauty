-- A public "contact us" form, for anything that isn't a booking.
--
-- Booking and availability-request enquiries already have a path — this one
-- was missing for the plain "I have a question first" visitor the marketing
-- rebrand's Contact page adds. Rather than a new table and a new owner-inbox
-- UI (a new place for the owner to remember to check), it reuses the
-- `email_messages` pipeline every other notification already rides:
--
--   anon calls submit_contact_message()
--     -> validates input, looks up the owner's email
--     -> queue_email('contact_message_received', ...)
--     -> drain_email_queue() (pg_cron, every 5 min) -> send-emails Edge
--        Function -> SMTP
--
-- The owner just gets an email, the same as a new booking or a new
-- availability request. `queue_email` is already SECURITY DEFINER and
-- revoked from anon (0005) — this function is the one new public entry
-- point, and it does the validation that function was never meant to do
-- itself.

create or replace function public.submit_contact_message(
  p_full_name text,
  p_email     text,
  p_message   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text := trim(p_full_name);
  v_email     text := trim(p_email);
  v_message   text := trim(p_message);
  v_owner     text;
begin
  if v_full_name = '' or length(v_full_name) > 200 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 320 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if v_message = '' or length(v_message) > 4000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  select p.email into v_owner
    from public.staff s join public.profiles p on p.id = s.id
   order by s.created_at limit 1;

  if v_owner is not null then
    perform public.queue_email(
      'contact_message_received',
      v_owner,
      'Message from ' || v_full_name,
      null, null, null,
      jsonb_build_object('full_name', v_full_name, 'email', v_email, 'notes', v_message)
    );
  end if;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text) to anon, authenticated;
