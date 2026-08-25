# System Architecture — Kokolett Beauty UK

## 1. Topology

```text
┌──────────────────────────────────────────────────────────────────┐
│                     Client Browser / Installed PWA                 │
│      React 19 + Vite + Tailwind  ·  Service Worker (Workbox)        │
│      Served as static files from cPanel (public_html)              │
└──────┬───────────────┬───────────────┬───────────────┬────────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Supabase  │  │  ImageKit  │  │   Sentry   │
│ Auth + DB  │  │  media CDN │  │ monitoring │
│  + RLS     │  │ transforms │  │            │
└─────┬──────┘  └────────────┘  └────────────┘
      │
      ▼
 PostgreSQL  ·  7 Deno Edge Functions  ·  pg_cron + pg_net
 (row-level security)
```

There is no Inngest. An earlier design routed the post-booking work through it; the
shipped mechanism is a Postgres trigger writing to `email_messages` and a `pg_cron` job
calling `drain_email_queue()` every five minutes, which POSTs to the `send-emails` Edge
Function with a shared secret. Nothing in the app dispatches an Inngest event and the
package is not a dependency.

The static bundle talks to each managed service directly over HTTPS. cPanel only
serves files — it never runs application logic.

## 2. Directory layout

```text
src/
├── assets/        # images/svgs imported by code
├── components/    # presentational + wiring components
│   └── ui/        # design-system primitives (Button, Card…)
├── context/       # AuthProvider, ThemeProvider (React Context)
├── hooks/         # reusable logic (see docs/HOOKS.md)
├── lib/           # third-party SDK clients + env access
│   ├── env.ts       # validated, typed import.meta.env
│   ├── supabase.ts  # typed Supabase client
│   ├── sentry.ts    # Sentry init
│   ├── imagekit.ts  # ImageKit URL builder
│   ├── utils.ts     # cn() and small helpers
│   └── routes.ts    # the single route map
├── pages/         # route-level views (public / customer / dashboard)
├── services/      # typed data access over Supabase
│   ├── serviceCatalogService.ts     # website service catalogue + categories
│   ├── serviceMenuService.ts        # owner-side service-menu management
│   ├── availabilityService.ts       # owner-side: day slots, month summary,
│   │                                #   weekly template. Not the customer read
│   ├── bookingService.ts            # the public path: available_slots,
│   │                                #   book_appointment, availability requests
│   ├── bookingSettingsService.ts    # the single booking_settings row
│   ├── appointmentService.ts        # lifecycle transitions
│   ├── requestService.ts            # availability-request queue + offers
│   ├── customerService.ts           # CRM reads/writes
│   ├── customerSessionService.ts    # magic-link session exchange
│   ├── paymentService.ts            # log_payment RPC wrapper (migration 0027)
│   ├── calendarFeedService.ts       # ICS calendar feed
│   ├── reportsService.ts            # reporting queries
│   ├── assistantService.ts          # data feed for the client-side insights module
│   ├── aiChatService.ts             # calls the ai-assistant-chat Edge Function
│   ├── dashboardService.ts          # Today-page summary stats
│   ├── emailService.ts              # outbox reads, template editing, one-off owner sends
│   ├── profileService.ts            # owner account profile
│   ├── reviewService.ts             # Google review sync
│   ├── subscriberService.ts         # mailing-list subscribe
│   └── notificationsService.ts      # owner notification feed
├── types/         # shared + generated DB types
├── App.tsx        # providers + router
├── main.tsx       # bootstrap: Sentry, SW registration, render
└── index.css      # Tailwind layers + base styles
```

**Dependency direction:** `pages → services → lib`. Components consume `hooks`
and `context`. Nothing in `lib` imports from `pages`/`components` (no cycles).

## 3. Information architecture & routing

Single-page app; React Router. Deep links work because `.htaccess` rewrites unknown
paths to `index.html`, and Workbox's `navigateFallback` does the same offline. Nearly
every path is declared once in `src/lib/routes.ts` — two exceptions, `/login` and
`/access/:token`, are hard-coded string literals in `App.tsx`/`ProtectedRoute.tsx`/
`SiteShell.tsx` rather than routed through the `routes` constant.

