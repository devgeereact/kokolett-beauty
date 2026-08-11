# Product Requirements — Kokolett Beauty UK

Version 3.1 · MVP · single salon, single owner
Production domain: `https://www.kokolettbeauty.com`

---

## 1. Overview

Kokolett Beauty UK is an appointment platform built for one salon rather than for a
market. It is not competing on feature count. It competes on the number of decisions
it removes — from the customer trying to book, and from the owner trying to run a
business alone.

The application is the salon's operational hub: marketing site, booking engine,
passwordless customer area, owner dashboard, AI operations assistant, automated email,
and reporting — all installable as an offline-capable PWA.

## 2. The problem

A single-owner salon loses money in three places. Customers abandon booking when it
requires an account. The owner loses hours to phone tag, diary juggling and
confirmation messages. And empty slots stay empty because nobody notices them in time.

Generic salon software solves this for a chain and charges per seat for capabilities
this business will never use. This product solves it for exactly one business.

## 3. Target users

**The owner.** Runs everything herself. Works irregular hours, usually with her hands
occupied. Needs the day's schedule in one glance on a phone. Values anything that
happens without her having to remember it.

**The customer.** Books a few times a year, on a phone, often in the evening. Will not
create an account. Wants certainty that the booking exists, and a reminder closer to
the day. May return six months later having forgotten everything except her email
address.

## 4. Booking model — hybrid

Availability-first, with a trust gate on the first visit.

The owner defines working hours, breaks, closures, service durations and buffers. The
engine generates slots from those rules, so customers only ever see times that are
genuinely open.

- **Returning customers** — anyone with at least one _completed_ appointment — are
  **confirmed instantly**. No wait, no approval.
- **First-time customers** are **held for owner approval**. The slot is reserved the
  moment they submit, so nobody else can take it, and the owner has a bounded window
  (default 12 hours, never past the appointment itself) to approve or decline. If the
  window elapses, the hold is released automatically and the slot returns to sale.

A prior cancellation or no-show does not earn instant booking. Trust is earned by
turning up.

**Why hybrid rather than pure instant:** the owner keeps a filter against no-shows and
prank bookings from strangers, while the customers who actually drive repeat revenue
get the frictionless path. The cost is a wait for first-timers, which is mitigated by
a clear "held — you'll hear within 12 hours" state and an immediate email.

### 4.1 Customer booking flow

```
Visit site → Select service → Choose open date → Choose time
  → Enter contact details → Review → Submit
      ├── returning customer → Confirmed instantly
      └── first-time customer → Held for approval (slot reserved)
                                    ├── owner approves → Confirmed
                                    └── owner declines / window elapses → Released
  → Confirmation email + .ics → Reminders (24h, 2h) → Appointment
  → Completed → Thank-you email → Google review request
```

### 4.2 When no slot exists

The customer is never dead-ended on an empty calendar. The page states plainly that
nothing is currently available and offers an **Availability Request**: name, email,
mobile, service, preferred dates, preferred times, flexibility (any / morning /
afternoon / evening), and notes.

On submit: the request is stored, the owner is emailed and sees it in the Availability
Requests inbox, and the customer receives an acknowledgement. The owner can open extra
availability, offer alternative dates, or decline. An accepted request produces a
secure single-use booking link that completes the reservation.

## 5. Appointment lifecycle

```
pending_approval ──approve──► confirmed ──► checked_in ──► in_service ──► completed
        │                         │
     reject /                  cancel / reschedule / no_show
   window elapsed
        ▼
     rejected
```

Every transition is owner-initiated except `pending_approval → rejected` on timeout,
and every transition emits an event that drives the appropriate email.

## 6. Passwordless identity

Customers are identified by **email**, with mobile as a secondary identifier. A
customer record is created or updated automatically at booking — the customer is never
asked to register.

Access to appointment history and management is granted by a **magic link**: a
single-use token, valid 30 minutes, delivered in any transactional email. Exchanging
it yields a 30-day customer session scoped to that one customer's records.

The owner authenticates through Supabase Auth (also a magic link) and is the only
account that can mutate salon data.

## 7. MVP feature set

**Marketing site** — Home, About, Services, Gallery, Testimonials, FAQs, Contact,
Privacy, Booking Policy, Terms.

**Booking** — service browsing, live availability, slot selection, details capture,
review, submit, instant confirm or approval hold, confirmation email with `.ics`,
reminders, self-service cancel and reschedule, one-tap rebook.

