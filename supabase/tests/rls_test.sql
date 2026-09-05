-- RLS regression suite.
--
-- Row-level security IS the security model of this app: the browser holds an
-- anon key and RLS is what stands between it and the salon's schedule, customer
-- list, contact details and payment history. Until this file existed nothing
-- asserted any of it — `docs/history/2026-08-19-go-live-checklist.md` §7 and
-- `docs/plan.md` both carried "no RLS tests" as the highest-value gap.
--
-- Run with `supabase test db`: it starts a throwaway Postgres, applies every
-- migration in order, installs pgTAP, and runs this file. CI does that on every
-- push (`.github/workflows/ci.yml`).
--
-- WHY THIS SEEDS ROWS FIRST. A count of zero proves nothing on an empty table —
-- it is indistinguishable from a policy that works. Probing the live database
-- on 2026-08-20 found six of the sensitive tables empty (`payments`,
-- `subscribers`, `customer_access_tokens`, `ai_recommendations`,
-- `availability_requests`, `google_reviews`), so a naive "anon sees 0 rows"
-- suite would have reported six passes while asserting nothing whatsoever.
-- Every table below is given a row first, so "anon sees 0" is a real denial.
--
-- Everything runs inside a transaction that is rolled back.

begin;

create extension if not exists pgtap with schema extensions;
-- pgTAP installs into `extensions`; put it on the path so the assertions
-- below can be called unqualified.
set local search_path = extensions, public;

select plan(68);

-- --------------------------------------------------------------------------
-- Grants. This is what makes the suite a test of RLS rather than of luck.
--
-- `supabase/migrations/` never grants table privileges. Production has them
-- because the hosted platform applies default privileges to `anon` and
-- `authenticated` when the project is created — that is platform setup, not
-- migration content. A database built from the migrations alone therefore
-- refuses every role at the GRANT layer, before a single policy is consulted,
-- and the first CI run of this file failed all 39 behavioural assertions with
-- "permission denied" for exactly that reason.
--
-- Granting here deliberately puts the fresh database in the *worse* position
-- than production: every role may reach every table, so anything that still
-- denies them is RLS doing it, and nothing else. A policy that only appeared to
-- work because a grant happened to be missing would fail this suite.
-- --------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated;

-- --------------------------------------------------------------------------
-- Fixtures, created before any role switch.
-- --------------------------------------------------------------------------