**Public (anonymous)**

| Route                                 | Purpose                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                                   | Marketing home — hero, next-available, services teaser, closing CTA                                                    |
| `/about`                              | The owner's story                                                                                                      |
| `/gallery`                            | Photo grid, filterable by service                                                                                      |
| `/services`                           | Full live service menu (duration/price from `services`)                                                                |
| `/testimonials`                       | Full Google-reviews list + `AggregateRating`                                                                           |
| `/faqs`                               | Accordion, feeds `FAQPage` schema                                                                                      |
| `/contact`                            | Every contact channel plus the message form                                                                            |
| `/book`                               | The booking flow — no per-service step; one appointment type                                                           |
| `/request-availability`               | Enquiry when nothing's open                                                                                            |
| `/subscribe`                          | Mailing-list opt-in — not linked in-app; meant to be pasted externally (e.g. an Instagram bio)                         |
| `/privacy` `/booking-policy` `/terms` | Policies                                                                                                               |

`routes.public.about`/`gallery`/`services`/`testimonials`/`faqs`/`contact` were
reinstated 2026-08-25 (marketing rebrand), reversing the single-page simplification
this section used to describe.

**Customer (magic-link session)**

| Route                      | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `/access/:token`           | Exchanges a single-use token for a 30-day session, then redirects |
| `/my` · `/my/appointments` | Same component (`MyBookingsPage`) for both; no distinct behaviour |

