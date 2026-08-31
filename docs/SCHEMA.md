# Database Schema — Kokolett Beauty UK

Postgres on Supabase. Migrations are numbered and append-only, `0001` through `0068`,
applied in filename order. **Never edit an applied migration**; correct it with a
follow-up file. (`0024`/`0025` were edited in place once, after they were live; `0026`
redid the fix properly.)

`0001_init.sql` creates `profiles`, `app_settings`, `set_updated_at()` and
`handle_new_user()`. `0002_salon.sql` creates the salon domain. Everything after that
reshapes it, and some of it is load-bearing for reading the rest of this document:

| Migration                                         | What it changed                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0011_slots_are_the_model.sql`                    | **Dropped `availability_rules` and `availability_exceptions`.** Published availability is now explicit rows in `availability_slots`. The two sections below describing those tables are history. |
| `0022_slots_and_mail_keep_their_promises.sql`     | Rewrote `book_appointment()` to its current 6-argument form (no `p_service_id`) and fixed the BST slot-alignment bug.                                                                            |
| `0027_payment_log.sql`                            | Added `payments`. `appointments.price_pence` is a placeholder that defaults to 0; money actually taken lives in `payments`.                                                                      |
| `0032_email_templates.sql`                        | Added `email_templates`, the owner's editable overlay.                                                                                                                                           |
| `0037_email_templates_opt_in.sql`                 | Made that overlay opt-in, so a seeded draft cannot replace tested copy.                                                                                                                          |
| `0038_close_privileged_grants.sql`                | Revoked `drain_email_queue()`, `sync_google_reviews()` and `booked_times_on()` from every client role; dropped the public read on `google_place_snapshot`.                                       |
| `0039_book_appointment_input_rules.sql`           | Email validation, length ceilings and a per-address rate limit on the public booking path.                                                                                                       |
| `0040_email_status_cancelled.sql`                 | `cancelled` joins the email status enum, so a retired reminder stops being counted as a delivery failure on the owner's Email screen.                                                            |
| `0041_cancellation_reaches_the_owner.sql`         | A cancellation now emails the owner, not only the in-app notification feed.                                                                                                                      |
| `0042_erasing_a_customer_leaves_nothing.sql`      | Erasure reaches the four other tables that held personal data — the mailing list, enquiries, the outbox and access tokens.                                                                       |
| `0043_trigger_functions_are_not_api.sql`          | Revoked the default `execute to public` on seven `security definer` trigger functions; the triggers themselves are unaffected.                                                                   |
| `0044_finish_the_erasures_already_requested.sql`  | Re-ran the full erasure over every customer already carrying a `deleted_at` from the weaker `0035` path.                                                                                         |
| `0045_availability_reaches_the_whole_horizon.sql` | `available_slots` scanned a hard-coded 62 days while `max_horizon_days` is 90. The cap is now the setting.                                                                                       |
| `0046_personal_data_stops_accumulating.sql`       | Put a retention end date on `email_messages` and `availability_requests`, which held personal data indefinitely.                                                                                 |
| `0047_contact_message.sql`                        | Added `submit_contact_message()` for the marketing Contact page's message form. No new table — it queues into `email_messages` like every other notification.                                   |
| `0048_public_menu_shows_duration_and_image.sql`   | Public `service_menu` reads now include `duration_min` and `image_path` so the marketing site can show them.                                                                                     |
| `0049_contact_messages_are_rate_limited.sql`       | Per-address rate limit on `submit_contact_message()`, matching the booking path's abuse protection.                                                                                              |
| `0050_about_photo_path.sql`                        | Added the owner's About-page photo path to `booking_settings`.                                                                                                                                    |
| `0051_secret_owner_login.sql`                      | Added `staff.login_slug`/`login_slug_updated_at` and the `secret_login_attempts` lockout table for the secret owner sign-in link.                                                                |
| `0052_audit_trail.sql`                              | Added `audit_events` (SELECT-only, owner-read, no write policy for anyone) and `log_audit_event()`, called from the appointment lifecycle RPCs, `erase_customer_as_owner`, `log_payment` and `set_owner_login_slug`. Scoped to the highest-risk actions only — see `docs/KOKO_GAP.md` for what's deliberately out of scope. |
| `0053_system_health.sql`                            | Added `system_health_summary()` — no new table; reads pg_cron's own `cron.job`/`cron.job_run_details` plus existing email/reviews staleness signals. Powers `/dashboard/system-health`. |
| `0054_daily_close.sql`                               | Added `close_day()` and a new `day.closed` value in `audit_events.action`'s check constraint — no new table. Superseded by `0055`; left as originally applied rather than edited in place (same precedent as `0024`/`0025`→`0026`). |
| `0055_daily_close_split_preview.sql`                 | Split `close_day()` into a read-only `daily_close_summary()` (the live preview) plus `close_day()` calling it and logging the result — calling the logging function just to preview would have spuriously written a `day.closed` row on every page visit. |
| `0056_customer_data_export.sql`                     | Added `export_customer_data()` and a new `customer.data_exported` value in `audit_events.action`'s check constraint — no new table. The GDPR subject-access counterpart to `erase_customer_as_owner` (`0042`): same tables, read instead of deleted. |
| `0057_drop_ai_recommendations.sql`                  | Dropped `ai_recommendations` and `recommendation_status` — confirmed dead across every audit this session, owner-approved for removal 2026-08-30. Does not affect the AI chat's ability to draft messages (`ai-assistant-chat`), which never used this table. |
| `0058_broadcast_messaging.sql`                      | Added `send_broadcast_as_owner()` and `unsubscribe_via_link()`, and a new `broadcast.sent` value in `audit_events.action`'s check constraint — no new table. Broadcast messaging uses the existing email outbox queue. `unsubscribe_via_link()` is anon-callable by design, since a visitor clicking the link has no session. |
| `0059_payment_corrections.sql`                      | Added `payments.corrects_payment_id` (nullable FK to `payments.id`) and loosened the `amount_pence` check to allow negative only when `corrects_payment_id` is set (a plain payment must still be positive). `log_payment()` gained an optional `p_corrects_payment_id` param and validates the linked payment is on the same appointment. |
| `0060_customer_communication_preferences.sql`       | Added `customer_communication_preferences()` and `customer_set_marketing_consent()` — no new table, no new column. Session-scoped RPCs (via `customer_from_session()`, `0021`) so a customer on `/my` can read and change her own `customers.marketing_consent` without asking the owner. |
| `0061_email_template_history.sql`                   | Added `email_template_revisions` (append-only) and a `before update` trigger on `email_templates` that logs the old subject/html_body whenever either actually changes. No revert RPC — a revert is just a normal update with an earlier revision's content, which the same trigger logs again. |
| `0062_customer_session_revocation.sql`              | Added `revoke_customer_sessions()` and a new `customer.sessions_revoked` value in `audit_events.action`'s check constraint — no new table. Marks a customer's live `customer_access_tokens` (`purpose = 'session'`) as used, which `customer_from_session()` (`0021`) already treats as invalid. |
| `0063_undo_cancellation.sql`                        | `set_appointment_status()` now allows `cancelled` → confirmed/checked_in/in_service (previously nothing), clearing `cancelled_at`/`cancellation_reason` on the way back. `notify_appointment_status_changed()` gained a matching branch: fails the queued cancellation-notice emails and re-queues the reminders the cancellation retired. |
| `0064_product_events.sql`                           | Added `product_events` (no personal data — event name from a fixed vocabulary, a random client-generated session id, timestamp), `track_product_event()` (anon-callable, rate-limited) and `product_event_funnel_summary()` (owner-only). First-party booking-funnel counts. |
| `0065_copy_dashes_and_owner_name.sql`               | Data-only. Removes four em dashes from the customer-facing `email_templates` bodies seeded by `0032`, and corrects the owner's name from "Koko"/"Koko Lett" to Christy in the confirmation sign-off and the password-reset greeting. |
| `0066_retire_locs.sql`                              | Data-only. Deactivates the five loc styles seeded by `0018` and renames the `service_menu` group from "Twists and locs" to "Twists". The salon does not do locs. |
| `0067_review_link_in_template_overlay.sql`          | Data-only. Appends a `{{google_review_url}}` link to the `review_request` and `appointment_completed` overlay bodies, which `0032` seeded without one. Conditional, so an owner-rewritten template is untouched. |
| `0068_locs_safety_net.sql`                          | Data-only. Deactivates any `service_menu` row whose name matches the word "loc", and renames any such group to "Twists". `0066` matched five exact strings inside one group name, all owner-editable; this matches on the word instead. A no-op today. |

### Every table, and where it is documented

**Twenty-three tables are live.** Twenty-six were created; `0011` dropped
`availability_rules` and `availability_exceptions`, and `0057` dropped
`ai_recommendations` — all three §3 sections still carrying their names are marked
as history rather than schema. Of the twenty-three, §3 details the nine surviving
from `0001`/`0002`; the fourteen added later are summarised here, with the
migration that created them as the authoritative source.

| Table                   | Created by | What it holds                                                                                                                    |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | `0001`     | `auth.users` mirror: `id`, `email`, `full_name`, `avatar_url`                                                                    |
| `app_settings`          | `0001`     | per-user `theme` (`dark`/`light`) and `notifications_enabled`, one row per profile                                               |
| `availability_slots`    | `0011`     | **the availability model.** One row = one bookable start: `on_date`, `starts_at`, `note`; unique on the pair                     |
| `weekly_template`       | `0013`     | the repeating week: `day_of_week` (0 = Sunday), `starts_at`. Rolled forward nightly by `extend-weekly-template`                  |
| `day_decided`           | `0013`     | `on_date` primary key + `decided_by` (`owner`/`template`) — records a deliberate closure so the template can't refill it         |
| `service_menu`          | `0018`     | website menu copy: `group_name`, `name`, `note`, `sort_order`, `active`; `0031` added `duration_min`, `buffer_min`, `image_path` |
| `payments`              | `0027`, `corrects_payment_id` added by `0059` | money actually taken: `appointment_id`, `amount_pence` (> 0, or negative when `corrects_payment_id` links it to an earlier payment on the same appointment), `note`, `recorded_by`. `appointments.price_pence` stays 0 |
| `email_templates`       | `0032`     | owner-editable overlay keyed by template `key`; `0037` added `include_in_automation`, default-off in practice                    |
| `email_template_revisions` | `0061`  | append-only history of `email_templates`: `template_key`, `subject`, `html_body`, `created_at`. Written only by a trigger, never inserted directly; SELECT-only for the owner |
| `google_reviews`        | `0017`     | synced review cache: `author_name`, `rating`, `body`, `published_at`, `fetched_at`                                               |
| `google_place_snapshot` | `0017`     | single-row (`id boolean primary key`) aggregate: `rating`, `rating_count`, `last_error`. `0038` removed its public read          |
| `calendar_feeds`        | `0019`     | ICS feed tokens: `token_hash`, `label`, `fetch_count`, `revoked_at`. The raw token exists only in the URL                        |
| `subscribers`           | `0017`     | mailing list: `email` (citext, unique), `source`, `confirmed`, `unsubscribed_at`                                                 |
| `secret_login_attempts` | `0051`     | hashed-IP lockout counter for the secret owner login (`ip_hash`, `attempted_at`); no anon/authenticated policies, service-role only |
| `audit_events`          | `0052`, action vocabulary extended by `0054`, `0056`, `0058` and `0062` | immutable log of the highest-risk owner actions: `actor`, `action`, `entity_type`, `entity_id`, `summary`, `old_value`/`new_value` jsonb. SELECT-only for the owner; no insert/update/delete policy for any role, including the owner |
| `product_events`        | `0064`     | first-party booking-funnel counts, no personal data: `event_name` (fixed vocabulary), `session_id` (random, client-generated), `metadata` jsonb, `created_at`. Written only by `track_product_event()`, rate-limited; SELECT-only for the owner |

Columns added to `0002` tables since: `booking_settings` gained `instagram_url`,
`google_place_id`, `address_line`, `phone` (`0017`) and `business_name`,
`business_category`, `country` (`0033`); `availability_requests` gained `owner_note`
(`0030`); `email_messages` gained `payload jsonb` (`0005`).

**`ai_recommendations` was dropped (`0057`, 2026-08-30).** Created by `0002`, never
read or written by anything — the shipped assistant is `src/lib/insights.ts`
(client-side) plus the `ai-assistant-chat` Edge Function; neither ever used a queue.
See `docs/ARCHITECTURE.md` §6b.

**§8 onwards is a migration-by-migration narrative that stops at `0027`.** For
`0028`–`0046` the table above and `supabase/migrations/` are the record; the summary
table at the top of this document covers the load-bearing ones. Each of those files
opens with a comment explaining what it changed and why — that header is the primary
source for anything past `0027`, not this document.

---

## 1. Ownership model — read this first

The boilerplate assumes every row belongs to an `auth.users` row and gates access with
`auth.uid() = user_id`. **That pattern does not apply here**, because customers are
deliberately not auth users — the product's core promise is that they never create an
account.

So access is modelled in three tiers:

| Tier         | Who       | Mechanism                                                                                                                           |
| ------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Public read  | anyone    | Explicit allow-list policies on `services`, `service_categories`, `availability_slots`, `weekly_template`, `booking_settings`       |
| Public write | anyone    | **None directly.** Bookings go through `book_appointment()` (`security definer`). Availability requests have a narrow INSERT policy |
| Owner        | the salon | `public.is_owner()` — true when `auth.uid()` is present in `staff`                                                                  |

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

availability_slots       (the availability model: one row = one bookable start)
weekly_template          (the repeating week, a generator for the above)
day_decided              (dates already ruled on, so the generator skips them)
booking_settings         (single row)
```

