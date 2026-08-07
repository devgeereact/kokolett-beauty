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

## 9. Migration `0004_available_slots.sql`

`public.available_slots(p_service_id uuid, p_from date, p_to date)` — the
availability engine. `security definer`, `stable`, executable by `anon` and
`authenticated`.

Returns free slot starts only. It never reveals what is taken, by whom, or how
busy the salon is, which is why availability cannot be computed in the browser:
that would need an anon `SELECT` on `appointments`, and any such policy leaks
the whole schedule.

What it applies, in order: the service must be active; opening rules for the
weekday, minus whole-day closures, plus any `extra_hours` exceptions; slots
snapped to `slot_granularity_min` on the epoch grid so nothing off-grid is ever
offered; `lead_time_min` and `max_horizon_days`; breaks and partial closures;
overlap against live appointments using the same status set as
`appointments_no_overlap`; and `max_appointments_per_day`.

The range is capped at 62 days regardless of what is asked for — it is callable
by `anon`, and an unbounded range is a cheap way to make the database expensive.

Wall-clock windows are converted to instants before slots are generated, so a
day containing a DST change still produces real times.

## 10. Migrations `0005` / `0006` — email outbox and customer sessions

**Outbox.** `email_messages` gains a `payload jsonb` column; bodies are rendered
by the Edge Function from a template name plus that payload, so copy changes are
a deploy rather than a migration. Triggers enqueue in the _same transaction_ as
the booking, which is why an email can never be lost to a failed network call
mid-write — the booking and its notification commit or roll back together.

Enqueued by `notify_appointment_created`, `notify_appointment_status_changed`
and `notify_availability_request`:

| Moment            | Customer                                            | Owner                   |
| ----------------- | --------------------------------------------------- | ----------------------- |
| Booking held      | `booking_held`                                      | `owner_approval_needed` |
| Booking confirmed | `booking_confirmed` + both reminders                | `owner_new_booking`     |
| Approved          | `booking_approved` + both reminders                 | —                       |
| Declined          | `booking_declined`                                  | —                       |
| Cancelled         | `booking_cancelled`                                 | —                       |
| Completed         | `review_request` (+2h, only if a review URL is set) | —                       |
| Enquiry raised    | `request_received`                                  | `owner_new_request`     |

Reminders are queued when the booking becomes live, not by a nightly sweep, so a
scheduler outage delays a reminder instead of losing it. A reminder whose send
time has already passed is not queued at all, and cancelling, declining or
marking a no-show marks any still-queued reminder `failed` — a booking that is
not happening must not still be reminded about.

**Customer sessions.** Customers are not `auth.users`. A single-use magic link is
minted by the `customer-access` Edge Function — not by SQL, because the raw
token must exist only in the email, and a SQL function handing it to the mailer
would have to persist it first. Only the SHA-256 hash reaches
`customer_access_tokens`; `send-emails` scrubs the payload on delivery so no
working link survives in the database.

| Function                                        | Grant           | Purpose                                 |
| ----------------------------------------------- | --------------- | --------------------------------------- |
| `redeem_access_token(text)`                     | anon            | Single-use link → 30-day session token  |
| `customer_from_session(text)`                   | none (internal) | Resolves a session to one `customer_id` |
| `customer_appointments(text)`                   | anon            | That customer's bookings, nobody else's |
| `customer_cancel_appointment(text, uuid, text)` | anon            | Cancel their own, respecting status     |
| `purge_expired_access_tokens()`                 | none            | Daily `pg_cron` sweep of dead tokens    |

`0006` exists because `0005` declared the crypto-using functions with
`set search_path = public` while pgcrypto lives in `extensions` on Supabase, so
`digest()` did not resolve. Pinning a search_path on a security-definer function
is right; pinning it too narrowly is the bug. They now use `public, extensions`.

## 11. Migration `0007` — availability is the gate

A change of booking policy, decided by the owner on 2026-08-07. It replaces the
hybrid trust gate described in §PRD and `PROJECT-MEMORY.md`.

**Before:** availability was generous, trust was the gate. First-time customers
were held for approval; returning ones confirmed instantly.

