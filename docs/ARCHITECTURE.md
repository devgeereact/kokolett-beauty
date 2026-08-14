# System Architecture — Kokolett Beauty UK

## 1. Topology

```text
┌──────────────────────────────────────────────────────────────────┐
│                     Client Browser / Installed PWA                 │
│      React 18 + Vite + Tailwind  ·  Service Worker (Workbox)        │
│      Served as static files from cPanel (public_html)              │
└──────┬───────────────┬───────────────┬───────────────┬────────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐
│  Supabase  │  │  ImageKit  │  │   Sentry   │  │   Inngest (ingest) │
│ Auth + DB  │  │  media CDN │  │ monitoring │  │  event dispatch    │
│  + RLS     │  │ transforms │  │            │  │                    │
└─────┬──────┘  └────────────┘  └────────────┘  └─────────┬──────────┘
      │                                                    │
      ▼                                                    ▼
 PostgreSQL  ·  Edge Functions                  Inngest invokes a Supabase
 (row-level security)                           Edge Function (NOT cPanel)
```

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
│   ├── availabilityService.ts       # slot generation from rules
│   ├── bookingService.ts            # book_appointment RPC wrapper
│   ├── bookingSettingsService.ts    # the single booking_settings row
│   ├── appointmentService.ts        # lifecycle transitions
│   ├── requestService.ts            # availability-request queue + offers
│   ├── customerService.ts           # CRM reads/writes
│   ├── customerSessionService.ts    # magic-link session exchange
│   ├── paymentService.ts            # log_payment RPC wrapper (migration 0027)
│   ├── calendarFeedService.ts       # ICS calendar feed
│   ├── reportsService.ts            # reporting queries
│   ├── assistantService.ts          # data feed for the client-side AI insights module
│   ├── dashboardService.ts          # Today-page summary stats
│   ├── settingsService.ts           # salon profile + policy settings
│   ├── profileService.ts            # owner account profile
│   ├── reviewService.ts             # Google review sync
│   ├── subscriberService.ts         # mailing-list subscribe
│   └── notificationsService.ts      # Inngest event dispatch
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

| Route                                 | Purpose                                                          |
| -------------------------------------- | ------------------------------------------------------------------ |
| `/`                                    | Marketing home — one scrolling page (hero, next-available, services, how-it-works, closing CTA), not a multi-page site |
| `/book`                                | The booking flow — no per-service step; one appointment type      |
| `/request-availability`                | Enquiry when nothing's open                                       |
| `/subscribe`                           | Mailing-list opt-in — not linked in-app; meant to be pasted externally (e.g. an Instagram bio) |
| `/privacy` `/booking-policy` `/terms`  | Policies                                                           |

`routes.public` also declares `about`, `gallery`, `testimonials`, `faqs` and `contact`
— none are mounted in `App.tsx`. They're unused constants, not pages; don't build
against them without checking `App.tsx` first.

**Customer (magic-link session)**

| Route                       | Purpose                                                            |
| ---------------------------- | -------------------------------------------------------------------- |
| `/access/:token`            | Exchanges a single-use token for a 30-day session, then redirects   |
| `/my` · `/my/appointments`  | Same component (`MyBookingsPage`) for both; no distinct behaviour   |

