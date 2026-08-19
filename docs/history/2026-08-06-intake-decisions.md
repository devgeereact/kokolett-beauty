# Project Memory — Kokolett Beauty UK

_Last updated: 2026-08-06 (revised after intake form)_

> Captured in a single pass at the user's request. Source material: the supplied
> PRD v3.0, the instant-booking revision, and the answered intake form (booking model,
> scaffold location, design tokens, theme default, domain). Everything still unstated
> is recorded as an `ASSUMPTION` and must be confirmed before build.

## Confirmed Decisions

- **Product**: single-tenant appointment platform for one UK salon — marketing site,
  instant online booking, passwordless customer access, owner dashboard, AI operational
  assistant, automated email, reporting, installable offline-first PWA.
- **Business scope (confirmed 06 Aug 2026)**: Kokolett is a **women's hair salon
  only** — cutting, colouring, styling, treatments. Not a general beauty salon (no
  nails, brows, lashes, aesthetics) and not unisex. The "Beauty" in the name is
  branding. Structured data uses schema.org `HairSalon`.
- **Contact address (confirmed 06 Aug 2026, moved to client domain 11 Aug 2026)**: `booking@kokolettbeauty.com`, singular.
  It is both the public enquiry address and the transactional sending address
  (`VITE_SALON_EMAIL`, `SMTP_FROM_EMAIL`).
- **Booking model**: **availability-first with a hybrid trust gate** (user decision,
  06 Aug 2026). Customers only ever see slots that are genuinely bookable.
  **Returning customers — those with at least one _completed_ appointment — are
  confirmed instantly. First-time customers are held for owner approval**, with the
  slot reserved from the moment of submission and the hold released automatically if
  the approval window elapses. A prior cancellation or no-show does not earn instant
  booking; trust is earned by turning up. Controlled by
  `booking_settings.approve_first_time` (default true) and `approval_window_h`
  (default 12), so the salon can switch to pure instant booking without a migration.
- **Appointment lifecycle (V1)**:
  `pending_approval → confirmed → checked_in → in_service → completed`, with terminal
  alternatives `rejected`, `cancelled`, `rescheduled`, `no_show`. `pending_approval`
  occupies the calendar — a hold that did not block the slot would let two customers
  wait on the same time.
- **Domain**: `https://www.kokolettbeauty.com` (moved from `koko.gakinz.com` 11 Aug 2026).
- **Theme**: default follows the operating system preference; explicit light and dark
  both available and persisted as the _preference_, not the resolved value.
- **Design tokens**: supplied by the user as a full shadcn-style token set —
  terracotta `#e05d38` primary against cool neutral greys, Inter / Source Serif 4 /
  JetBrains Mono, radius `0.75rem`. Adopted verbatim.
- **Project location**: scaffolded into the Cowork outputs folder.
- **No-availability path**: customers are never dead-ended. They submit an
  **Availability Request** (name, email, mobile, service, preferred dates, preferred
  times, flexibility, notes). Owner may open availability, offer alternatives, or
  decline. Accepted requests produce a secure single-use booking link.
- **Identity**: passwordless. Customer identity keyed on **email**, mobile as secondary
  identifier. Profiles auto-created at booking. Access via time-limited magic links.
- **Owner**: exactly one administrator. Owner authenticates via Supabase Auth magic
  link and is the only role that can mutate services, availability, and appointments.
- **AI posture**: advisory only. Every AI-generated action requires explicit owner
  approval before it executes. AI never books, cancels, or emails autonomously.
- **Email**: SMTP-delivered branded transactional email with `.ics` calendar invites,
  delivery tracking, and automatic retry.
- **Stack** (fixed, not re-opened): static React 18 + Vite + Tailwind PWA on cPanel;
  Supabase (Postgres + RLS + Auth + Realtime + Edge Functions); ImageKit; Sentry;
  Inngest for background workflows.
- **Compliance**: UK GDPR. Personal data of UK residents → Sentry EU region, PII
  scrubbing enabled.
- **Accessibility target**: WCAG 2.2 AA.
- **Locale**: `en-GB`, GBP, `Europe/London`, 24h internal storage in UTC.

## Assumptions

Each line is a decision made _for_ the user in the absence of an answer. All are cheap
to change now and expensive to change after build.