**Availability requests** — public form, owner inbox with new / awaiting response /
converted / declined states, filtering, priority indicators, one-click "offer this
slot".

**Owner dashboard** — today's schedule, calendar (day / week / month / agenda) with
drag-to-reschedule and conflict detection, approvals queue, appointments, customers,
services, availability rules, reports, AI assistant, settings.

**Customer management** — automatic creation, visit history, average spend, favourite
services, private notes, marketing consent, email history.

**Service management** — create, edit, archive, pricing, duration, buffer, category,
image, active toggle.

**Reports** — revenue, bookings, returning-customer rate, cancellation rate, no-show
rate, popular services, peak hours, review requests, trends.

**AI assistant (advisory only)** — matches cancellations to waiting requests, flags
under-utilised days, surfaces repeatedly requested unavailable windows, recommends
opening-hours changes, drafts customer replies. Output is a recommendation with status
`pending`. Nothing executes without an explicit owner action.

**Email automation** — booking held, booking confirmed, booking declined, reminder,
rescheduled, cancelled, completed, review request, availability request received,
availability offer. All branded, all logged, all retried on failure.

**PWA** — installable, offline app shell, cached read-only owner views, update prompt.

## 8. Success metrics

| Business                   | Product                                            |
| -------------------------- | -------------------------------------------------- |
| Monthly confirmed bookings | Booking completion rate                            |
| Booking conversion rate    | Time from landing to confirmation (target < 2 min) |
| Returning-customer rate    | Approval turnaround time (target < 4 h)            |
| Google review conversion   | Email delivery success rate (target ≥ 99%)         |
| Appointment utilisation    | Magic-link exchange success rate                   |
| Average booking value      | AI recommendation acceptance rate                  |
| Cancellation rate          | Dashboard time-to-interactive                      |
| No-show rate               | Availability-request conversion rate               |

## 9. Non-functional requirements

- **Performance** — first contentful paint under 2s on broadband; the booking flow
  must remain usable on a mid-range phone over 4G.
- **Accessibility** — WCAG 2.2 AA. The booking flow is fully keyboard-operable and
  screen-reader labelled; this is a hard gate, not an aspiration.
- **Security** — TLS in transit, encryption at rest, RLS on every table, no secret
  ever present in the client bundle.
- **Privacy** — UK GDPR. Explicit marketing consent, separate from booking consent.
  A documented deletion path. Sentry in the EU region with PII scrubbing on.
- **Reliability** — every background job retries with exponential backoff; email
  failures surface in an owner-visible queue rather than disappearing.
- **Offline** — the owner dashboard remains readable from cache when offline, with a
  visible "showing cached data" banner. Offline **writes are not supported in V1**;
  attempting one is blocked with an explanation rather than queued, because a queued
  booking mutation can conflict with reality by the time it syncs.
- **Availability** — 99.9% is the target, but it is a property of Supabase and the
  cPanel host. The application offers no SLA of its own.

## 10. Out of scope for V1

Multiple stylists · payroll · inventory · POS · online payments and deposits ·
subscriptions · loyalty programme · SMS · WhatsApp · marketplace · multi-tenant SaaS ·
franchise management · gift cards · public API.

The schema is shaped so several of these can be added without migration pain — most
notably multi-stylist, which becomes a `staff_id` on `appointments` plus a per-staff
availability scope. That is deliberate preparation, not permission to build it now.

## 11. Roadmap

**V1.1** — SMS and WhatsApp reminders, deposit payments, customer profile editing,
richer reporting.

**V2** — multiple stylists, staff permissions, resource allocation, commission
tracking, POS, inventory, loyalty, gift cards.

**V3** — AI demand forecasting, dynamic scheduling, customer segmentation, marketing
automation, native apps.

## 12. Acceptance criteria

The product is production-ready when:

- Every journey runs end to end from landing to review request, with no dead ends,
  no placeholder screens and no unhandled empty states.
- Instant confirmation works for returning customers; approval holds work for
  first-timers, including automatic release on timeout.
- Concurrent booking attempts on the same slot produce exactly one appointment and a
  clear, recoverable message for the loser.
- Magic links authenticate customers, expire correctly, and cannot be replayed.
- Every lifecycle transition fires its email; every email is logged and retried.
- AI output is advisory and cannot mutate data without an explicit owner action.
- The app installs as a PWA and the owner dashboard is readable offline.
- Axe reports zero critical violations on the booking flow.
