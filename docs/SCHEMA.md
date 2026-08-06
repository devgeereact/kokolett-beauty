# Database Schema — Kokolett Beauty UK

Postgres on Supabase. Migrations are numbered and append-only:

| File                                 | Contents                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| `supabase/migrations/0001_init.sql`  | `profiles`, `app_settings`, `set_updated_at()`, `handle_new_user()` |
| `supabase/migrations/0002_salon.sql` | Everything below                                                    |

Never edit an applied migration. Add `0003_*.sql`.

---

## 1. Ownership model — read this first

The boilerplate assumes every row belongs to an `auth.users` row and gates access with
`auth.uid() = user_id`. **That pattern does not apply here**, because customers are
deliberately not auth users — the product's core promise is that they never create an
account.

So access is modelled in three tiers:

| Tier         | Who       | Mechanism                                                                                                                             |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Public read  | anyone    | Explicit allow-list policies on `services`, `service_categories`, `availability_rules`, `availability_exceptions`, `booking_settings` |
| Public write | anyone    | **None directly.** Bookings go through `book_appointment()` (`security definer`). Availability requests have a narrow INSERT policy   |
| Owner        | the salon | `public.is_owner()` — true when `auth.uid()` is present in `staff`                                                                    |

`is_owner()` reads a table rather than a JWT claim, so access cannot be forged by a
client shaping its own token.

**There is no anonymous SELECT policy on `appointments`, and that is intentional.** Any
policy broad enough to let a customer read their own bookings anonymously would also
expose the salon's whole schedule. Customers read their appointments through an Edge
Function that resolves a magic-link token to a `customer_id` server-side.

## 2. Entity relationships

```
auth.users ──1:1── profiles ──1:1── app_settings
                       │
                       └──1:1── staff                (the owner)

service_categories ──1:N── services
                              │
customers ──1:N── appointments ──N:1──┘
    │                  │
    │                  ├──1:N── email_messages
    │                  └──self── rescheduled_from
    │
    ├──1:N── customer_access_tokens
    └──1:N── availability_requests ──0:1── appointments (converted)

availability_rules       (weekly template)
availability_exceptions  (closures, breaks, extra hours)
booking_settings         (single row)
ai_recommendations       (advisory queue)
```

## 3. Tables

### `staff`

Who counts as the owner. One row in V1; the table exists so multi-stylist in V2 is an
insert rather than a migration of the permission model.

| Column | Type                    | Notes                |
| ------ | ----------------------- | -------------------- |
| `id`   | uuid PK → `profiles.id` |                      |
| `role` | text                    | `'owner'` only in V1 |

### `service_categories`

`id` · `name` (unique) · `slug` (unique) · `sort_order`

### `services`

| Column         | Type                        | Notes                                                      |
| -------------- | --------------------------- | ---------------------------------------------------------- |
| `id`           | uuid PK                     |                                                            |
| `category_id`  | uuid → `service_categories` | nullable, `on delete set null`                             |
| `name`, `slug` | text                        | `slug` unique, used in `/services/:slug`                   |
| `description`  | text                        |                                                            |
| `duration_min` | int                         | chair time, 1–600                                          |
| `buffer_min`   | int                         | clean-down reserved after; default 10                      |
| `price_pence`  | int                         | **integer pence, never a float**                           |
| `image_path`   | text                        | ImageKit path, not a full URL                              |
| `is_active`    | bool                        | hides from booking without deleting history                |
| `archived_at`  | timestamptz                 | soft delete — services are referenced by past appointments |

Index: `services_active_idx (is_active, sort_order) where archived_at is null`.

### `customers`

Passwordless identity. Email is the primary key in practice; mobile is secondary.

| Column                          | Type        | Notes                                                            |
| ------------------------------- | ----------- | ---------------------------------------------------------------- |
| `id`                            | uuid PK     |                                                                  |
| `email`                         | citext      | unique on `lower(email)` among non-deleted rows                  |
| `mobile`, `full_name`, `notes`  | text        | `notes` is owner-private                                         |
| `marketing_consent`             | bool        | separate from booking consent; `consent_updated_at` records when |
| `first_seen_at`, `last_seen_at` | timestamptz |                                                                  |
| `deleted_at`                    | timestamptz | soft delete for GDPR erasure while preserving financial history  |

### `booking_settings`

Single row, enforced by `id boolean primary key default true check (id)`.

| Column                     | Default         | Meaning                                                |
| -------------------------- | --------------- | ------------------------------------------------------ |
| `timezone`                 | `Europe/London` | all local-time reasoning uses this                     |
| `slot_granularity_min`     | 15              | slot alignment                                         |
| `default_buffer_min`       | 10              | fallback when a service sets none                      |
| `lead_time_min`            | 120             | earliest bookable, from now                            |
| `max_horizon_days`         | 90              | furthest bookable                                      |
| `max_appointments_per_day` | 8               | hard daily cap                                         |
| `cancellation_window_h`    | 24              | free-cancellation window                               |
| `approve_first_time`       | true            | **hybrid switch** — off means everyone books instantly |
| `approval_window_h`        | 12              | how long a first-time hold survives                    |
| `google_review_url`        | null            | destination for the review request email               |