- `ASSUMPTION` App name **Kokolett Beauty UK**; PWA short name **Kokolett**; package
  slug **kokolett-beauty**.
- `ASSUMPTION` No logo or icon assets supplied — `public/icons/*` are still
  placeholders and must be replaced before launch.
- `ASSUMPTION` Slot granularity **15 minutes**; default buffer **10 minutes**;
  booking lead time **2 hours**; booking horizon **90 days**.
- `ASSUMPTION` Reminder cadence: **24 hours** before, plus a **2-hour** same-day nudge.
- `ASSUMPTION` Review request is sent **2 hours** after an appointment is marked
  completed, and only once per customer per 90 days.
- `ASSUMPTION` Magic links expire after **30 minutes**, single use; customer sessions
  last **30 days**.
- `ASSUMPTION` Service catalogue, prices, opening hours, gallery images, testimonials
  and the Google Review URL are all **seeded empty** and entered by the owner.
- `ASSUMPTION` SMTP provider not named — configured as generic SMTP credentials held
  as Supabase Edge Function secrets.
- `ASSUMPTION` AI provider not named — abstracted behind one Edge Function so the
  model can be swapped; the key never reaches the browser.
- `ASSUMPTION` No deposits or payments anywhere in V1; cancellation is free up to the
  cancellation window.
- `ASSUMPTION` Cancellation window **24 hours**; later cancellations are permitted but
  flagged to the owner.

## Infrastructure (provisioned 06 Aug 2026)

| Thing              | Value                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo               | `github.com/devgeereact/kokolett-beauty` — **public** (unlimited Actions, free CodeQL + Dependabot)                                                                          |
| Supabase ref       | `erqrfjlozqyhogneqraj`                                                                                                                                                       |
| Supabase URL       | `https://erqrfjlozqyhogneqraj.supabase.co`                                                                                                                                   |
| Supabase region    | `eu-west-2` (London) — chosen over the usual `eu-west-1` for UK data residency                                                                                               |
| Migrations applied | `0001_init`, `0002_salon` — verified via `supabase migration list`                                                                                                           |
| Auth               | Magic link only; no OAuth provider enabled. Site URL and redirects point at `https://www.kokolettbeauty.com`; OTP is 8 characters, 30-minute expiry, 60-second send throttle |
| Live site          | `https://www.kokolettbeauty.com` — source in `coming-soon/` or `dist/` depending on launch state                                                                             |
| Dev + preview port | `5082` (block 08, `strictPort`)                                                                                                                                              |
| DB password        | macOS Keychain, service `supabase-kokolett-db`. Never in a file                                                                                                              |

RLS was verified from an anonymous client, not from admin SQL: `customers`,
`appointments`, `profiles`, `staff`, `services`, `availability_requests`,
`email_messages` and `ai_recommendations` all return `[]`. `booking_settings` is
deliberately world-readable — the booking UI needs lead time and horizon before
anyone has identified themselves.

## Open Questions

1. Actual service list, durations and prices. The holding page currently shows
   four broad placeholders — Cutting, Colouring, Styling, Treatments.
2. Real opening hours and standing breaks.
3. Google Business review URL.
4. SMTP provider and sending domain (SPF/DKIM/DMARC alignment).
5. AI provider and monthly spend ceiling.
6. Logo and app icon assets.
7. Does the owner want same-day bookings at all, or a longer lead time?
8. Is 12 hours the right approval window, given she works with her hands busy?

## Risks

- **Email deliverability is the single point of failure.** Confirmation, `.ics`,
  reminders and review requests all ride on SMTP. Without an authenticated sending
  domain (SPF + DKIM + DMARC) confirmations will land in spam and the "no passwords"
  promise collapses, because the magic link is also email-borne. Mitigation: delivery
  logging, retry with backoff, bounce capture, and an owner-visible failure queue.
- **Double booking under concurrency.** Two customers can select the same slot
  simultaneously. Mitigated at the database level by a `tstzrange` exclusion constraint
  — not by application checks, which always race.
- **Static hosting cannot send email, sign tokens, or call an AI provider.** All of
  that lives in Supabase Edge Functions orchestrated by Inngest. Anything that needs a
  secret is off-cPanel by construction.
- **"Dashboard refreshes in real time"** is Supabase Realtime, not a socket server.
- **99.9% uptime** is a property of Supabase and the cPanel host, not of this codebase.
  Recorded as an aspiration; no SLA is offered by the application.