**After:** the owner publishes exactly the hours she is willing to work, and
anything inside them books instantly — for anyone, new or returning. When
nothing is open the customer submits a request, and it is the _request_ that is
approved. That is what makes a last-minute cancellation reachable.

`approve_first_time` is set `false`. The hybrid machinery stays in the schema
because it costs nothing and is a genuine fallback; turning the flag back on
restores the old behaviour with no migration.

| Function                                                     | Purpose                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `set_day_availability(date, jsonb)`                          | Publish one day's hours. `null` → weekly pattern, `[]` → closed, a list → exactly those windows |
| `open_requests_in_order()`                                   | The queue, oldest first, each row carrying its `queue_position`                                 |
| `offer_slot_to_request(request, service, starts_at, reason)` | Book a requester in, enforcing first-come-first-served                                          |
| `decline_request(request, reason)`                           | Turn one down and email them                                                                    |

**Publishing a day** is expressed as a whole-day closure plus `extra_hours`
windows, which `available_slots()` already understands — a whole-day closure
suppresses the weekday rule, and extra hours are added back independently.
Breaks are deliberately untouched by it: "I am out between 12 and 1" should
survive a change to the day's opening hours.

**First come, first served is enforced in the database, not displayed by the
interface.** `offer_slot_to_request` refuses with `EARLIER_REQUEST_WAITING`, and
names who is ahead, when an older open request also wanted that date — where
"also wanted" means asked for that date or expressed no date preference at all.
Someone who asked for a specific Tuesday is not ahead of you for a Friday.
`p_override_reason` is the deliberate escape hatch: skipping is sometimes right,
but it costs a sentence and the sentence is recorded on the request.

## 12. Migrations `0008`–`0010` — individual slots, and one engine

**`0008` — explicit start times.** `availability_slots (on_date, starts_at)`
holds times the owner publishes one at a time. It is a different statement from
a window:

- a **window** says "I am here between these times, fit what you like inside",
  so the whole service must fit within it;
- a **slot** says "you may start at 14:00", and the appointment runs its natural
  length past that. A published 14:00 is bookable for a 90-minute colour with no
  90-minute window around it; the overlap constraint keeps it honest.

That is the flexibility a one-person salon needs — "I can take you at six if
it's just a trim" is a slot, not an opening hour.

`day_candidate_starts(date, service)` is now the **single source of truth** for
what a day offers, merging windows and explicit slots and subtracting breaks and
closures. Explicit slots win over a window-derived duplicate so the owner's own
act is what shows.

| Function                               | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `day_candidate_starts(date, service)`  | Everything a day offers, before bookings/lead time          |
| `owner_day_slots(date, service)`       | The owner's grid: every slot with source, booked, past, who |
| `add_day_slot(date, time)`             | Publish one start time; refuses off-grid times              |
| `remove_day_slot(date, time)`          | Delete one; returns `false` if it came from a window        |
| `materialise_day_slots(date, service)` | Freeze a window day into an editable slot list              |
| `clear_day_slots(date)`                | Drop every published slot, restoring the day's hours        |

A window slot is computed, not stored, so it cannot be deleted individually.
Rather than silently rewriting the day's hours, `remove_day_slot` returns
`false` and the interface offers to convert the day to exact times.

**`0009` — the writer and the reader must agree.** `book_appointment()` had
re-derived availability from rules and exceptions since `0002`, and that copy
fell behind the engine twice: `0007`'s published hours (a whole-day closure plus
extra hours) made it reject its own slots with `OUTSIDE_AVAILABILITY`, and
`0008`'s explicit slots were invisible to it. **Every day of custom published
hours was visible and unbookable.** Booking now asks `day_candidate_starts()`
instead of reimplementing it — the two cannot drift apart if there is only one
of them. Grid alignment, lead time, horizon and the daily cap stay on the write
path, where they belong.

**`0010` — no reminders in the past.** The insert trigger queued a 24-hour
reminder unconditionally, so a booking made for later the same day got one dated
in the past, which the drain would send immediately — telling someone their
appointment is "tomorrow" three hours before it starts. The approval path had
this guard; the insert path never did, and since `0007` made instant
confirmation normal, the unguarded path became the usual one. Already-stale rows
are retired by the migration.