**Owner (Supabase session + `is_owner()`)** — grouped by sidebar nav entry
(`DashboardLayout.tsx`'s `entries`/`secondaryEntries`):

| Route                      | Nav                      | Purpose                                                    |
| --------------------------- | ------------------------- | ------------------------------------------------------------ |
| `/dashboard`                | Today                    | Today at a glance                                            |
| `/dashboard/inbox`          | Inbox                    | Approvals + Requests, tabbed (`?tab=approvals` / `?tab=requests`) |
| `/dashboard/calendar`       | Calendar & Capacity      | Day / week / month, drag-to-reschedule                    |
| `/dashboard/appointment`    | Calendar & Capacity      | The single appointment type's length and price             |
| `/dashboard/weekly`         | Calendar & Capacity      | The repeating week that generates calendar days            |
| `/dashboard/appointments`   | Bookings                 | Searchable list                                              |
| `/dashboard/customers`      | Customers                | CRM                                                           |
| `/dashboard/services`       | Growth                   | Service-menu content (descriptive, not priced/bookable)      |
| `/dashboard/settings`       | Settings                 | Salon profile, email, policies                                |
| `/dashboard/reports`        | Reports (secondary)      | Revenue and utilisation                                    |
| `/dashboard/assistant`      | AI Assistant (secondary) | Advisory insights queue                                    |
| `/dashboard/notifications`  | — (header bell)          | Not in sidebar                                                |
| `/dashboard/profile`        | — (account link)         | Not in sidebar                                                |

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
BookingPage (/book/:serviceSlug)
  → useAvailability(serviceId, month)
      → availabilityService.getSlots()
          reads services + availability_rules + availability_exceptions
          + booking_settings (all public-read), subtracts live appointments,
          returns aligned TimeSlot[]

  → user picks a slot, enters details, confirms

  → bookingService.book(...)
      → supabase.rpc('book_appointment', { … })      // security definer
          validates service, alignment, lead time, horizon, availability,
          daily cap → upserts customer → decides status:
             returning (has a completed appointment) → 'confirmed'
             first-time                              → 'pending_approval'
          → INSERT; the gist exclusion constraint settles any race
      ← { appointment_id, reference, status }

  → on SLOT_TAKEN: refresh availability, keep the form, show a recoverable message
  → on other coded errors: map the code to human copy (never surface Postgres text)

  → useInngestDispatch().send('appointment/booked', { appointmentId })
      → POST https://inn.gs/e/<VITE_INNGEST_EVENT_KEY>       (write-only key)
      → Inngest invokes the Supabase Edge Function, which:
          • renders and SMTP-sends the confirmation or "held" email
          • attaches the .ics invite
          • rows into email_messages for delivery tracking
          • schedules the 24h and 2h reminders
          • notifies the owner if approval is required
```

The browser never sends email, never signs a token, and never holds an SMTP or AI
credential. Everything requiring a secret happens in a Supabase Edge Function.

## 6a. Background workflows

| Event                                           | Trigger           | Effect                                                              |
| ----------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| `appointment/booked`                            | client dispatch   | Confirmation or hold email, `.ics`, schedule reminders, owner alert |
| `appointment/approved` / `appointment/rejected` | owner action      | Notify the customer                                                 |
| `appointment/reminder.due`                      | scheduled         | 24h and 2h reminders                                                |
| `appointment/cancelled` / `rescheduled`         | owner or customer | Notify both sides, release the slot                                 |
| `appointment/completed`                         | owner action      | Thank-you, then the Google review request                           |
| `availability-request/created`                  | client dispatch   | Owner notification + customer acknowledgement                       |
| `email/send`                                    | internal          | SMTP send with retry, backoff and logging                           |
| _(none — see §6b)_                              | —                 | AI insights are computed on page load, not scheduled                |
| `approvals/expire`                              | `pg_cron` hourly  | `expire_pending_approvals()` releases stale holds                   |

## 6b. AI boundary

The assistant is **not** an LLM in an Edge Function — it's a deterministic,
statistical TypeScript module, `src/lib/insights.ts`, computed client-side on page
load from data `assistantService.ts` already fetched (conflicts, reschedule
opportunities, drafted replies, messages, analytics, trends, repeat customers,
cancellation risk). Nothing in that module talks to Supabase or mutates data. The
`ai_recommendations` table and a `pending`-status recommendation queue exist in the
generated types but nothing reads or writes them — an earlier design called for an
Edge Function + queue; the shipped mechanism is simpler.

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

- Only browser-safe keys ship: Supabase **anon** (RLS-guarded), ImageKit **public**,
  Inngest **write-only event** key.
- `service_role`, Inngest **signing** key, SMTP credentials, the AI provider key, and
  the magic-link signing secret never touch the client. They are Supabase Edge Function
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