## 3. Tables

### `staff`

Who counts as the owner. One row in V1; the table exists so multi-stylist in V2 is an
insert rather than a migration of the permission model.

| Column                    | Type                    | Notes                                                    |
| ------------------------- | ----------------------- | --------------------------------------------------------- |
| `id`                      | uuid PK → `profiles.id` |                                                            |
| `role`                    | text                    | `'owner'` only in V1                                       |
| `login_slug`              | text, unique            | `0051`. The single path segment that resolves to the owner login form; changeable by the owner |
| `login_slug_updated_at`   | timestamptz             | `0051`. Set whenever `login_slug` changes                  |

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

| Column                          | Type        | Notes                                                                                                                   |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `id`                            | uuid PK     |                                                                                                                         |
| `email`                         | citext      | unique on `lower(email)` among non-deleted rows                                                                         |
| `mobile`, `full_name`, `notes`  | text        | `notes` is owner-private                                                                                                |
| `marketing_consent`             | bool        | separate from booking consent; `consent_updated_at` records when                                                        |
| `first_seen_at`, `last_seen_at` | timestamptz |                                                                                                                         |
| `deleted_at`                    | timestamptz | set only by `erase_customer_as_owner` when payments force the row to be kept; the row is anonymised, not merely flagged |

### `booking_settings`