### `availability_rules`

Weekly template. `day_of_week` 0–6 with **0 = Sunday**, matching Postgres
`extract(dow …)`. Unique on `(day_of_week, opens_at)` so a day can have split shifts.

### `availability_exceptions`

Date-specific overrides. `kind` ∈ `closure` | `extra_hours` | `break`. A `closure` with
null times is a whole-day closure.

### `appointments`

The core table.

| Column                                                 | Type               | Notes                                                                |
| ------------------------------------------------------ | ------------------ | -------------------------------------------------------------------- |
| `id`                                                   | uuid PK            |                                                                      |
| `reference`                                            | text unique        | `KB-XXXXXX`, ambiguity-free alphabet (no I/O/0/1/B/8)                |
| `customer_id`                                          | uuid → `customers` | `on delete restrict` — never orphan a booking                        |
| `service_id`                                           | uuid → `services`  | `on delete restrict`                                                 |
| `starts_at`, `ends_at`                                 | timestamptz        | **UTC**; `ends_at` includes the buffer                               |
| `status`                                               | enum               | see below                                                            |
| `price_pence`                                          | int                | snapshotted at booking, so later price changes don't rewrite history |
| `customer_note`, `owner_note`                          | text               | owner note is never exposed publicly                                 |
| `source`                                               | text               | `web` \| `owner` \| `availability_request`                           |
| `requires_approval`                                    | bool               | true when booked by a first-time customer                            |
| `approval_deadline`                                    | timestamptz        | `min(now + approval_window_h, starts_at)`                            |
| `approved_at`, `approved_by`                           |                    |                                                                      |
| `rejected_at`, `rejection_reason`                      |                    | includes automatic timeout rejections                                |
| `cancelled_at`, `cancellation_reason`                  |                    |                                                                      |
| `checked_in_at`, `completed_at`, `review_requested_at` |                    |                                                                      |
| `rescheduled_from`                                     | uuid → self        | preserves the chain                                                  |

**Status enum:** `pending_approval` · `confirmed` · `checked_in` · `in_service` ·
`completed` · `cancelled` · `rejected` · `rescheduled` · `no_show`.

**The double-booking guarantee:**

```sql
exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
  where (status in ('pending_approval','confirmed','checked_in','in_service','completed'))
```

`pending_approval` is included deliberately — a first-timer's request must hold the
slot, otherwise two people could be waiting on the same time and approving one would
fail. Application-level "is this slot free?" checks always race; this constraint does
not. Requires `btree_gist`.

Indexes: `starts_at`, `(customer_id, starts_at desc)`, `(status, starts_at)`.

### `availability_requests`

The no-slots path. Captures name, email, mobile, service, `preferred_dates date[]`,
`preferred_times`, `flexibility` (`any`/`morning`/`afternoon`/`evening`) and notes.
Status: `new` → `awaiting_response` → `offer_sent` → `converted` | `declined` |
`expired`. `converted_appointment_id` links to the booking it became.

### `customer_access_tokens`

Magic links. **Only the SHA-256 hash is stored** — a database leak must not yield
working links. `purpose` ∈ `manage` | `booking_offer`. Single use (`used_at`), short
`expires_at`. Partial index on unused tokens.

### `email_messages`

Delivery log and retry queue: `template`, `to_email`, `subject`, optional
`appointment_id` / `customer_id`, `status` (`queued`/`sending`/`sent`/`failed`/
`bounced`), `attempts`, `last_error`, `provider_id`, `scheduled_for`, `sent_at`.
Indexed on `(status, scheduled_for)` so the Inngest worker can claim due rows cheaply.

### `ai_recommendations`

Advisory queue. `kind`, `title`, `rationale`, `payload jsonb`, `confidence` (0–1),
`status` (`pending`/`accepted`/`dismissed`/`expired`), `acted_at`, `acted_by`.
Nothing here mutates the business — accepting a recommendation runs a separate,
explicit action.

## 4. Functions

| Function                       | Security        | Purpose                                        |
| ------------------------------ | --------------- | ---------------------------------------------- |
| `is_owner()`                   | definer, stable | Is the caller the salon owner?                 |
| `set_updated_at()`             | —               | Shared trigger, applied to every mutable table |
| `generate_booking_reference()` | —               | Collision-checked `KB-XXXXXX`                  |
| `book_appointment(...)`        | **definer**     | The single public write path                   |
| `expire_pending_approvals()`   | definer         | Releases stale holds; run hourly via `pg_cron` |

### `book_appointment(p_service_id, p_starts_at, p_full_name, p_email, p_mobile, p_note, p_consent)`