- **Offline writes.** The owner dashboard is readable offline, but mutations while
  offline risk conflicting with bookings taken meanwhile. V1 keeps offline
  **read-only** and queues nothing.
- **Magic link forwarding.** A forwarded link grants access to the recipient. Mitigated
  by short expiry, single use, and scoping the token to one customer's own records.
- **Approval latency is now on the critical path.** A first-time customer who books at
  10pm and hears nothing until morning may book elsewhere. The hybrid model trades
  conversion for control. Mitigations: immediate "held" email setting expectations, an
  owner push/email alert, a dashboard badge, and automatic release so the slot is never
  silently lost. Worth measuring approval turnaround as a first-class metric — if it
  routinely exceeds a few hours, flip `approve_first_time` off.
- **Scope creep.** Multi-stylist, payments, loyalty and POS are all named as futures;
  the schema is shaped to accept them but V1 must not build them.

## Future Features (V2+)

- V1.1 — SMS and WhatsApp reminders, deposit payments, customer profile editing,
  richer reporting.
- V2 — multiple stylists, staff permissions, resource allocation, commission tracking,
  POS, inventory, loyalty programme, gift cards.
- V3 — AI demand forecasting, dynamic scheduling, customer segmentation, marketing
  automation, native mobile apps.

## Out of Scope (V1)

Multiple stylists · payroll · inventory · POS · online payments · subscriptions ·
loyalty · SMS · WhatsApp · marketplace · multi-tenant SaaS · franchise management ·
gift cards · public API.

---

## Captured Spec

### Product (→ PRD.md)

A premium, friction-free booking platform built for one salon rather than for a market.
Customers book in under two minutes with no account and no password. The owner runs the
entire business from one dashboard and is never asked to do work software could do.

Primary objectives: more confirmed bookings, less administration, fewer no-shows,
better retention, more Google reviews, fewer scheduling conflicts, actionable insight.

### Users, Roles & Permissions (→ PRD.md / SCHEMA.md RLS)

