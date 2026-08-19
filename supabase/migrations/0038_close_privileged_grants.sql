-- =====================================================================
-- 0038_close_privileged_grants.sql — three privileged functions and one
-- table were reachable by any authenticated session.
--
-- None of this was exploitable today, because `enable_signup = false`
-- means the project has exactly one auth user and she is the owner. That
-- is a configuration flag holding the line, not a permission boundary: the
-- day a second account exists (a stylist, a test login, a support user),
-- every item below is open to it. This migration makes the grants say what
-- the design already intends.
--
-- The pattern is the one 0021 established for the other cron helpers:
-- revoke from every client role rather than adding an `is_owner()` guard.
-- pg_cron executes as a superuser, which bypasses grants entirely, so the
-- scheduled jobs keep working and no client role can reach them at all.
-- An `is_owner()` check would have been worse here: it would have made the
-- owner able to call them by hand, which is not something either function
-- is designed for.
-- =====================================================================

-- Reads `vault.decrypted_secrets` and fires the outbox POST. Scheduled
-- every 5 minutes by the `drain-email-queue` cron job (0014).
revoke all on function public.drain_email_queue() from public, anon, authenticated;

-- Spends the salon's billable Google Places quota. Scheduled by the
-- `sync-google-reviews` cron job (0021).
revoke all on function public.sync_google_reviews() from public, anon, authenticated;

-- Returns every booked time on a date. Only ever called from inside
-- `set_day_slots()` (0012) and `extend_weekly_template()` (0022), both of
-- which are SECURITY DEFINER and therefore unaffected by this revoke. No
-- client has ever called it: the customer-facing availability path goes
-- through `available_slots()`, which returns free times, not taken ones.
revoke all on function public.booked_times_on(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- `google_place_snapshot` was world-readable, and its `last_error` column
-- is where `sync-reviews` writes raw Google API error text and internal
-- messages. An anonymous visitor could read the salon's integration
-- failures.
--
-- Nothing needs that table directly. The public reviews block calls
-- `public_reviews()` (0017), a SECURITY DEFINER function granted to anon
-- that returns rating, rating_count, fetched_at and the reviews
-- themselves, and never touches `last_error`. So the read policy can go
-- entirely rather than be narrowed.
-- ---------------------------------------------------------------------
drop policy if exists google_place_public_read on public.google_place_snapshot;

comment on column public.google_place_snapshot.last_error is
  'Raw error text from the Places API. Owner-only: see 0038. Do not add a public read policy to this table; the public path is public_reviews().';
