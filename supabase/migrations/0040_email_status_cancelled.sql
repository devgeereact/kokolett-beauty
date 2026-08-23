-- `cancelled` joins the email status enum.
--
-- Retiring a queued reminder is not a failure. When an appointment moves or is
-- called off, its outstanding reminders are pulled before they send — nothing
-- went wrong, the reason to send simply stopped existing. Until now the only
-- status available for that was `failed`, so the owner's Email screen counted
-- healthy retirements as delivery failures and trained her to ignore the one
-- number on that page that should mean something.
--
-- This migration only adds the value. Postgres will not let a new enum label be
-- used in the same transaction that created it, so everything that writes or
-- reads `cancelled` lives in 0041.

alter type public.email_status add value if not exists 'cancelled' after 'sent';