**Owner (Supabase session + `is_owner()`)** — grouped by sidebar nav entry
(`DashboardLayout.tsx`'s `entries`/`secondaryEntries`):

| Route                      | Nav                      | Purpose                                                           |
| -------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `/dashboard`               | Today                    | Today at a glance                                                 |
| `/dashboard/inbox`         | Inbox                    | Approvals + Requests, tabbed (`?tab=approvals` / `?tab=requests`) |
| `/dashboard/calendar`      | Calendar & Capacity      | Day / week / month, drag-to-reschedule                            |
| `/dashboard/appointment`   | Calendar & Capacity      | The single appointment type's length and price                    |
| `/dashboard/weekly`        | Calendar & Capacity      | The repeating week that generates calendar days                   |
| `/dashboard/appointments`  | Bookings                 | Searchable list                                                   |
| `/dashboard/customers`     | Customers                | CRM                                                               |
| `/dashboard/services`      | Growth                   | Service-menu content (descriptive, not priced/bookable)           |
| `/dashboard/settings`      | Settings                 | Salon profile, email, policies                                    |
| `/dashboard/reports`       | Reports (secondary)      | Revenue and utilisation                                           |
| `/dashboard/assistant`     | AI Assistant (secondary) | Advisory insights queue                                           |
| `/dashboard/notifications` | — (header bell)          | Not in sidebar                                                    |
| `/dashboard/profile`       | — (account link)         | Not in sidebar                                                    |

`/dashboard/approvals` and `/dashboard/requests` render nothing themselves — both are kept
mounted purely as redirects (`/dashboard/inbox?tab=approvals` / `?tab=requests`) so old
links and bookmarks still land somewhere real (see `src/App.tsx`).

`ProtectedRoute` gates owner routes on Supabase session **and** `is_owner()`. A signed-in
user who fails that check gets a client-side "no access" view, not the dashboard —
not a literal HTTP 403.

## 4. State management

- **Auth/session:** Supabase session in `AuthProvider`. Customer magic-link sessions
  are separate and held in `useCustomerSession` — a customer is never a Supabase auth
  user, so the two must not be conflated.
- **Server data:** fetched per view through `services/*`. Caching comes from the
  service worker and the Supabase client. Swap in TanStack Query if reporting views
  start refetching too aggressively.
- **Live schedule:** `useRealtimeAppointments` subscribes to Postgres changes on
  `appointments` so the owner's calendar updates without polling. This is Supabase
  Realtime — there is no socket server in this repo and there never will be.
- **Booking flow:** `BookPage` manages its own flow state locally with five
  `useState` hooks (open date, slot, details, submitting, error/result) — there is
  no dedicated reducer hook. There's also no service-selection step: one
  appointment type, so the flow goes straight from date to time.
- **Theme:** `ThemeProvider`, defaulting to `system`.

## 5. PWA & offline strategy

- `vite-plugin-pwa` (Workbox, `generateSW`) precaches the hashed app shell
  (`js/css/html/icons/fonts`).
- **Navigation:** `navigateFallback: index.html` → the SPA boots offline and its
  own UI (e.g. `OfflineBanner`) communicates connectivity.
- **Runtime caching:**
  - ImageKit → `CacheFirst` (30-day, 200 entries).
  - Supabase REST → `NetworkFirst` (5s timeout, 5-min fallback).
  - Google Fonts → `StaleWhileRevalidate`.
- **Updates:** `registerType: 'prompt'` + `skipWaiting: false`. A new SW waits;
  the app shows a "Reload to update" prompt so users are never interrupted.
- `public/offline.html` ships as a last-resort static fallback.

## 6. Data flow example — a customer books a slot

```
BookPage (/book)                            // one appointment type, so no
  → useAvailability(appointmentMinutes, …)  // service slug and no service step
      → bookingService.fetchAvailableSlots()
          → supabase.rpc('available_slots', { p_from, p_to })  // security definer
              free starts only, computed in the database: the published slot
              list minus live appointments, minus lead time, capped at
              booking_settings.max_horizon_days
          ← aligned TimeSlot[], grouped by salon-local date

  → user picks a slot, enters details, confirms

  → bookingService.submitBooking(...)
      → supabase.rpc('book_appointment', { … })      // security definer, 6 args
          validates alignment (against the salon's wall clock, not UTC),
          lead time, horizon, that the time is published, the daily cap
          (advisory-locked on the local date), name, mobile, email format
          and a per-address rate limit
          → upserts the customer by lowercased email → decides status:
             approve_first_time off (the live setting) → 'confirmed'
             on, and first-time                        → 'pending_approval'
          → INSERT; the gist exclusion constraint settles any race
      ← { appointment_id, reference, status }

  → on SLOT_TAKEN: refresh availability, keep the form, show a recoverable message
  → on other coded errors: map the code to human copy (never surface Postgres text)

  → a Postgres trigger on `appointments` calls queue_email(), which writes
    a row per message into `email_messages` (status 'queued'), in the same
    transaction as the booking:
          • the customer's confirmation, or the "held for approval" email
          • the owner's "new booking" / "approval needed" notification
          • the 24h and 1h reminders, scheduled ahead — and skipped outright
            if their send time has already passed

  → pg_cron runs drain_email_queue() every 5 minutes. It reads the shared
    secret from Supabase Vault and POSTs to the send-emails Edge Function
    via pg_net, which claims each row, renders it from _shared/templates.ts
    and sends over SMTP, with retry and backoff recorded on the row.
```

The browser never sends email, never signs a token, and never holds an SMTP or AI
credential. Everything requiring a secret happens in a Supabase Edge Function.

## 6a. Background workflows

Nothing here is dispatched by the client. Every row below is either a Postgres
trigger firing inside the writing transaction, or a `pg_cron` job — the names in the
first column are descriptions, not event topics on a bus.

| Moment                            | Fired by                                | Effect                                                                                 |
| --------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| Appointment created               | `notify_appointment_created` trigger    | Confirmation or hold email, `.ics`, owner alert, and both reminders queued ahead       |
| Approved / rejected               | `notify_appointment_status_changed`     | Notify the customer                                                                    |
| Cancelled / rescheduled / no-show | `notify_appointment_status_changed`     | Notify both sides, retire every unsent message about the booking, release the slot     |
| Completed                         | `notify_appointment_status_changed`     | `appointment_completed` at +2h, always — the review ask is folded in when a URL is set |
| Availability request raised       | `notify_availability_request` trigger   | Owner notification + customer acknowledgement                                          |
| Reminders                         | queued at booking, not swept            | 24h and 1h. A scheduler outage delays a reminder rather than losing it                 |
| Outbound send                     | `drain-email-queue`, `pg_cron` every 5m | SMTP send with retry, backoff and logging                                              |
| Stale holds                       | `expire-pending-approvals`, hourly      | `expire_pending_approvals()` releases them                                             |
| The repeating week                | `extend-weekly-template`, nightly       | Fills undecided days forward to the booking horizon                                    |
| Review cache                      | `sync-google-reviews`, hourly           | Refreshes `google_reviews` / `google_place_snapshot`                                   |
| Spent tokens                      | `purge-access-tokens`, nightly          | Deletes used and expired `customer_access_tokens`                                      |
| Retention                         | `purge-expired-personal-data`, weekly   | `0046`'s two-year sweep of `email_messages` and `availability_requests`                |
| _(none — see §6b)_                | —                                       | AI insights are computed on page load, not scheduled                                   |

## 6b. AI boundary

Two separate things wear the word "assistant", and conflating them is how this
section was wrong for a while.

**The advisory modules** are a deterministic, statistical TypeScript module,
`src/lib/insights.ts`, computed client-side on page load from data
`assistantService.ts` already fetched (conflicts, reschedule opportunities, drafted
replies, analytics, trends, repeat customers). Nothing in that module talks to
Supabase or mutates data.

**The chat assistant** is a real LLM. `supabase/functions/ai-assistant-chat` calls
OpenRouter (`openai/gpt-5-nano`) with tool calling, invoked from
`src/services/aiChatService.ts`. It runs under the caller's own Authorization header
and the anon key, so every read it makes is governed by that caller's RLS: a non-owner
gets a working chat that can read nothing.

The `ai_recommendations` table and a `pending`-status recommendation queue exist in
the generated types but nothing reads or writes them — an earlier design called for a
queue; the shipped mechanism does not use one.

The safety property is unchanged: the assistant has **no write access to
`appointments`, `customers`, or `availability_*`**, and acting on anything it
surfaces is a separate, explicit owner action through the normal service layer. That
still holds structurally (there's no code path from `insights.ts` to a mutation) —
it just isn't enforced by a server-side write boundary, because there's no server
component to enforce it in.

## 7. Build & deploy pipeline

The server has **no Node/npm** — the build runs locally (or in CI) and only the static
artifacts are shipped. Full playbook + safety rules: **`docs/DEPLOYMENT.md`**.

1. `npm run build` → `tsc --noEmit` (gate) → Vite build → `dist/` (+ `sw.js`, manifest, source maps).
2. Deploy `dist/*` and root `.htaccess` into **this app's own docroot** (e.g.
   `~/<domain>/` or `public_html/<app>/`) via rsync-over-SSH, cPanel Git, or FTP.
   **Never** target a shared docroot, and dry-run any mirror-with-delete first.
3. Upload source maps to Sentry (but don't serve `*.map` publicly); exclude runtime/
   secret paths (`uploads/`, `.env`, `config.php`, backups) from any delete.

## 8. Security posture

- Only browser-safe keys ship: Supabase **anon** (RLS is the boundary), the ImageKit
  URL endpoint, and the Sentry DSN.
- `service_role`, SMTP credentials, the AI provider key, the Google Places key and the
  two cron secrets never touch the client. They are Supabase Edge Function
  secrets (`supabase secrets set`).
- There is no anonymous read policy on `appointments` or `customers`. Public writes go
  through `book_appointment()`, which validates server-side; the client's own checks
  exist for responsiveness, not for safety.
- Magic-link tokens are stored only as SHA-256 hashes, are single-use, and expire in
  30 minutes.
- Personal data is UK-resident: Sentry is configured in the **EU region** with PII
  scrubbing enabled.
- `.htaccess` adds HTTPS redirect + `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`.
