-- Finish the erasures the owner already asked for.
--
-- Every customer carrying a `deleted_at` was erased through the old path, which
-- set three columns and stopped: `full_name`, `email` and `mobile` were never
-- touched, so those people's names, addresses and phone numbers went on
-- rendering in Appointments and Reports, their addresses stayed in the outbox
-- and on the mailing list, and any availability request they raised kept a full
-- copy of their contact details. They are also invisible on the Customers
-- screen, which filters on `deleted_at` — so there is no way for the owner to
-- re-run the erasure herself now that it does the whole job.
--
-- This completes the request she already confirmed. It deliberately uses the
-- anonymise ending rather than the delete one for every row regardless of
-- payments: these are historic customers with real appointments behind the
-- salon's revenue figures, and quietly changing last month's takings is not
-- something a data-hygiene migration should do. Appointments stay, money stays,
-- the person goes.

do $$
declare
  r record;
begin
  for r in select id, email from public.customers where deleted_at is not null loop
    delete from public.subscribers where lower(email) = lower(r.email::text);

    delete from public.availability_requests
     where customer_id = r.id
        or lower(email) = lower(r.email::text);

    delete from public.email_messages
     where customer_id = r.id
        or lower(to_email) = lower(r.email::text);

    delete from public.customer_access_tokens where customer_id = r.id;

    update public.appointments
       set customer_note = null,
           owner_note = null,
           cancellation_reason = null,
           rejection_reason = null
     where customer_id = r.id;

    update public.customers
       set full_name = 'Erased customer',
           email = ('erased+' || r.id::text || '@invalid')::citext,
           mobile = null,
           notes = null,
           marketing_consent = false,
           consent_updated_at = now()
     where id = r.id;
  end loop;
end $$;
