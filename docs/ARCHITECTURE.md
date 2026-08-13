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
│   ├── serviceCatalogService.ts     # services + categories
│   ├── availabilityService.ts       # slot generation from rules
│   ├── bookingService.ts            # book_appointment RPC wrapper
│   ├── appointmentService.ts        # lifecycle transitions
│   ├── customerService.ts           # CRM reads/writes
│   ├── availabilityRequestService.ts
│   ├── reportingService.ts
│   ├── aiAssistantService.ts        # read + accept/dismiss recommendations
│   └── notificationService.ts       # Inngest event dispatch
├── types/         # shared + generated DB types
├── App.tsx        # providers + router
├── main.tsx       # bootstrap: Sentry, SW registration, render
└── index.css      # Tailwind layers + base styles
```

**Dependency direction:** `pages → services → lib`. Components consume `hooks`
and `context`. Nothing in `lib` imports from `pages`/`components` (no cycles).

## 3. Information architecture & routing

Single-page app; React Router. Deep links work because `.htaccess` rewrites unknown
paths to `index.html`, and Workbox's `navigateFallback` does the same offline. Every
path is declared once in `src/lib/routes.ts` — nothing hard-codes a path string.

**Public (anonymous)**

| Route                                                  | Purpose                                  |
| ------------------------------------------------------ | ---------------------------------------- |
| `/`                                                    | Marketing home; primary CTA into booking |
| `/about` `/gallery` `/testimonials` `/faqs` `/contact` | Marketing                                |
| `/services` · `/services/:slug`                        | Catalogue and detail                     |
| `/book` · `/book/:serviceSlug`                         | The booking flow                         |
| `/request-availability`                                | Enquiry when no slot fits                |
| `/privacy` `/booking-policy` `/terms`                  | Policies                                 |

**Customer (magic-link session)**

| Route                                                      | Purpose                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `/access/:token`                                           | Exchanges a single-use token for a 30-day session, then redirects |
| `/my` · `/my/appointments` · `/my/appointments/:reference` | Upcoming, history, manage                                         |

**Owner (Supabase session + `staff` membership)**

| Route                           | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `/dashboard`                    | Today at a glance                                                 |
| `/dashboard/calendar`           | Day / week / month / agenda, drag-to-reschedule                   |
| `/dashboard/appointments`       | Searchable list                                                   |
| `/dashboard/inbox`              | Approvals + Requests, tabbed (`?tab=approvals` / `?tab=requests`) |
| `/dashboard/customers` · `/:id` | CRM                                                               |
| `/dashboard/services`           | Catalogue management                                              |
| `/dashboard/availability`       | Hours, breaks, closures, booking rules                            |
| `/dashboard/reports`            | Revenue and utilisation                                           |
| `/dashboard/assistant`          | AI recommendations queue                                          |
| `/dashboard/settings`           | Salon profile, email, policies                                    |

`/dashboard/approvals` and `/dashboard/requests` render nothing themselves — both are kept
mounted purely as redirects (`/dashboard/inbox?tab=approvals` / `?tab=requests`) so old
links and bookmarks still land somewhere real (see `src/App.tsx`).

`ProtectedRoute` gates owner routes on Supabase session **and** `is_owner()`. A signed-in
user who is not in `staff` gets a 403 view, not the dashboard.

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
- **Booking flow:** `useBookingFlow` owns a single reducer for service → date → slot →
  details → review. Keeping it in one reducer is what makes back-navigation and
  slot-expiry recovery tractable.
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
| `ai/daily-insights`                             | `pg_cron` 06:00   | Writes advisory rows to `ai_recommendations`                        |
| `approvals/expire`                              | `pg_cron` hourly  | `expire_pending_approvals()` releases stale holds                   |

## 6b. AI boundary

The assistant runs entirely in an Edge Function. It reads schedule and request data,
produces recommendations, and writes them to `ai_recommendations` with status
`pending`. It has **no write access to `appointments`, `customers`, or
`availability_*`**. Acting on a recommendation is a separate, explicit owner action
that goes through the normal service layer. This is a structural guarantee, not a
prompt instruction — prompt instructions are not a security boundary.

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
