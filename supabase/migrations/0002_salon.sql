-- =====================================================================
-- 0002_salon.sql — Kokolett Beauty UK domain schema
--
-- Additive and idempotent. Never edit 0001_init.sql.
--
-- Ownership model note: customers are NOT auth.users. They are identified by
-- email and reached through single-use magic-link tokens. Therefore the
-- boilerplate's `auth.uid() = user_id` pattern does not apply to most tables.
-- Instead:
--   * `public.is_owner()` gates every staff mutation.
--   * Anonymous reads are explicit allow-lists (active services, availability).
--   * Anonymous writes go through `security definer` functions that validate
--     the request server-side. There is no raw anon INSERT on appointments.
-- =====================================================================

-- Extensions must exist before any table that uses their types.
-- `citext` backs public.customers.email; `btree_gist` backs the appointment
-- EXCLUDE constraint that makes double-booking impossible.
create extension if not exists btree_gist;
create extension if not exists citext;

-- ---------- Enums -----------------------------------------------------
do $$ begin
  create type public.appointment_status as enum (
    'pending_approval', 'confirmed', 'checked_in', 'in_service', 'completed',
    'cancelled', 'rejected', 'rescheduled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.availability_request_status as enum (
    'new', 'awaiting_response', 'offer_sent', 'converted', 'declined', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_status as enum (
    'queued', 'sending', 'sent', 'failed', 'bounced'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recommendation_status as enum (
    'pending', 'accepted', 'dismissed', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exception_kind as enum ('closure', 'extra_hours', 'break');
exception when duplicate_object then null; end $$;

-- ---------- Staff (who counts as "the owner") -------------------------
create table if not exists public.staff (
  id          uuid primary key references public.profiles(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner')),
  created_at  timestamptz not null default timezone('utc', now())
);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff s where s.id = auth.uid());
$$;

-- ---------- Service catalogue ----------------------------------------
create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.service_categories(id) on delete set null,
  name          text not null,
  slug          text not null unique,
  description   text,
  duration_min  integer not null check (duration_min > 0 and duration_min <= 600),
  buffer_min    integer not null default 10 check (buffer_min >= 0),
  price_pence   integer not null check (price_pence >= 0),
  image_path    text,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  archived_at   timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index if not exists services_active_idx
  on public.services (is_active, sort_order) where archived_at is null;

-- ---------- Customers (passwordless, not auth.users) ------------------
create table if not exists public.customers (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null,
  mobile             text,
  full_name          text not null,
  notes              text,
  marketing_consent  boolean not null default false,
  consent_updated_at timestamptz,
  first_seen_at      timestamptz not null default timezone('utc', now()),
  last_seen_at       timestamptz,
  deleted_at         timestamptz,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

create unique index if not exists customers_email_key
  on public.customers (lower(email::text)) where deleted_at is null;
create index if not exists customers_mobile_idx on public.customers (mobile);

-- ---------- Booking settings (single row) -----------------------------
create table if not exists public.booking_settings (
  id                       boolean primary key default true check (id),
  timezone                 text    not null default 'Europe/London',
  slot_granularity_min     integer not null default 15 check (slot_granularity_min between 5 and 60),
  default_buffer_min       integer not null default 10 check (default_buffer_min >= 0),
  lead_time_min            integer not null default 120 check (lead_time_min >= 0),
  max_horizon_days         integer not null default 90 check (max_horizon_days between 1 and 365),
  max_appointments_per_day integer not null default 8 check (max_appointments_per_day > 0),
  cancellation_window_h    integer not null default 24 check (cancellation_window_h >= 0),
  -- Hybrid booking policy: returning customers are confirmed instantly,
  -- first-time customers are held for owner approval.
  approve_first_time       boolean not null default true,
  approval_window_h        integer not null default 12 check (approval_window_h > 0),
  google_review_url        text,
  created_at               timestamptz not null default timezone('utc', now()),
  updated_at               timestamptz not null default timezone('utc', now())
);

insert into public.booking_settings (id) values (true) on conflict (id) do nothing;

-- ---------- Availability ----------------------------------------------
create table if not exists public.availability_rules (
  id           uuid primary key default gen_random_uuid(),
  day_of_week  smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  opens_at     time not null,
  closes_at    time not null,
  is_open      boolean not null default true,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  constraint availability_rules_window check (closes_at > opens_at),
  constraint availability_rules_unique unique (day_of_week, opens_at)
);

create table if not exists public.availability_exceptions (
  id          uuid primary key default gen_random_uuid(),
  kind        public.exception_kind not null,
  on_date     date not null,
  starts_at   time,
  ends_at     time,
  reason      text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  constraint availability_exceptions_window
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists availability_exceptions_date_idx
  on public.availability_exceptions (on_date);

-- ---------- Appointments ----------------------------------------------
create table if not exists public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  customer_id         uuid not null references public.customers(id) on delete restrict,
  service_id          uuid not null references public.services(id) on delete restrict,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              public.appointment_status not null default 'confirmed',
  price_pence         integer not null check (price_pence >= 0),
  customer_note       text,
  owner_note          text,
  source              text not null default 'web'
                        check (source in ('web', 'owner', 'availability_request')),
  rescheduled_from    uuid references public.appointments(id) on delete set null,
  requires_approval   boolean not null default false,
  approval_deadline   timestamptz,
  approved_at         timestamptz,
  approved_by         uuid references public.profiles(id) on delete set null,
  rejected_at         timestamptz,
  rejection_reason    text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  checked_in_at       timestamptz,
  completed_at        timestamptz,
  review_requested_at timestamptz,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),
  constraint appointments_window check (ends_at > starts_at)
);

-- The double-booking guarantee. Application-level checks always race; this does
-- not. "Live" states occupy the calendar — and pending_approval counts as live,
-- so a first-time customer's request holds the slot while the owner decides.
-- Without that, two people could hold the same slot and approval would fail.
alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_approval', 'confirmed', 'checked_in',
                      'in_service', 'completed'));

create index if not exists appointments_starts_at_idx on public.appointments (starts_at);
create index if not exists appointments_customer_idx  on public.appointments (customer_id, starts_at desc);
create index if not exists appointments_status_idx    on public.appointments (status, starts_at);

-- ---------- Availability requests (the no-slots path) -----------------
create table if not exists public.availability_requests (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid references public.customers(id) on delete set null,
  full_name        text not null,
  email            text not null,
  mobile           text,
  service_id       uuid references public.services(id) on delete set null,
  preferred_dates  date[] not null default '{}',
  preferred_times  text,
  flexibility      text not null default 'any'
                     check (flexibility in ('any', 'morning', 'afternoon', 'evening')),
  notes            text,
  status           public.availability_request_status not null default 'new',
  owner_response   text,
  responded_at     timestamptz,
  converted_appointment_id uuid references public.appointments(id) on delete set null,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

create index if not exists availability_requests_status_idx
  on public.availability_requests (status, created_at desc);

-- ---------- Customer access tokens (magic links) ----------------------
-- Only the SHA-256 hash is stored. The raw token exists solely in the email.
create table if not exists public.customer_access_tokens (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  token_hash   text not null unique,
  purpose      text not null default 'manage'
                 check (purpose in ('manage', 'booking_offer')),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists customer_access_tokens_lookup_idx
  on public.customer_access_tokens (token_hash) where used_at is null;

-- ---------- Email delivery log ----------------------------------------
create table if not exists public.email_messages (
  id             uuid primary key default gen_random_uuid(),
  template       text not null,
  to_email       text not null,
  subject        text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id    uuid references public.customers(id) on delete set null,
  status         public.email_status not null default 'queued',
  attempts       integer not null default 0,
  last_error     text,
  provider_id    text,
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

create index if not exists email_messages_status_idx
  on public.email_messages (status, scheduled_for);

-- ---------- AI recommendations (advisory only) ------------------------
create table if not exists public.ai_recommendations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  title       text not null,
  rationale   text,
  payload     jsonb not null default '{}'::jsonb,
  confidence  numeric(3,2) check (confidence between 0 and 1),
  status      public.recommendation_status not null default 'pending',
  acted_at    timestamptz,
  acted_by    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists ai_recommendations_status_idx
  on public.ai_recommendations (status, created_at desc);

-- ---------- updated_at triggers ---------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'service_categories','services','customers','booking_settings',
    'availability_rules','availability_exceptions','appointments',
    'availability_requests','email_messages','ai_recommendations'
  ] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Booking reference generator -------------------------------
create or replace function public.generate_booking_reference()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ACDEFGHJKLMNPQRSTUVWXYZ2345679'; -- no I/O/0/1/B/8
  candidate text;
begin
  loop
    candidate := 'KB-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.appointments a where a.reference = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------- Atomic instant booking ------------------------------------
-- The single write path for public bookings. Validates the slot against
-- opening hours, exceptions, lead time, horizon and the daily cap, then
-- inserts. Concurrency is settled by appointments_no_overlap, so a losing
-- racer gets a clean "slot just taken" error rather than a double booking.
create or replace function public.book_appointment(
  p_service_id  uuid,
  p_starts_at   timestamptz,
  p_full_name   text,
  p_email       text,
  p_mobile      text default null,
  p_note        text default null,
  p_consent     boolean default false
)
returns table (appointment_id uuid, reference text, status public.appointment_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings   public.booking_settings%rowtype;
  v_service    public.services%rowtype;
  v_ends_at    timestamptz;
  v_local_date date;
  v_local_time time;
  v_dow        smallint;
  v_customer   uuid;
  v_ref        text;
  v_id         uuid;
  v_returning  boolean;
  v_status     public.appointment_status;
  v_deadline   timestamptz;
begin
  select * into v_settings from public.booking_settings where id;
  select * into v_service  from public.services
    where id = p_service_id and is_active and archived_at is null;

  if v_service.id is null then
    raise exception 'SERVICE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Slots are aligned to the configured granularity; anything else is forged.
  if extract(epoch from p_starts_at)::bigint % (v_settings.slot_granularity_min * 60) <> 0 then
    raise exception 'SLOT_MISALIGNED' using errcode = 'P0001';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.lead_time_min) then
    raise exception 'LEAD_TIME_VIOLATION' using errcode = 'P0001';
  end if;

  if p_starts_at > now() + make_interval(days => v_settings.max_horizon_days) then
    raise exception 'BEYOND_BOOKING_HORIZON' using errcode = 'P0001';
  end if;

  v_ends_at    := p_starts_at + make_interval(mins => v_service.duration_min + v_service.buffer_min);
  v_local_date := (p_starts_at at time zone v_settings.timezone)::date;
  v_local_time := (p_starts_at at time zone v_settings.timezone)::time;
  v_dow        := extract(dow from (p_starts_at at time zone v_settings.timezone))::smallint;

  -- Full-day closure or a break covering the slot?
  if exists (
    select 1 from public.availability_exceptions e
    where e.on_date = v_local_date
      and (
        (e.kind = 'closure' and e.starts_at is null)
        or (e.kind in ('closure','break')
            and e.starts_at is not null
            and v_local_time < e.ends_at
            and (v_local_time + make_interval(mins => v_service.duration_min))::time > e.starts_at)
      )
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  -- Inside standing hours, or inside an explicit extra-hours window?
  if not exists (
    select 1 from public.availability_rules r
    where r.day_of_week = v_dow and r.is_open
      and v_local_time >= r.opens_at
      and (v_local_time + make_interval(mins => v_service.duration_min))::time <= r.closes_at
  ) and not exists (
    select 1 from public.availability_exceptions e
    where e.on_date = v_local_date and e.kind = 'extra_hours'
      and v_local_time >= e.starts_at
      and (v_local_time + make_interval(mins => v_service.duration_min))::time <= e.ends_at
  ) then
    raise exception 'OUTSIDE_AVAILABILITY' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.appointments a
    where a.status in ('pending_approval','confirmed','checked_in','in_service','completed')
      and (a.starts_at at time zone v_settings.timezone)::date = v_local_date
  ) >= v_settings.max_appointments_per_day then
    raise exception 'DAILY_CAPACITY_REACHED' using errcode = 'P0001';
  end if;

  -- Upsert the customer. Identity is email; mobile is secondary.
  insert into public.customers (email, full_name, mobile, marketing_consent, consent_updated_at, last_seen_at)
  values (p_email, p_full_name, p_mobile, p_consent,
          case when p_consent then now() end, now())
  on conflict (lower(email::text)) where deleted_at is null
  do update set
    full_name         = excluded.full_name,
    mobile            = coalesce(excluded.mobile, public.customers.mobile),
    marketing_consent = public.customers.marketing_consent or excluded.marketing_consent,
    last_seen_at      = now()
  returning id into v_customer;

  -- Hybrid policy. "Returning" means this customer has at least one appointment
  -- that actually happened. A prior cancellation or no-show does not earn trust.
  select exists (
    select 1 from public.appointments a
    where a.customer_id = v_customer
      and a.status = 'completed'
  ) into v_returning;

  if v_returning or not v_settings.approve_first_time then
    v_status   := 'confirmed';
    v_deadline := null;
  else
    v_status   := 'pending_approval';
    -- Give the owner a bounded window, and never let the hold outlive the slot.
    v_deadline := least(
      now() + make_interval(hours => v_settings.approval_window_h),
      p_starts_at
    );
  end if;

  v_ref := public.generate_booking_reference();

  begin
    insert into public.appointments
      (reference, customer_id, service_id, starts_at, ends_at, price_pence,
       customer_note, source, status, requires_approval, approval_deadline,
       approved_at)
    values
      (v_ref, v_customer, v_service.id, p_starts_at, v_ends_at, v_service.price_pence,
       p_note, 'web', v_status, not v_returning, v_deadline,
       case when v_status = 'confirmed' then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return query select v_id, v_ref, v_status;
end;
$$;

revoke all on function public.book_appointment(uuid, timestamptz, text, text, text, text, boolean) from public;
grant execute on function public.book_appointment(uuid, timestamptz, text, text, text, text, boolean) to anon, authenticated;

-- ---------- Expire stale approval holds --------------------------------
-- A pending request that the owner never answers must release its slot, or the
-- calendar silently fills with dead holds. Schedule hourly via pg_cron.
create or replace function public.expire_pending_approvals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with expired as (
    update public.appointments
       set status = 'rejected',
           rejected_at = now(),
           rejection_reason = 'Approval window elapsed'
     where status = 'pending_approval'
       and approval_deadline is not null
       and approval_deadline < now()
    returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;

-- ---------- Theme: allow 'system' (0001 shipped dark/light only) ------
alter table public.app_settings drop constraint if exists app_settings_theme_check;
alter table public.app_settings
  add constraint app_settings_theme_check check (theme in ('dark', 'light', 'system'));
alter table public.app_settings alter column theme set default 'system';

-- ---------- Row Level Security ----------------------------------------
alter table public.staff                   enable row level security;
alter table public.service_categories      enable row level security;
alter table public.services                enable row level security;
alter table public.customers               enable row level security;
alter table public.booking_settings        enable row level security;
alter table public.availability_rules      enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.appointments            enable row level security;
alter table public.availability_requests   enable row level security;
alter table public.customer_access_tokens  enable row level security;
alter table public.email_messages          enable row level security;
alter table public.ai_recommendations      enable row level security;

-- Public read surface: only what the booking UI legitimately needs.
drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services
  for select using (is_active and archived_at is null);

drop policy if exists service_categories_public_read on public.service_categories;
create policy service_categories_public_read on public.service_categories
  for select using (true);

drop policy if exists availability_rules_public_read on public.availability_rules;
create policy availability_rules_public_read on public.availability_rules
  for select using (true);

drop policy if exists availability_exceptions_public_read on public.availability_exceptions;
create policy availability_exceptions_public_read on public.availability_exceptions
  for select using (true);

drop policy if exists booking_settings_public_read on public.booking_settings;
create policy booking_settings_public_read on public.booking_settings
  for select using (true);

-- Availability requests: anyone may submit one; only the owner may read them.
drop policy if exists availability_requests_public_insert on public.availability_requests;
create policy availability_requests_public_insert on public.availability_requests
  for insert with check (status = 'new' and converted_appointment_id is null);

-- Owner: full control everywhere.
do $$
declare t text;
begin
  foreach t in array array[
    'staff','service_categories','services','customers','booking_settings',
    'availability_rules','availability_exceptions','appointments',
    'availability_requests','customer_access_tokens','email_messages',
    'ai_recommendations'
  ] loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format(
      'create policy %I_owner_all on public.%I for all
         using (public.is_owner()) with check (public.is_owner())', t, t);
  end loop;
end $$;

-- Customers never read the appointments table directly. Their view is served by
-- an Edge Function that resolves a magic-link token to a customer_id and returns
-- only that customer's rows. No anon SELECT policy on appointments is granted,
-- which is deliberate: an anon policy broad enough to be useful would leak the
-- salon's entire schedule.
