# Product Requirements — Kokolett Beauty UK

Version 3.2 (2026-08-14: booking model, marketing IA and pricing sections brought in
line with shipped behaviour) · MVP · single salon, single owner
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

## 4. Booking model — availability is the gate

The owner publishes exactly the hours she is willing to work. Anything inside them
books **instantly, for anyone, new or returning** — there is no approval step on the
happy path. When nothing is open, the customer submits a request instead, and it is
the _request_ that gets approved: requests are offered slots first-come-first-served,
so a last-minute cancellation is reachable by whoever asked first.

This replaced an earlier hybrid design (returning customers instant, first-timers held
for approval) on 2026-08-07 — see `docs/SCHEMA.md` §11 for the migration and the
reasoning. The hybrid machinery still exists in the schema as a fallback
(`booking_settings.approve_first_time`, currently `false`) and costs nothing to keep,
but is not how the product behaves today.

### 4.1 Customer booking flow

```
Visit site → Choose open date → Choose time → Enter contact details → Review → Submit
  → Confirmed instantly
  → Confirmation email + .ics → Reminders (24h, 1h) → Appointment
  → Completed → Thank-you email → Google review request
```

There is no per-service selection step: the salon has one appointment type (see §7,
"no fixed price"), so length is fixed and the booking flow goes straight from date to
time.

### 4.2 When no slot exists

The customer is never dead-ended on an empty calendar. The page states plainly that
nothing is currently available and offers an **Availability Request**: name, email,
mobile, preferred dates, preferred times, flexibility (any / morning / afternoon /
evening), and notes.

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

**Marketing site** — reinstated as a real multi-page site 2026-08-25 (Home, About,
Gallery, Services, Testimonials, FAQs, Contact), reversing the single-page
simplification this section used to describe. Home carries the hero, next-available,
a services teaser and the closing CTA; the Google-reviews block also anchors the
Testimonials page. Privacy, Booking Policy and Terms remain standalone.

**No fixed price.** The salon has one appointment type; what it costs is agreed in
the chair, not quoted online. The owner logs what was actually charged after the
appointment (`docs/SCHEMA.md` migration `0027`) and the Today page's "Collected
today" reflects that log, not a price list.

**Booking** — live availability, slot selection, details capture, review, submit,
instant confirmation, confirmation email with `.ics`, reminders, self-service cancel
and reschedule, one-tap rebook.

**Availability requests** — public form, owner inbox with new / awaiting response /
converted / declined states, filtering, priority indicators, one-click "offer this
slot".

**Owner dashboard** — today's schedule, calendar (day / week / month / agenda) with
drag-to-reschedule and conflict detection, approvals queue, appointments, customers,
services, availability rules, reports, AI assistant, settings.

**Customer management** — automatic creation, visit history, average spend, favourite
services, private notes, marketing consent, email history.

**Service menu management** — the salon's styles as shown on the website (create,
edit, archive, image, category, active toggle) — descriptive content, not a
bookable, priced catalogue. The single appointment type's length and buffer are
managed separately, on their own settings page.

**Reports** — revenue, bookings, returning-customer rate, cancellation rate, no-show
rate, popular services, peak hours, review requests, trends.

**AI assistant (advisory only)** — flags conflicts and reschedule opportunities,
drafts customer email replies, and surfaces messages, analytics, trends and repeat
customers. Computed live in the browser from data the dashboard already has
(`src/lib/insights.ts`) — not a queued recommendation an Edge Function writes.
Nothing it produces executes without an explicit owner action; see
`docs/ARCHITECTURE.md` §6b for the mechanism.

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
| Average booking value      | Assistant proposals confirmed by the owner         |
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
- Instant confirmation works for anyone booking inside published hours; requests
  raised against a full calendar are offered slots first-come-first-served.
- Concurrent booking attempts on the same slot produce exactly one appointment and a
  clear, recoverable message for the loser.
- Magic links authenticate customers, expire correctly, and cannot be replayed.
- Every lifecycle transition fires its email; every email is logged and retried.
- AI output is advisory and cannot mutate data without an explicit owner action.
- The app installs as a PWA and the owner dashboard is readable offline.
- Axe reports zero critical violations on the booking flow.