Returns `(appointment_id, reference, status)`. Executed by `anon` and `authenticated`.
Validates, in order:

1. Service exists, is active, not archived → `SERVICE_UNAVAILABLE`
2. Start aligns to `slot_granularity_min` → `SLOT_MISALIGNED`
3. At least `lead_time_min` away → `LEAD_TIME_VIOLATION`
4. Within `max_horizon_days` → `BEYOND_BOOKING_HORIZON`
5. Not inside a closure or break; inside standing hours or an `extra_hours` window →
   `OUTSIDE_AVAILABILITY`
6. Day is under `max_appointments_per_day` → `DAILY_CAPACITY_REACHED`
7. Upserts the customer by lowercased email
8. Decides status: `confirmed` if the customer has any **completed** appointment or
   `approve_first_time` is off; otherwise `pending_approval` with a deadline
9. Inserts — an `exclusion_violation` becomes `SLOT_TAKEN`

Every failure is a named error code, so the UI can render human copy instead of a
Postgres message. Client-side validation exists for speed, not for safety; this
function is the boundary that actually matters.

## 5. RLS summary

| Table                                                                     | anon                    | customer (via Edge Fn)    | owner |
| ------------------------------------------------------------------------- | ----------------------- | ------------------------- | ----- |
| `services`, `service_categories`                                          | SELECT (active)         | ✓                         | ALL   |
| `availability_rules`, `availability_exceptions`, `booking_settings`       | SELECT                  | ✓                         | ALL   |
| `appointments`                                                            | none (RPC only)         | own rows, server-resolved | ALL   |
| `customers`                                                               | none                    | own row, server-resolved  | ALL   |
| `availability_requests`                                                   | INSERT (`status='new'`) | —                         | ALL   |
| `customer_access_tokens`, `email_messages`, `ai_recommendations`, `staff` | none                    | —                         | ALL   |

## 6. Seeding

`0002` inserts the single `booking_settings` row and nothing else. Services, opening
hours, gallery, testimonials and the Google review URL are entered by the owner —
there is no fake seed data, because seed data in production is how a salon ends up
advertising a service it does not offer.

To grant owner access after first sign-in:

```sql
insert into public.staff (id, role)
select id, 'owner' from public.profiles where email = 'owner@example.com';
```

## 7. Scheduled jobs (`pg_cron`)

| Schedule     | Job                                                                  |
| ------------ | -------------------------------------------------------------------- |
| hourly       | `select public.expire_pending_approvals();`                          |
| every 15 min | drain due `email_messages` (via the Inngest endpoint)                |
| daily 06:00  | `ai/daily-insights` — utilisation, waitlist matches, demand patterns |

## 8. Migration `0003_owner_ops.sql`

Added for the owner dashboard. Everything here is additive; `0001` and `0002` are
unchanged.

**Seeds.** Four service categories (Cutting, Colouring, Styling, Treatments) and
standing hours of Tue–Sat 09:00–18:00. Services are still _not_ seeded, for the
reason given in §6 — durations and prices are the owner's to set. The hours are a
placeholder she is expected to correct.

Note this narrows §6's "nothing else": categories and hours are structure, not
claims about the business. A wrong opening time is visible and fixable in one
screen; a wrong price is a promise to a customer.

**Scheduling.** `expire_pending_approvals()` existed in `0002` but nothing called
it, so an unanswered hold occupied its slot forever. Now scheduled hourly at
`:07` via `pg_cron`, wrapped so a plan without the extension logs a notice
instead of failing the migration.

**`appointments_detailed`.** A `security_invoker` view joining appointments to
customer and service, plus `customer_completed_count` — the same "returning"
signal `book_appointment()` acts on. Because it is invoker, RLS on the base
tables still governs it, and anon reads return `[]`.

**Owner RPCs.** All `security definer` with an explicit `is_owner()` guard, and
`execute` revoked from `anon`:

| Function                                     | Purpose                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| `owner_dashboard_summary()`                  | Every headline count in one round trip; returns `jsonb`.    |
| `approve_appointment(uuid)`                  | `pending_approval` → `confirmed`, stamping approver + time. |
| `reject_appointment(uuid, text)`             | `pending_approval` → `rejected` with a reason.              |
| `set_appointment_status(uuid, status, text)` | Check-in → in service → completed, no-show, cancel.         |
| `create_appointment_as_owner(...)`           | Phone and walk-in bookings.                                 |

`set_appointment_status` enforces a transition table rather than accepting any
status: `confirmed` → `checked_in`/`in_service`/`completed`/`cancelled`/`no_show`,
`checked_in` → `in_service`/`completed`/`cancelled`/`no_show`, `in_service` →
`completed`/`cancelled`. Anything else raises `ILLEGAL_TRANSITION`. Terminal
states have no exits.

`create_appointment_as_owner` deliberately bypasses the first-time approval gate
— the owner is looking at the customer — but not `appointments_no_overlap`, so a
phone booking still cannot double-book a web booking.