Single row, enforced by `id boolean primary key default true check (id)`.

| Column                     | Default         | Meaning                                                                                                                                                                                                                    |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timezone`                 | `Europe/London` | all local-time reasoning uses this                                                                                                                                                                                         |
| `slot_granularity_min`     | 15              | slot alignment                                                                                                                                                                                                             |
| `default_buffer_min`       | 10              | fallback when a service sets none                                                                                                                                                                                          |
| `lead_time_min`            | 120             | earliest bookable, from now                                                                                                                                                                                                |
| `max_horizon_days`         | 90              | furthest bookable                                                                                                                                                                                                          |
| `max_appointments_per_day` | 8               | hard daily cap                                                                                                                                                                                                             |
| `cancellation_window_h`    | 24              | free-cancellation window                                                                                                                                                                                                   |
| `approve_first_time`       | true            | **hybrid switch** — off means everyone books instantly. The column default is `true`, but `0007` set the live row `false` and it has stayed there; read the row, not this column, before reasoning about booking behaviour |
| `approval_window_h`        | 12              | how long a first-time hold survives                                                                                                                                                                                        |
| `google_review_url`        | null            | destination for the review request email                                                                                                                                                                                   |

### `availability_rules` — **dropped by `0011`, kept here as history**

### `availability_exceptions` — **dropped by `0011`, kept here as history**

Neither table exists. `0011_slots_are_the_model.sql` dropped both; published
availability is now explicit rows in `availability_slots`, generated by
`weekly_template` and fenced by `day_decided` (§13). They are described in §13 and
the history is worth reading — four overlapping ways to say when the owner was free
is what the rebuild removed — but nothing in the running system reads either name.

For the record, as they were: `availability_rules` was the weekly template,
`day_of_week` 0–6 with **0 = Sunday**, unique on `(day_of_week, opens_at)` so a day
could have split shifts. `availability_exceptions` held date-specific overrides,
`kind` ∈ `closure` | `extra_hours` | `break`, a null-timed `closure` meaning the
whole day.

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
Indexed on `(status, scheduled_for)` so the scheduled `drain_email_queue()` job (pg_cron + pg_net) can claim due rows cheaply.

### `ai_recommendations` — **dropped, `0057` (2026-08-30)**

Was an advisory queue as designed: `kind`, `title`, `rationale`, `payload jsonb`,
`confidence` (0–1), `status` (`pending`/`accepted`/`dismissed`/`expired`), `acted_at`,
`acted_by`. Never read or written by anything the app shipped — the assistant that
exists is `src/lib/insights.ts` computed client-side, plus the `ai-assistant-chat`
Edge Function whose proposals are confirmed by the owner in the browser. Confirmed
dead across every audit before dropping; see `docs/ARCHITECTURE.md` §6b.

## 4. Functions

| Function                       | Security        | Purpose                                        |
| ------------------------------ | --------------- | ---------------------------------------------- |
| `is_owner()`                   | definer, stable | Is the caller the salon owner?                 |
| `set_updated_at()`             | —               | Shared trigger, applied to every mutable table |
| `generate_booking_reference()` | —               | Collision-checked `KB-XXXXXX`                  |
| `book_appointment(...)`        | **definer**     | The single public write path                   |
| `expire_pending_approvals()`   | definer         | Releases stale holds; run hourly via `pg_cron` |
| `submit_contact_message(p_full_name, p_email, p_message)` | **definer** | Contact page message form (`0047`) — validates, then `queue_email('contact_message_received', ...)` to the owner. No new table. |

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
| `availability_slots`, `weekly_template`, `booking_settings`               | SELECT                  | ✓                         | ALL   |
| `day_decided`                                                             | none                    | —                         | ALL   |
| `appointments`                                                            | none (RPC only)         | own rows, server-resolved | ALL   |
| `customers`                                                               | none                    | own row, server-resolved  | ALL   |
| `availability_requests`                                                   | INSERT (`status='new'`) | —                         | ALL   |
| `customer_access_tokens`, `email_messages`, `staff`                      | none                    | —                         | ALL   |
| `audit_events`                                                            | none                    | —                         | SELECT only (no write policy for any role, including the owner) |

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

Eight jobs, created by the migrations. Verify with
`select jobname, schedule, active from cron.job order by jobname;`.

| Job                           | Schedule      | What it does                                                                        |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `expire-pending-approvals`    | `7 * * * *`   | `select public.expire_pending_approvals();` — releases held slots                   |
| `drain-email-queue`           | `*/5 * * * *` | drains due `email_messages` via `drain_email_queue()` + `pg_net`                    |
| `sync-google-reviews`         | `41 * * * *`  | refreshes `google_reviews` / `google_place_snapshot`                                |
| `extend-weekly-template`      | `13 2 * * *`  | rolls `weekly_template` forward into `availability_slots`                           |
| `purge-access-tokens`         | `23 4 * * *`  | deletes spent/expired `customer_access_tokens`                                      |
| `purge-expired-personal-data` | `31 3 * * 0`  | `0046`'s two-year retention sweep over `email_messages` and `availability_requests` |
| `purge-secret-login-attempts` | `17 3 * * *`  | `0051`'s nightly sweep of `secret_login_attempts` older than 24h, via `purge_login_attempts()` |
| `purge-audit-events`          | `43 3 * * 0`  | `0052`'s two-year retention sweep over `audit_events`, via `purge_expired_audit_events()` |

There is **no AI job.** An earlier design had a daily `ai/daily-insights` run; the
shipped assistant computes client-side in `src/lib/insights.ts` instead.

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

The range is capped at `max_horizon_days` regardless of what is asked for — it is
callable by `anon`, and an unbounded range is a cheap way to make the database
expensive. That cap used to be a hard-coded 62 days, which silently contradicted
the 90-day setting: the salon published three months of times and this function
would not return the last month of them to anybody.

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

| Moment            | Customer                                       | Owner                   |
| ----------------- | ---------------------------------------------- | ----------------------- |
| Booking held      | `booking_held`                                 | `owner_approval_needed` |
| Booking confirmed | `booking_confirmed` + both reminders           | `owner_new_booking`     |
| Approved          | `booking_approved` + both reminders            | —                       |
| Declined          | `booking_declined`                             | —                       |
| Cancelled         | `booking_cancelled`                            | —                       |
| Completed         | `appointment_completed` (+2h, always — `0018`) | —                       |
| Enquiry raised    | `request_received`                             | `owner_new_request`     |

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

A change of booking policy, decided by the owner on 2026-08-07. It replaces an
earlier hybrid trust gate (superseded; PRD.md §4 now matches this section).

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

## 13. Migrations `0011`–`0012` — availability rebuilt from scratch

The owner asked for a rebuild after using the calendar. There were four
overlapping ways to say when she was free — standing weekly rules, published
"custom hours" windows, individual published slots, and breaks or closures that
subtracted from all of them. Each was defensible alone; together they were a
system nobody should have to hold in their head, and they produced screens that
contradicted one another (see the display bugs fixed in the previous commit).

**The model is now one sentence.** A day is a list of start times. If a time is
on the list it can be booked; if it is not, it cannot.

`availability_rules` and `availability_exceptions` are **dropped**.
`availability_slots (on_date, starts_at)` is the whole of availability.
"Blocking out time" is no longer a concept — you do not publish the time, or you
delete one you published.

**Slots stopped depending on the service.** Every appointment is one
`Hair Appointment` of a fixed length, so a time is absolute rather than "free
for a trim, busy for a colour". `hair_appointment()` resolves the single active
service, and nothing in the booking path takes a service argument any more.
Other services are deactivated and archived rather than deleted, because past
appointments point at them.

| Function                         | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `available_slots(from, to)`      | Free times for customers — no service argument         |
| `owner_day_slots(date)`          | The owner's grid: every time with booked/past/who      |
| `month_slot_summary(from, to)`   | Slot and booking counts per day, one query per month   |
| `set_day_slots(date, time[])`    | Replace a day's times wholesale                        |
| `copy_day_slots(from, to)`       | Copy one day onto another                              |
| `book_appointment(starts_at, …)` | Book. Availability is one lookup against the slot list |

**`0012` protects bookings from bulk edits.** `set_day_slots` and
`copy_day_slots` both clear the day before writing, which is right for free
times and wrong for taken ones — deleting the slot behind a live appointment
does not cancel it, does not tell the customer, and leaves the owner's day panel
showing nothing at a time somebody is turning up. A time with a live appointment
survives both operations; freeing it means cancelling the appointment, which is
the act that tells the customer.

**Consequence worth stating plainly:** with no weekly pattern underneath,
nothing is bookable until the owner publishes times. That is the trade the
simplicity buys.

## 14. Migration `0013` — a repeating week, and stricter booking details

**The weekly default is a generator, not a source.** The 0011 rebuild exists
because availability had four sources that disagreed; a weekly pattern consulted
_at booking time_ would be a fifth. `weekly_template (day_of_week, starts_at)`
therefore writes real rows into `availability_slots` and is never read when
anything is booked. A day is still exactly its own list of times.

The difficult part is knowing when to leave a day alone. A generator that filled
every empty day would silently refill a Wednesday the owner had cleared — she
would delete her afternoon off and find it back the next morning.
`day_decided (on_date, decided_by)` records every date already ruled on, by a
human or by the generator, and the generator skips those. `set_day_slots` marks
the date decided, so **editing a day — including clearing it — makes that day
permanently yours**.

| Function                                   | Purpose                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `set_weekly_template(dow, time[])`         | Set one weekday's pattern                             |
| `apply_weekly_template(from, to, replace)` | Write it into real days                               |
| `weekly_template_status()`                 | Pattern size and how far the calendar is set up       |
| `extend_weekly_template()`                 | Nightly `pg_cron` fill-forward to the booking horizon |

`replace = false` (the default, and what the nightly job uses) only fills
undecided days. `replace = true` is the deliberate "lay my week over the top"
action. Neither can remove a time with a live appointment against it — that
guarantee comes from `set_day_slots` (0012) and holds through both.

**Booking now insists on a full name and a mobile number.** Both are enforced in
`book_appointment`, not only in the form: a validation that lives in the browser
is a suggestion. A single-word name raises `NAME_INCOMPLETE`; fewer than seven
digits raises `MOBILE_REQUIRED`. The name is whitespace-normalised before
storage, so `"  Koko   Beauty  "` is stored as `Koko Beauty`.

The owner's own booking path stays lenient — she is looking at the customer and
sometimes only has a first name.

## 15. Migrations `0015`–`0016` — customer reschedule

`customer_reschedule_appointment(session, appointment, new_starts_at)` lets a
customer move their own booking. Until now they could only cancel and rebook,
which loses the thread: the salon sees an unexplained cancellation and a
separate new booking, and the customer has to give up their slot before knowing
the new one is still free.

**A reschedule creates a new appointment and retires the old one**, linked by
`rescheduled_from`, with the old row set to `rescheduled`. Both columns have
existed since `0002` for this. Moving `starts_at` in place would keep the
reference stable but erase the history, and "she moved twice, the second time at
short notice" is something a salon owner wants to see.

The new time faces every check a fresh booking would — grid alignment, lead
time, horizon, and that the time is actually published. The old row is retired
_before_ the new one is inserted, or moving to an adjacent time would collide
with itself through `appointments_no_overlap`. If the insert then fails because
somebody took the new time first, **the old booking is restored** — losing an
appointment to a half-finished move would be far worse than the move not
happening. Freeing the old time needs no work: `rescheduled` is not one of the
statuses the overlap constraint covers, so the slot returns to sale immediately.

Moving inside the cancellation window is allowed and recorded rather than
refused, on the same reasoning as late cancellation: refusing it just produces a
no-show, which costs the salon the slot anyway.

**Email.** The customer receives one confirmation, for the new appointment, from
the insert trigger; a second "you have moved" message would be noise. The owner
gets `owner_booking_moved` carrying the old time.

**`0016` fixes a bug this surfaced.** When a booking stopped being live the
trigger retired its queued reminders but not its queued _confirmation_. Since
the queue drains every five minutes, anyone who cancelled or moved within that
window would receive "You are booked in" for an appointment that had already
been retired, immediately followed by the cancellation. Now every unsent message
about a retired booking is retired with it. Already-sent rows are untouched —
rewriting those would make `sent_at` a lie.

## 16. Migration `0017` — marketing and reviews

Google reviews are cached instead of fetched per page view. Two reasons: (1) a
Places API key shipped to the browser is effectively public and billable; (2)
a salon's reviews change a few times a month, not per visit. An Edge Function
pulls them hourly into `google_reviews` and `google_place_snapshot`, where the
fetch timestamp is kept so staleness is visible. The marketing page reads the
cache via `public_reviews()`, which returns the rating, review count, and the
most recent reviews with text.

`booking_settings` gains `google_place_id`, `instagram_url`, `address_line`,
`phone` so the owner can configure her presence without a code change.

## 17. Migration `0018` — service menu and mail

**The menu.** `service_menu` is the marketing list of styles offered — separate
from `services`, which is the single bookable appointment type. The owner can
edit the menu without touching the booking path. It is seeded with a working
list for an African hair salon; the owner deletes anything she does not do,
because a listed style that gets turned down at the door costs goodwill.

**The mailing list.** `subscribers` is an opt-in list for updates. Subscribing
goes through `subscribe_to_updates()`, which takes no parameters other than
email and name, deliberately returns nothing, and never reports whether an
address is already on the list — the form would otherwise become a membership
oracle for any email someone wants to probe.

**Email rewrites.** The second reminder moves from two hours out to one. The
completion email is now always sent (not just when a review URL is configured);
the review ask is folded in when there is somewhere to send it. A moved booking
reads as moved: the insert trigger queues a plain confirmation, then a second
trigger (`rescheduled_mail`) rewrites it to `booking_rescheduled` and carries
the old start time.

## 18. Migration `0019` — calendar feed and owner booking

**Calendar subscription.** `calendar_feeds` mints token pairs: the plaintext is
shown exactly once (never stored, never readable again), and only its SHA-256
hash lives in the database. This makes the URL a 256-bit bearer token with no
guessing, and a leaked table is worthless. The owner can revoke any feed on one
click. The feed endpoint (`calendar_feed_events()`) is not granted to anon or
authenticated — only the Edge Function calls it with the service role after
validating the token.

**Manual bookings with custom duration.** `create_appointment_as_owner()` gains
a `p_duration_min` parameter so the owner can book a five-hour full head when
the appointment type says four. Duration is validated (15 min–12 hours) and
applied at insert time, separate from the service default.

## 19. Migration `0020` — subject lines without em dashes

Cosmetic: re-applies three email functions (`notify_appointment_status_changed`,
`notify_appointment_created`, `rescheduled_mail`) with subject lines corrected
from em dashes to middle dots (the canonical separator). Mail already queued
keeps its original subject. No logic changes; same triggers, same payloads.

## 20. Migration `0021` — four security fixes

**(1) Magic links are single-use.** `customer_access_tokens` gains a third
`purpose` value: `'session'`. Magic links stay `'manage'`, and the redeemed
`session` token is separate and non-interchangeable — a leaked link cannot be
held open as a session for 30 minutes after the customer has used it. Both must
also pass `used_at is null` to be valid, closing a race where the same token
worked as both. Existing sessions (identified by their 30-day TTL) are reclassified
on migration so nobody is signed out.

**(2) Enquiries cannot spam.** `validate_availability_request()` is a new
trigger that validates email format (rejecting empty, obviously fabricated,
non-routable addresses) and rate-limits to 3 per address per day. The insert
policy forbids `customer_id` to be set — the owner links the request when
converting, not the form. Both prevent the form from being turned into an
arbitrary-address mailer.

**(3) Reviews sync needs a secret.** `sync_google_reviews()` now demands
`x-cron-secret` in the request headers (stored in the vault, like the endpoint
URL). The cron scheduler provides it; anyone who finds the endpoint cannot
make a billable call to Places.

**(4) Cron-only functions are not callable over the API.** Three functions
(`expire_pending_approvals`, `purge_expired_access_tokens`, `extend_weekly_template`)
are revoked from `public, anon, authenticated` so they cannot be reached at
`/rest/v1/rpc/…`. They are scheduled via `pg_cron` and run as a superuser, so
they do not need the grant.

## 21. Migrations `0022` — slots and mail keep their promises

Five correctness fixes, two live and three dormant traps:

**(1) LIVE.** A `retired_booking_templates()` function replaces the hard-coded
list of mail templates that must be retired when a booking dies. This is the
bug 0016 fixed and 0018/0020 reintroduced: confirmations and holds were
dropped from the list, so a booking cancelled during the five-minute drain
window still sent "You are booked in" after being retired. Now the list is
canonical and used in both `notify_appointment_status_changed` (cancel/reject/
no-show path) and in a retrospective sweep of already-queued mail.

**(2) LIVE.** The nightly template extender (`extend_weekly_template()`) now
unions any time that already has a live appointment when it rebuilds a day from
the weekly pattern. The bulk-edit guarantee that "a time with a live appointment
survives any edit" (from 0012) was broken by this function's raw delete-and-insert.

**(3) Slot alignment checked against salon's clock, not UTC.** `book_appointment()`
and `customer_reschedule_appointment()` check alignment against the epoch only,
which fails when the granularity does not divide 60 — on the last Sunday in
March, every published slot starts failing `SLOT_MISALIGNED` for the whole of
British Summer Time while `available_slots()` still lists them as bookable. Both
functions now check against local wall-clock minutes-since-midnight, matching
the publish-side functions.

**(4) Approval deadline recomputed on reschedule.** A still-pending booking gets
a deadline measured from the move, against the new time. Copying it forward
handed the new booking a deadline belonging to the old date, often already past,
which the hourly expiry sweep would then act on and reject a booking the customer
had just moved.

**(5) Daily cap check uses an advisory lock.** Two customers booking different
times on a day one short of the cap both saw `count < cap` under READ COMMITTED
and both inserted. The overlap constraint did not fire because their times did
not collide. A transaction-scoped advisory lock keyed on the local date serialises
just bookings on the same day, so different days are unaffected.

## 22. Migration `0023` — realtime actually publishes

The dashboard subscribes to `postgres_changes` on `public.appointments` for
live updates, and the "Live" indicator showed green — but `appointments` was
never added to the `supabase_realtime` publication, and change streams come
from logical replication. A table not published produces no changes. The owner
has been looking at an indicator saying "Live" on a screen that only updated on
reload. Publishing the base table (not the view, because views do not replicate)
fixes this. The payload is un-joined; consumers refetch on any event rather than
rendering from it. Replica identity is set to `full` so updates carry the
previous row as well as the new one.

## 23. Migrations `0024`–`0026` — owner and customer reschedule

**`0024` — drag-to-reschedule write path.** `reschedule_appointment_as_owner()`
retires and recreates, mirroring `customer_reschedule_appointment` rather than
an in-place `UPDATE`. This reuses the existing insert-trigger chain (mail
queueing, reminders) and its proven "restore the old row if the new insert
collides" safety. The function auto-publishes the destination time (the owner
declaring a new time on her own calendar IS her publishing availability) and
skips customer-protection guards — the owner is looking at the calendar, not a
booking form.

**`0025` — race condition and duration fix.** Two bugs in `customer_reschedule_appointment`:
(1) No row lock, so two concurrent calls on the same appointment both pass the
status check and both insert, leaving two live bookings. `for update` makes the
second caller block and correctly fail. (2) Duration was recomputed from the
current service default instead of preserved from the old row. Appointments have
no duration column — length lives only in `ends_at - starts_at` — and an owner-created
booking can be any length. Rescheduling a 4-hour appointment silently shrank it
to the service default, leaving chair time unprotected. The fix preserves
`service_id` too, so a confirmation email describes the same service, not the
current one.

**`0026` — review pass.** Three bugs in 0024 and 0025: (1) `reschedule_appointment_as_owner`
never checked that the new time was in the future — a drag onto a past slot
silently succeeded. (2) `customer_reschedule_appointment`'s insert dropped
`approved_by` while carrying `approved_at`, silently losing the approver reference
on a reschedule of an approved booking. (3) `reschedule_appointment_as_owner` still
called `hair_appointment()` to raise `SERVICE_UNAVAILABLE` even though the operation
touches no service data — deactivating the service would wrongly block rescheduling
any existing appointment. All three are fixed by redefining both functions.

## 24. Migration `0027` — payment log

`payments` records what the owner actually logged as paid, per appointment.
Append-only by design: no update or delete RPC. A mis-logged amount is corrected
by logging another row, the same way the schema already preserves financial
history over mutating it (customers' soft-delete for GDPR, price snapshots on
bookings). One appointment can carry more than one payment row (deposit then
balance, say), though the v1 UI only ever adds one at a time.

`log_payment(appointment_id, amount_pence, note)` is owner-only. The dashboard's
summary function changes: `today_revenue_pence` (a placeholder based on `services.price_pence`)
becomes `today_collected_pence`, which sums logged payments for the day regardless
of the booking's status — a logged payment is money that has actually changed hands,
unlike the snapshot price, so it stays counted even if the appointment is later
cancelled or marked no-show.

`appointments_detailed` view gains `paid_pence`, summing all payments for each
appointment. `price_pence` and `services.price_pence` remain in the schema for
booking history; nothing in the booking path reads them any more.

## 24b. Migration `0059` — payment corrections

`payments.corrects_payment_id` (nullable FK to `payments.id`) links a correction
row back to the payment it corrects — still append-only, still no update/delete
RPC, just linkage on top of the `0027` design. The `amount_pence > 0` check now
reads `(corrects_payment_id is null and amount_pence > 0) or (corrects_payment_id
is not null and amount_pence <> 0)`: a plain payment must still be positive, a
correction may be negative (a refund/deduction) or positive (an added top-up),
but never zero. `log_payment()` takes an optional `p_corrects_payment_id` and
raises `ILLEGAL_TRANSITION` if the linked payment belongs to a different
appointment, `NOT_FOUND` if it doesn't exist.

## 25. Migrations `0065` and `0066` — copy corrections, not schema

Neither changes a table, a function or a policy. Both exist because seeded *data*
was wrong in a way a customer could see, and the only way to fix seeded data is
another migration.

**`0065`** removes the four em dashes in `email_templates.html_body` that `0032`
seeded, and corrects the owner's name. `0032` had signed the booking confirmation
"Koko Lett" and greeted the password reset "Hi Koko," while the About page has
always said Christy, so a customer could receive a confirmation signed by someone
who does not work at the salon.

**`0066`** deactivates `Faux locs`, `Butterfly locs`, `Soft locs`, `Starter locs`
and `Loc retwist and styling`, then renames their group to `Twists`. The owner
does not do locs and never has. They were seeded by `0018` and had been advertised
on the marketing site, in the JSON-LD, in the meta descriptions and inside the AI
assistant's grounding prompt ever since.

Both are written as targeted `replace()` and `update ... where` statements rather
than as row overwrites. Every one of these rows is owner-editable from the
dashboard, and a blanket overwrite would silently discard whatever she had written
since the seed ran. `0066` sets `active = false` rather than deleting: the flag is
what the console and every public surface already read, it removes the styles
everywhere in one step, it is reversible from the dashboard, and it keeps the
`image_path` of real photographs.

**Migrations `0005`, `0010`, `0015`, `0016` and `0018` still contain em dashes and
loc rows, and are deliberately untouched.** Editing an applied migration changes
history without changing the database. `0020_subject_lines_without_em_dashes.sql`
set the precedent: fix forward with a new migration, never rewrite an old one.
`scripts/check-copy.py` enforces the dash rule only from `0065` onward for the
same reason.

## 26. Migrations `0067` and `0068` — the two nets under `0065` and `0066`

Both are data-only, both are no-ops against the database as it stands, and both exist
because the migrations they follow keyed on values the owner can change from the
dashboard.

**`0067`.** `0032` seeded `review_request` as "Would you leave us a Google review?" with
no link, and `appointment_completed` with none either. That is harmless only while both
rows have `include_in_automation = false`, because `send-emails` then falls back to the
built-in copy in `_shared/templates.ts`, which does render a "Leave a review" button.
The trap is that the fallback is invisible from the Template Editor: the owner sees two
review templates, switches one into automation because that is the obvious thing to do,
and every review request from then on asks for a review while giving no way to leave
one. Nothing errors. `0067` appends the `{{google_review_url}}` token, which
`buildTokens` already supports and `templateCatalog.ts` already declares for both keys.
It is conditional on the row still carrying the seeded wording, so a template Christy
has rewritten is left exactly as she wrote it.

**`0068`.** `0066` deactivated five loc styles by exact name inside the group "Twists
and locs", then renamed that group to "Twists" unconditionally. Both columns are
owner-editable (`serviceMenuService.ts` writes them straight from the console), so the
two statements could disagree: a row renamed at some point to "Soft locs (medium)"
would not have matched the first statement, while the second still moved it into a
group now called "Twists". The result would be an active loc service filed under a name
that reads as safe, and `public_service_menu()` selects `where active`, so it would go
straight back onto the marketing site. `0068` matches on the word rather than on five
exact strings, so it also catches a spelling `0066` never knew about.

Verified against production before applying: the query returned the same five rows,
all already inactive.