-- `is_owner()` is `exists (select 1 from staff where id = auth.uid())` and
-- `staff.id` references auth.users, so both identities have to be real auth
-- users or the owner-side assertions would prove nothing.
--
-- Inserting into auth.users fires `handle_new_user()`, which gives each of them
-- their own `profiles` and `app_settings` row. That is why §3 does not assert
-- those two tables: a signed-in user seeing exactly their own row there is the
-- policy working, not a leak.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'owner@rls.test', '', now(), now(), now()),
       ('22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'intruder@rls.test', '', now(), now(), now())
on conflict (id) do nothing;

-- Only the first is staff. The second is the signed-in-but-not-the-owner case,
-- which an anon-only suite would miss entirely.
insert into public.staff (id, role)
values ('11111111-1111-1111-1111-111111111111', 'owner')
on conflict (id) do nothing;

insert into public.services (id, name, slug, duration_min, price_pence)
values ('55555555-5555-5555-5555-555555555555', 'RLS Test Service',
        'rls-test-service', 60, 0);

insert into public.customers (id, email, full_name)
values ('33333333-3333-3333-3333-333333333333', 'customer@rls.test',
        'Customer Under Test');

insert into public.customer_access_tokens (customer_id, token_hash, expires_at)
values ('33333333-3333-3333-3333-333333333333', 'not-a-real-hash',
        now() + interval '1 day');

-- Far future so it cannot collide with a real booking under the
-- `appointments_no_overlap` exclusion constraint.
insert into public.appointments (id, reference, customer_id, service_id,
                                 starts_at, ends_at, status, price_pence)
values ('44444444-4444-4444-4444-444444444444', 'KB-RLST01',
        '33333333-3333-3333-3333-333333333333',
        '55555555-5555-5555-5555-555555555555',
        now() + interval '400 days',
        now() + interval '400 days 1 hour', 'confirmed', 0);

insert into public.payments (appointment_id, amount_pence, recorded_by)
values ('44444444-4444-4444-4444-444444444444', 4500,
        '11111111-1111-1111-1111-111111111111');

insert into public.email_messages (template, to_email, subject)
values ('booking_confirmed', 'customer@rls.test', 'Subject under test');

insert into public.subscribers (email) values ('subscriber@rls.test');

insert into public.availability_requests (full_name, email)
values ('Requester Under Test', 'requester@rls.test');

insert into public.google_reviews (id, author_name, rating)
values ('review-under-test', 'Reviewer Under Test', 5);

insert into public.calendar_feeds (token_hash) values ('not-a-real-feed-hash');

-- Inserted directly (as the migration-applying role, same as every fixture
-- above), since audit_events has no client insert path at all — not even
-- for the owner — see §6b below.
insert into public.audit_events (actor, action, entity_type, entity_id, summary)
values ('owner', 'payment.recorded', 'payment',
        '44444444-4444-4444-4444-444444444444', 'Fixture audit row under test');

-- Same reasoning as audit_events above: written only by a trigger
-- (log_email_template_revision(), 0061), never a client insert path.
-- 'booking_confirmed' is one of 0032's own seeded default templates, so it
-- already exists by the time this fixture runs.
insert into public.email_template_revisions (template_key, subject, html_body)
values ('booking_confirmed', 'Fixture revision subject under test', '<p>fixture</p>');

-- Same reasoning again: written only by track_product_event() (0064), never
-- a client insert path, despite anon/authenticated holding the base INSERT
-- grant this suite deliberately gives everyone (see the Grants note above).
insert into public.product_events (event_name, session_id)
values ('book_page_viewed', 'rls-fixture-session');

-- Published availability. Unlike the catalogue tables, nothing in the
-- migrations seeds these two, so on a fresh database they are empty and §5's
-- "anon can read them" assertions have nothing to find — which is exactly how
-- the first CI run failed tests 35 and 36. The booking page is built on these:
-- if anon ever stops being able to read them the website silently offers no
-- times at all, so they are worth asserting properly.
insert into public.weekly_template (day_of_week, starts_at)
values (1, '09:00'), (1, '11:00'), (2, '09:00')
on conflict do nothing;

insert into public.availability_slots (on_date, starts_at)
values ((current_date + 400), '09:00'),
       ((current_date + 400), '11:00'),
       ((current_date + 401), '09:00')
on conflict do nothing;

-- --------------------------------------------------------------------------
-- Probe: what can each role actually see?
--
-- Counting happens inside a DO block that switches role and resets it before
-- writing the result, so the probed role never needs rights on the results
-- table or on pgTAP itself.
--
-- A table the role cannot reach at all (no GRANT — what `0038` did to
-- `email_templates`) raises insufficient_privilege rather than returning 0.
-- That is a stronger denial than RLS, recorded as -1 so the two are never
-- silently conflated.
-- --------------------------------------------------------------------------

create temp table rls_probe (
  tbl     text   not null,
  as_role text   not null,
  visible bigint not null,
  primary key (tbl, as_role)
) on commit drop;

do $probe$
declare
  t text;
  r record;
  n bigint;
begin
  for r in
    select * from (values
      ('anon',          null::text),
      ('authenticated', '22222222-2222-2222-2222-222222222222'),
      ('owner',         '11111111-1111-1111-1111-111111111111')
    ) as v(role_label, subject_id)
  loop
    foreach t in array array[
      'appointments','customers','email_messages','customer_access_tokens','staff',
      'payments','subscribers','calendar_feeds','email_templates',
      'google_place_snapshot','day_decided','profiles','app_settings',
      'availability_requests','services','service_categories','service_menu',
      'booking_settings','availability_slots','weekly_template','google_reviews',
      'audit_events','email_template_revisions','product_events','contact_messages'
    ] loop
      begin
        if r.subject_id is null then
          set local role anon;
          set local request.jwt.claims = '{"role":"anon"}';
        else
          set local role authenticated;
          perform set_config('request.jwt.claims',
                             json_build_object('sub', r.subject_id,
                                               'role', 'authenticated')::text,
                             true);
        end if;

        execute format('select count(*) from public.%I', t) into n;
        reset role;
      exception when insufficient_privilege then
        reset role;
        n := -1;
      end;

      insert into rls_probe values (t, r.role_label, n);
    end loop;
  end loop;
  reset role;
end
$probe$;

-- Guard against the suite silently testing nothing: if the fixtures had not
-- landed, every "sees 0 rows" assertion below would pass for the wrong reason.
do $guard$
begin
  if (select count(*) from public.appointments) = 0
     or (select count(*) from public.payments) = 0
     or (select count(*) from public.audit_events) = 0
     or (select count(*) from public.email_template_revisions) = 0
     or (select count(*) from public.product_events) = 0 then
    raise exception 'fixtures did not seed — the denial assertions would be vacuous';
  end if;
end
$guard$;

-- --------------------------------------------------------------------------
-- 1. RLS is on everywhere. A new table shipped without it is the likeliest
--    future regression, and no per-table assertion below would catch it.
-- --------------------------------------------------------------------------

select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint,
  'every table in public has row level security enabled'
);

