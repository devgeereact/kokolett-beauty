# Email screen — design-match log

Target: `EmailPage.tsx`, route `/dashboard/email`. Ref: `docs/design/email.png`.

`build-loop.md` flagged this as "currently an EmptyState stub" — stale.
Like Reports/Assistant/Notifications, it's already a real, complete
rebuild, with the exact architectural reasoning already documented in the
file.

## Already built — and a real, deliberate scope cut

The reference is a full two-way email client: Inbox/Sent/Drafts/Scheduled/
Archived/Trash folders, Compose, Reply/Forward, star/archive/delete, and a
contact sidebar with open/click engagement tracking, related bookings,
notes and tags.

None of that is real here, and the file's docstring says exactly why:
`email_messages` is a **one-way transactional log** — an Inngest worker
sends confirmations/reminders/receipts; nobody composes, receives, or
replies to mail inside this dashboard. So the build is a list-and-detail
*view* over that log — All mail/Sent/Queued/Failed lanes (matching the real
`email_status` enum, not invented folders), no Compose, no Drafts/Trash/
Archived (nothing populates them), no reply/forward, no star (no schema
column for it). Verified against real data: 136 real outbox rows, several
genuinely `Failed` (real SMTP `550` bounces against `*.invalid` demo
addresses — honest failure data, not styled as fake).

## Iteration 1 — one real gap: no link back to the customer

The reference's contact sidebar has "View customer profile." The rebuild
dropped the whole sidebar (open/click tracking, related bookings, notes,
tags all have no backing data) but also dropped this one link along with
it — even though `email_messages.customer_id` is a real column.

- Added a "View customer →" link next to the status badge in the detail
  header, shown only when `customer_id` is present, pointing to
  `${routes.owner.customers}?customer=${id}` — `CustomersPage.tsx` already
  handles that exact query param (built for this same cross-link pattern
  elsewhere). Verified live: click opens Customers, lands directly on
  Adaeze Okonkwo's real profile modal, matching data.

Considered also linking `appointment_id` (also a real column, would match
the reference's "Related bookings → View booking") but `AppointmentsPage.tsx`
has no query-param deep-link handling for a specific appointment id — unlike
Customers, that plumbing doesn't exist yet on the receiving page. Building
it would mean changing a second, unrelated page as a side effect of this
one; left it out and logged it here as a reasonable follow-up rather than
scope-creeping into another screen.

## Not implemented — logged, not guessed at

- Compose / reply / forward / star / archive / delete — no real capability
  behind any of them (no inbound mail, no engagement tracking, no
  soft-delete column on `email_messages`).
- Contact-details sidebar's "Email activity" (Opened/Clicked/Replied
  timeline) — would need open-tracking pixels and link-redirect tracking,
  neither of which this transactional sender implements.
- Prev/next navigation within the detail view ("1 of 24" in the
  reference's toolbar) — the list-to-detail click already does this job;
  adding a second redundant nav control wasn't judged worth the space.

## Verification

Dark theme and mobile (390×844) both checked — clean, reflows correctly.
`npx vitest run`: 154/154 passing. `tsc --noEmit` clean for every file this
change touched (pre-existing, unrelated `DayView.tsx` errors excluded — see
`notification-log.md` for that issue, still unresolved and not this
task's).

## Stop

Converged after 1 iteration — closed the one real gap (customer link) on
top of an already-complete, honestly-scoped rebuild.