| Role             | Authentication             | Can do                                                                                                                                                                                 |
| ---------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon` (visitor) | none                       | Read the marketing site, active services, and generated availability. Create a booking via a validated RPC (instant if returning, held if first-time). Submit an availability request. |
| `customer`       | magic link, 30-day session | Everything `anon` can, plus view their own appointments and history, cancel, reschedule, rebook. Scoped strictly to their own `customer_id`.                                           |
| `owner`          | Supabase Auth magic link   | Everything. Sole mutator of services, availability, settings, appointments, customer records, and AI recommendations.                                                                  |

Enforced by an `is_owner()` security-definer predicate over a `staff` table, not by a
JWT claim the client could shape.

### User Journeys & Screens (→ PRD.md / ARCHITECTURE.md)

**Book (happy path)** — Home → Services → pick service → calendar of genuinely open
days → time slot → contact details → review → confirm → slot reserved atomically →
booking reference → **returning customers are confirmed immediately; first-time
customers see a "held, you'll hear within 12 hours" state** → confirmation email with
`.ics` → reminder(s) → appointment → completed → thank-you → Google review request.

**Approve (owner)** — dashboard badge → approvals queue → see the customer, service,
slot and any note → approve or decline with a reason → the customer is emailed either
way. Unanswered holds expire automatically and return the slot to sale.

**Book (no availability)** — availability grid returns empty → the page offers the
Availability Request form rather than an empty state → request stored → owner notified
→ owner opens availability / offers alternatives / declines → customer is emailed →
on acceptance, a secure single-use booking link completes the reservation.

**Manage** — customer clicks a magic link in any transactional email → lands on their
appointments view → cancel, reschedule, or rebook without ever seeing a password field.

**Own** — dashboard opens on today's schedule → calendar (day/week/month/agenda) with
drag-to-reschedule and conflict detection → availability requests inbox → customers →
services → availability rules → reports → AI assistant → settings.

Every screen specifies loading, empty, error and offline states; the offline state for
owner views is read-from-cache with a clear "showing cached data" banner.

### Information Architecture (→ ARCHITECTURE.md)

Public: `/` `/about` `/services` `/services/:slug` `/gallery` `/testimonials` `/faqs`
`/contact` `/book` `/book/:serviceSlug` `/request-availability` `/privacy`
`/booking-policy` `/terms`
Customer: `/my` `/my/appointments` `/my/appointments/:reference` `/access/:token`
Owner: `/dashboard` `/dashboard/calendar` `/dashboard/appointments`
`/dashboard/requests` `/dashboard/customers` `/dashboard/customers/:id`
`/dashboard/services` `/dashboard/availability` `/dashboard/reports`
`/dashboard/assistant` `/dashboard/settings`

### Data Model / Entities (→ SCHEMA.md)

`staff` · `service_categories` · `services` · `customers` · `appointments` ·
`availability_rules` · `availability_exceptions` · `booking_settings` ·
`availability_requests` · `customer_access_tokens` · `email_messages` ·
`ai_recommendations`

Ownership model differs from the boilerplate's `auth.uid() = user_id` pattern because
customers are not `auth.users`. Public reads are explicit allow-lists; all writes are
either owner-only or routed through validated `security definer` functions.

Double-booking is prevented by an `EXCLUDE USING gist` constraint over
`tstzrange(starts_at, ends_at)` for live appointment states — a database guarantee, not
an application check.

### App-specific Hooks & Services (→ HOOKS.md / ARCHITECTURE.md)

Hooks: `useServices` · `useAvailability` · `useBookingFlow` · `useAppointments` ·
`useRealtimeAppointments` · `useCustomerSession` · `useAvailabilityRequests` ·
`useAIRecommendations` · `useBusinessSettings`

Services: `serviceCatalogService` · `availabilityService` · `bookingService` ·
`appointmentService` · `customerService` · `availabilityRequestService` ·
`reportingService` · `aiAssistantService` · `notificationService`

### AI / Automation / Background Jobs (→ ARCHITECTURE.md, Inngest)

Inngest events dispatched write-only from the browser or emitted by Postgres triggers;
functions execute on a Supabase Edge Function:

- `appointment/booked` → confirmation or "held for approval" email + `.ics`, schedule
  reminders, alert the owner when approval is needed
- `appointment/approved` / `appointment/rejected` → notify the customer
- `appointment/reminder.due` → 24h and 2h reminders
- `appointment/completed` → thank-you, then review request
- `appointment/cancelled` / `appointment/rescheduled` → notify both sides, re-open slot
- `availability-request/created` → owner notification + customer acknowledgement
- `email/send` → SMTP send with retry, backoff and delivery logging
- `ai/daily-insights` (pg_cron) → utilisation, demand patterns, waitlist matches

AI capabilities, all advisory: match cancellations to waiting requests, flag
under-utilised days, surface repeatedly requested unavailable windows, recommend
opening hours changes, draft customer replies. Output lands in `ai_recommendations`
with status `pending` and does nothing until the owner accepts it.

### Integrations & External APIs (→ ARCHITECTURE.md / .env)

Supabase (auth, data, realtime, edge) · ImageKit (gallery and service imagery) ·
Sentry EU (monitoring) · Inngest (workflows, write-only browser key) · SMTP provider
(secrets server-side only) · AI provider (server-side only) · Google Business review
link (plain URL, no API).

Hard rule upheld: every browser-exposed key is either RLS-guarded or write-only.

### Non-functional & Security notes (→ RULES.md / AGENTS.md / SCHEMA.md)

FCP under 2s on broadband · WCAG 2.2 AA · TLS in transit, encryption at rest ·
UK GDPR with explicit marketing consent and a data-deletion path · retry with backoff
on all background jobs · owner dashboard readable offline · modular, strict-TypeScript
codebase · no secrets in the client bundle, ever.

### Naming & Branding (→ forge.config.json)

appName `Kokolett Beauty UK` · shortName `Kokolett` · slug `kokolett-beauty` ·
appUrl `https://www.kokolettbeauty.com` · themeColor `#e05d38` ·
backgroundColor `#e8ebed`

Palette and type as supplied. Tokens were given in Tailwind v4 `@theme inline` syntax;
this project is pinned to Tailwind 3.4, so they are declared as CSS custom properties
in `src/index.css` and referenced via `var()` from `tailwind.config.ts`. Values are
unchanged. Consequence: opacity modifiers (`bg-primary/50`) do not work against
`var()` colours.