-- A contact-page enquiry (0080). Seeded for the same reason everything else
-- here is: a count of zero on an empty table proves nothing.
insert into public.contact_messages (full_name, email, message)
values ('Enquirer Under Test', 'enquiry@rls.test', 'Do you do knotless braids?');

-- --------------------------------------------------------------------------
-- 2. An anonymous visitor — which is what the shipped browser bundle is —
--    cannot read anything private. These are the tables that would matter in
--    a breach.
-- --------------------------------------------------------------------------

select is((select visible from rls_probe where tbl='appointments' and as_role='anon'),
          0::bigint, 'anon cannot read appointments');
select is((select visible from rls_probe where tbl='customers' and as_role='anon'),
          0::bigint, 'anon cannot read customers');
select is((select visible from rls_probe where tbl='email_messages' and as_role='anon'),
          0::bigint, 'anon cannot read email_messages');
select is((select visible from rls_probe where tbl='customer_access_tokens' and as_role='anon'),
          0::bigint, 'anon cannot read customer_access_tokens');
select is((select visible from rls_probe where tbl='staff' and as_role='anon'),
          0::bigint, 'anon cannot read staff');
select is((select visible from rls_probe where tbl='payments' and as_role='anon'),
          0::bigint, 'anon cannot read payments');
select is((select visible from rls_probe where tbl='subscribers' and as_role='anon'),
          0::bigint, 'anon cannot read subscribers');
select is((select visible from rls_probe where tbl='calendar_feeds' and as_role='anon'),
          0::bigint, 'anon cannot read calendar_feeds');
select is((select visible from rls_probe where tbl='profiles' and as_role='anon'),
          0::bigint, 'anon cannot read profiles');
select is((select visible from rls_probe where tbl='app_settings' and as_role='anon'),
          0::bigint, 'anon cannot read app_settings');
select is((select visible from rls_probe where tbl='day_decided' and as_role='anon'),
          0::bigint, 'anon cannot read day_decided');
select is((select visible from rls_probe where tbl='availability_requests' and as_role='anon'),
          0::bigint, 'anon cannot read availability_requests — it may insert, never select');
select is((select visible from rls_probe where tbl='google_place_snapshot' and as_role='anon'),
          0::bigint, 'anon cannot read google_place_snapshot — public read revoked in 0038');
select is((select visible from rls_probe where tbl='email_templates' and as_role='anon'),
          0::bigint, 'anon cannot read email_templates even when granted — RLS denies it');
select is((select visible from rls_probe where tbl='contact_messages' and as_role='anon'),
          0::bigint, 'anon cannot read contact messages');

select is((select visible from rls_probe where tbl='audit_events' and as_role='anon'),
          0::bigint, 'anon cannot read audit_events');
select is((select visible from rls_probe where tbl='email_template_revisions' and as_role='anon'),
          0::bigint, 'anon cannot read email_template_revisions');
select is((select visible from rls_probe where tbl='product_events' and as_role='anon'),
          0::bigint, 'anon cannot read product_events');

-- --------------------------------------------------------------------------
-- 3. A signed-in user who is not the owner is no better off.
--
-- This is what an anon-only suite misses. `is_owner()` is membership of
-- `staff`, not merely holding a session. Anyone can obtain a valid JWT; it must
-- buy them nothing.
-- --------------------------------------------------------------------------

select is((select visible from rls_probe where tbl='appointments' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read appointments');
select is((select visible from rls_probe where tbl='customers' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read customers');
select is((select visible from rls_probe where tbl='email_messages' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read email_messages');
select is((select visible from rls_probe where tbl='customer_access_tokens' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read customer_access_tokens');
select is((select visible from rls_probe where tbl='payments' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read payments');
select is((select visible from rls_probe where tbl='subscribers' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read subscribers');
select is((select visible from rls_probe where tbl='staff' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read staff');
select is((select visible from rls_probe where tbl='calendar_feeds' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read calendar_feeds');
select is((select visible from rls_probe where tbl='availability_requests' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read availability_requests');
select is((select visible from rls_probe where tbl='contact_messages' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read contact messages either');

select is((select visible from rls_probe where tbl='audit_events' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read audit_events');
select is((select visible from rls_probe where tbl='email_template_revisions' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read email_template_revisions');
select is((select visible from rls_probe where tbl='product_events' and as_role='authenticated'),
          0::bigint, 'a signed-in non-owner cannot read product_events');

-- --------------------------------------------------------------------------
-- 4. The owner can. Without this the suite would pass just as happily if RLS
--    denied everyone and the dashboard were entirely broken.
-- --------------------------------------------------------------------------

select cmp_ok((select visible from rls_probe where tbl='appointments' and as_role='owner'),
              '>', 0::bigint, 'the owner can read appointments');
select cmp_ok((select visible from rls_probe where tbl='customers' and as_role='owner'),
              '>', 0::bigint, 'the owner can read customers');
select cmp_ok((select visible from rls_probe where tbl='email_messages' and as_role='owner'),
              '>', 0::bigint, 'the owner can read email_messages');
select cmp_ok((select visible from rls_probe where tbl='payments' and as_role='owner'),
              '>', 0::bigint, 'the owner can read payments');
select cmp_ok((select visible from rls_probe where tbl='subscribers' and as_role='owner'),
              '>', 0::bigint, 'the owner can read subscribers');
select cmp_ok((select visible from rls_probe where tbl='customer_access_tokens' and as_role='owner'),
              '>', 0::bigint, 'the owner can read customer_access_tokens');
select cmp_ok((select visible from rls_probe where tbl='calendar_feeds' and as_role='owner'),
              '>', 0::bigint, 'the owner can read calendar_feeds');
select cmp_ok((select visible from rls_probe where tbl='availability_requests' and as_role='owner'),
              '>', 0::bigint, 'the owner can read availability_requests');
select cmp_ok((select visible from rls_probe where tbl='audit_events' and as_role='owner'),
              '>', 0::bigint, 'the owner can read audit_events');
select cmp_ok((select visible from rls_probe where tbl='email_template_revisions' and as_role='owner'),
              '>', 0::bigint, 'the owner can read email_template_revisions');
select cmp_ok((select visible from rls_probe where tbl='product_events' and as_role='owner'),
              '>', 0::bigint, 'the owner can read product_events');

-- --------------------------------------------------------------------------
-- 5. The public surface stays public.
--
-- Booking is anonymous by design (docs/PRD.md §4), so over-locking is a real
-- failure mode too. A policy tightened here takes the website down rather than
-- leaking anything, and would otherwise be caught only by a person loading the
-- site and noticing there are no times.
-- --------------------------------------------------------------------------

select cmp_ok((select visible from rls_probe where tbl='availability_slots' and as_role='anon'),
              '>', 0::bigint, 'anon can read availability_slots — the booking page needs them');
select cmp_ok((select visible from rls_probe where tbl='weekly_template' and as_role='anon'),
              '>', 0::bigint, 'anon can read weekly_template — opening hours are public');
select cmp_ok((select visible from rls_probe where tbl='service_menu' and as_role='anon'),
              '>', 0::bigint, 'anon can read service_menu — the website lists it');
select cmp_ok((select visible from rls_probe where tbl='service_categories' and as_role='anon'),
              '>', 0::bigint, 'anon can read service_categories');
select cmp_ok((select visible from rls_probe where tbl='booking_settings' and as_role='anon'),
              '>', 0::bigint, 'anon can read booking_settings — the booking rules are public');
select cmp_ok((select visible from rls_probe where tbl='google_reviews' and as_role='anon'),
              '>', 0::bigint, 'anon can read google_reviews — they render on the marketing site');

-- --------------------------------------------------------------------------
-- 6. Writes. Reading is only half of it: the public booking path is a
--    SECURITY DEFINER function precisely so the table itself stays closed
--    (docs/RULES.md §9.3).
--
-- The three verbs do NOT fail alike, and assuming they do is how a test ends up
-- asserting nothing. INSERT raises 42501, because a row that no policy admits
-- is a violation. UPDATE and DELETE raise nothing at all: USING simply matches
-- no rows, so they report success having touched zero. Both are correct
-- denials; only the first is an error. Verified against the live database on
-- 2026-08-20 before this suite was written.
-- --------------------------------------------------------------------------

-- Every verb is attempted inside a DO block that switches role and resets it
-- before anything is asserted. pgTAP keeps its plan counter in temp objects
-- owned by the session role, so calling an assertion while `set local role
-- anon` is active dies with "permission denied for table" — the outcome has to
-- be captured first and asserted afterwards.
--
-- The UPDATE and DELETE are scoped to the fixture rows rather than written
-- bare. An unfiltered `delete from public.appointments` is what
-- `.claude/hookify.unfiltered-delete-live-data.local.md` exists to stop, after
-- one destroyed a real customer's booking with no backup. Naming the target is
-- also the better test: it proves anon cannot delete a specific row it knows
-- the id of, which is the actual attack.

create temp table write_probe (
  op            text not null primary key,
  sqlstate_out  text,
  rows_affected int
) on commit drop;

do $writes$
declare st text; updated int; removed int;
begin
  begin
    set local role anon;
    set local request.jwt.claims = '{"role":"anon"}';
    insert into public.appointments (reference, customer_id, service_id,
                                     starts_at, ends_at, status, price_pence)
    values ('KB-RLST02', '33333333-3333-3333-3333-333333333333',
            '55555555-5555-5555-5555-555555555555',
            now() + interval '401 days',
            now() + interval '401 days 1 hour', 'confirmed', 0);
    reset role;
    st := 'NONE';
  exception when others then
    st := SQLSTATE;
    reset role;
  end;
  insert into write_probe values ('insert', st, null);

  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';

  update public.customers
     set full_name = 'renamed by an attacker'
   where id = '33333333-3333-3333-3333-333333333333';
  get diagnostics updated = ROW_COUNT;

  delete from public.appointments where reference = 'KB-RLST01';
  get diagnostics removed = ROW_COUNT;

  reset role;

  insert into write_probe values ('update', null, updated), ('delete', null, removed);
end
$writes$;

select is((select sqlstate_out from write_probe where op = 'insert'),
          '42501',
          'anon cannot insert an appointment — book_appointment() is the only path');

select is((select rows_affected from write_probe where op = 'update'),
          0, 'an anon UPDATE on a known customer row matches nothing');
select is((select full_name from public.customers
            where id = '33333333-3333-3333-3333-333333333333'),
          'Customer Under Test', 'and the customer name is untouched');

select is((select rows_affected from write_probe where op = 'delete'),
          0, 'an anon DELETE of a known appointment matches nothing');
select is((select count(*) from public.appointments
            where reference = 'KB-RLST01'),
          1::bigint, 'and that appointment is still there');

-- --------------------------------------------------------------------------
-- 6b. audit_events is immutable even for the owner (0052) — the log has no
--     client write path at all. If a future migration ever adds an owner
--     write policy here by mistake, this is what would catch it.
--
-- email_template_revisions (0061) and product_events (0064) are the same
-- shape: trigger/function-written only, no client insert path for anyone,
-- despite each holding the base INSERT grant this suite deliberately gives
-- anon/authenticated (see the Grants note above) — RLS, not the grant, is
-- what closes them.
-- --------------------------------------------------------------------------

create temp table audit_write_probe (
  op           text not null primary key,
  sqlstate_out text
) on commit drop;

do $audit_write$
declare st text;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
                       json_build_object('sub', '11111111-1111-1111-1111-111111111111',
                                         'role', 'authenticated')::text,
                       true);
    insert into public.audit_events (actor, action, entity_type, summary)
    values ('owner', 'payment.recorded', 'payment', 'attempted client insert');
    reset role;
    st := 'NONE';
  exception when others then
    st := SQLSTATE;
    reset role;
  end;
  insert into audit_write_probe values ('insert', st);

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
                       json_build_object('sub', '11111111-1111-1111-1111-111111111111',
                                         'role', 'authenticated')::text,
                       true);
    insert into public.email_template_revisions (template_key, subject, html_body)
    values ('booking_confirmed', 'attempted client insert', '<p>x</p>');
    reset role;
    st := 'NONE';
  exception when others then
    st := SQLSTATE;
    reset role;
  end;
  insert into audit_write_probe values ('insert_email_template_revisions', st);

  begin
    set local role authenticated;
    perform set_config('request.jwt.claims',
                       json_build_object('sub', '11111111-1111-1111-1111-111111111111',
                                         'role', 'authenticated')::text,
                       true);
    insert into public.product_events (event_name, session_id)
    values ('book_page_viewed', 'attempted-client-insert');
    reset role;
    st := 'NONE';
  exception when others then
    st := SQLSTATE;
    reset role;
  end;
  insert into audit_write_probe values ('insert_product_events', st);
end
$audit_write$;

select is((select sqlstate_out from audit_write_probe where op = 'insert'),
          '42501',
          'even the owner cannot insert into audit_events directly — log_audit_event() is the only path');
select is((select sqlstate_out from audit_write_probe where op = 'insert_email_template_revisions'),
          '42501',
          'even the owner cannot insert into email_template_revisions directly — log_email_template_revision() is the only path');
select is((select sqlstate_out from audit_write_probe where op = 'insert_product_events'),
          '42501',
          'even the owner cannot insert into product_events directly — track_product_event() is the only path');

-- --------------------------------------------------------------------------
-- The contact form's rate limit (0049).
--
-- `submit_contact_message()` is granted to anon, so an unguarded version lets
-- anyone make the salon's own SMTP identity mail the owner in a loop — the
-- hole 0021 closed for `availability_requests`. These assertions run as anon,
-- because that is who calls it, and they pin both caps: the per-address one a
-- script beats by rotating addresses, and the global one that makes rotating
-- pointless.
-- --------------------------------------------------------------------------
set local role anon;

select lives_ok(
  $$select public.submit_contact_message('Contact Probe', 'contact@rls.test', 'first')$$,
  'anon may send a contact message');

select lives_ok(
  $$select public.submit_contact_message('Contact Probe', 'contact@rls.test', 'second')$$,
  'and a second from the same address');

select lives_ok(
  $$select public.submit_contact_message('Contact Probe', 'contact@rls.test', 'third')$$,
  'and a third, which is the limit rather than one past it');

select throws_ok(
  $$select public.submit_contact_message('Contact Probe', 'contact@rls.test', 'fourth')$$,
  'P0001', 'TOO_MANY_MESSAGES',
  'but a fourth inside 24 hours is refused');

reset role;

-- ---------------------------------------------------------------------------
-- Trigger functions are not a client-callable surface.
--
-- Supabase's advisor found `log_email_template_revision` executable by anon and
-- authenticated: the only one of the eight trigger functions in this schema
-- with any client grant. `0061` had revoked it from PUBLIC, which does not
-- touch the explicit grants anon and authenticated hold, so the revoke read as
-- complete and did nothing. `0069` revokes it properly, and from the other
-- seven defensively.
--
-- Postgres refuses to run a trigger function outside a trigger context anyway,
-- so this asserts the grant rather than the behaviour: the point is that a
-- later edit cannot quietly hand anon a writer into an append-only audit table.
select is_empty(
  $$select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype = 'pg_catalog.trigger'::regtype
       and (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE'))$$,
  'no trigger function is executable by anon or authenticated');

-- `secret_login_attempts` is the rate limiter behind the owner's sign-in slug.
-- RLS enabled with no policies is deny-all, which is the correct posture: it is
-- written only by the Edge Function under the service role. The advisor reports
-- it as rls_enabled_no_policy. Asserting it here stops anyone "fixing" that.
select is_empty(
  $$select policyname from pg_policies
     where schemaname = 'public' and tablename = 'secret_login_attempts'$$,
  'secret_login_attempts stays deny-all: RLS on, no policies, written only by the service role');

-- ---------------------------------------------------------------------------
-- An unsubscribe cannot be undone from the public endpoint.
--
-- `subscribe_to_updates()` is granted to anon and used to end its upsert with
-- `set unsubscribed_at = null`, so calling it with an address that had opted
-- out put that person straight back into the broadcast audience (`0058` sends
-- to `confirmed and unsubscribed_at is null`, and `confirmed` defaults to true
-- and is never cleared). The anon key ships inside the browser bundle, so the
-- caller did not have to be the person whose address it was. `0071` drops that
-- clause; these three assertions are what stops it coming back.
--
-- Same DO-block shape as the write probe above, and for the same reason: an
-- assertion called while `set local role anon` is active dies on pgTAP's own
-- temp tables, so the outcome is captured first and asserted afterwards.

create temp table subscribe_probe (
  step         text primary key,
  sqlstate_out text
) on commit drop;

do $subscribe$
declare st text;
begin
  begin
    set local role anon;
    set local request.jwt.claims = '{"role":"anon"}';
    perform public.subscribe_to_updates('optout@rls.test', 'Opt Out');
    reset role;
    st := 'NONE';
  exception when others then
    st := SQLSTATE;
    reset role;
  end;
  insert into subscribe_probe values ('join', st);
end
$subscribe$;

select is((select sqlstate_out from subscribe_probe where step = 'join'),
          'NONE', 'anon can join the mailing list');

update public.subscribers
   set unsubscribed_at = now()
 where email = 'optout@rls.test';

do $resubscribe$
declare st text;
begin
  begin
    set local role anon;
    set local request.jwt.claims = '{"role":"anon"}';
    perform public.subscribe_to_updates('optout@rls.test', 'Opt Out');
    reset role;
    st := 'NONE';
  exception when others then
    st := SQLSTATE;
    reset role;
  end;
  insert into subscribe_probe values ('rejoin', st);
end
$resubscribe$;

select is((select sqlstate_out from subscribe_probe where step = 'rejoin'),
          'NONE',
          'signing up again with an opted-out address still succeeds, so the endpoint leaks nothing about who is on the list');

select isnt(
  (select unsubscribed_at from public.subscribers where email = 'optout@rls.test'),
  null,
  'and the unsubscribe survives it');

-- ---------------------------------------------------------------------------
-- 8. Every owner-gated RPC actually refuses a signed-in non-owner.
--
-- Until 2026-09-05 this suite tested table-level RLS and exactly two RPCs, and
-- asserted the `is_owner()` guard on none of the ~33 owner-gated SECURITY
-- DEFINER functions. All of them are granted to `authenticated`, and §3's own
-- header states the threat: "Anyone can obtain a valid JWT; it must buy them
-- nothing." A `create or replace` that dropped the `if not public.is_owner()`
-- prologue from `erase_customer_as_owner`, `set_appointment_status` or
-- `export_customer_data` would have left CI green while any signed-in account
-- could erase a customer or read the whole appointment book.
--
-- The set is derived, not listed. Anything SECURITY DEFINER and executable by
-- `authenticated` must deny a non-owner, EXCEPT the public booking surface and
-- the five session-token customer RPCs, which are named below. That direction
-- matters: a new owner RPC is covered automatically the day it is written,
-- while making something public is a deliberate edit to this allowlist that a
-- reviewer will see.
--
-- Arguments are synthesised by type. The values are deliberately meaningless:
-- the guard is the first statement in every one of these functions, so it
-- fires long before anything looks at them. A function that got as far as
-- validating its input would report a different SQLSTATE and fail here, which
-- is exactly the signal wanted.
-- ---------------------------------------------------------------------------

create temp table owner_guard_probe (fn text, sqlstate_out text) on commit drop;

do $guards$
declare
  r record;
  st text;
begin
  for r in
    select p.oid,
           p.proname,
           coalesce((
             select string_agg(l.lit, ', ' order by u.ord)
               from unnest(p.proargtypes) with ordinality as u(t, ord),
               lateral (select case format_type(u.t, null)
                 when 'uuid'                     then '''00000000-0000-0000-0000-0000000000ff''::uuid'
                 when 'text'                     then '''rls-guard-probe'''
                 when 'date'                     then 'current_date'
                 when 'integer'                  then '1'
                 when 'smallint'                 then '1::smallint'
                 when 'boolean'                  then 'false'
                 when 'timestamp with time zone' then 'now()'
                 when 'time without time zone[]' then 'array[]::time[]'
                 when 'appointment_status'       then '''confirmed''::public.appointment_status'
                 else 'null'
               end as lit) l
           ), '') as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prorettype <> 'pg_catalog.trigger'::regtype
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
       -- The public booking surface and the session-token customer RPCs. Each
       -- one is anon-callable by design and carries its own guard: input
       -- validation and a rate limit for the public writes, and
       -- `customer_from_session()` for the five `customer_*` functions.
       -- `is_owner()` itself is here because it is the check, and it returns
       -- false rather than raising.
       and p.proname not in (
         'available_slots','book_appointment','customer_appointments',
         'customer_cancel_appointment','customer_communication_preferences',
         'customer_reschedule_appointment','customer_set_marketing_consent',
         'hair_appointment','public_reviews','public_service_menu',
         'redeem_access_token','submit_contact_message','subscribe_to_updates',
         'track_product_event','unsubscribe_via_link','is_owner')
     order by p.proname
  loop
    -- Same shape as the write probe in §6: role is switched inside the block
    -- and reset before anything is asserted, because pgTAP's plan counter
    -- lives in temp objects owned by the session role.
    begin
      set local role authenticated;
      perform set_config('request.jwt.claims',
                         json_build_object('sub','22222222-2222-2222-2222-222222222222',
                                           'role','authenticated')::text, true);
      execute format('select public.%I(%s)', r.proname, r.args);
      reset role;
      st := 'NONE';
    exception when others then
      st := SQLSTATE;
      reset role;
    end;
    insert into owner_guard_probe values (r.proname, st);
  end loop;
end
$guards$;

-- A floor, not an exact count, so adding an owner RPC does not break the suite
-- while deleting the guards wholesale still would. It was 33 when written.
select cmp_ok((select count(*) from owner_guard_probe), '>=', 30::bigint,
              'the owner-gated RPC surface is still there to be tested');

select is_empty(
  $$select fn || ' returned ' || coalesce(sqlstate_out, 'null')
      from owner_guard_probe where sqlstate_out is distinct from '42501'$$,
  'every owner-gated RPC raises 42501 for a signed-in non-owner');

select * from finish();

rollback;
