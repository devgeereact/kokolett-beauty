## Punch list — Owner Console

Replaces the previous 24-step phased plan (2026-08-13), which three independent
reviews found mostly shipped or overtaken by decisions made along the way — see
`docs/history/2026-08-13-plan-review-ceo.md` for the full analysis and reasoning.
This is a flat, living list of what's actually open. When an item ships, delete it
rather than marking it done — `git log` is the record of what happened.

**Shipped, not tracked here any more:** the grouped owner console sidebar, the
Approvals+Requests merge into Inbox, cross-nav quick actions (`Cmd+K`), non-blocking
dialogs (`Toast`/`ConfirmDialog`), the Reports and AI Assistant pages, and the
reschedule duplicate-booking fix.

The sidebar's real groups are **Workspace** (Dashboard, Calendar, Appointments),
**Bookings** (Approvals, Availability Requests), **Customers**, **Salon** (Services,
Availability), **Insights** (Reports, AI Assistant), **Communications** (Notifications,
Email, Templates) and **Account** (Settings) — see
`src/components/dashboard/DashboardLayout.tsx`. Three planning documents described a
"Today / Inbox / Calendar & Capacity / Bookings / Customers / Growth / Settings" nav
that was never built; this list used to repeat it.

### Open

- [ ] **Migration-immutability violation — `0024`/`0025` were edited in place** after
      being live, instead of only via a follow-up migration (`docs/SCHEMA.md:10`'s own
      rule). `0026` already redid the fix correctly; the violation itself needs no
      further code change, but the next in-place edit should get caught in review. See
      `docs/history/2026-08-13-pr-review-gstack-init.md` for the full finding.
- [ ] **Growth-nav is under-built relative to the PRD's own money metrics** — booking
      conversion, returning-customer rate and request-conversion have no dedicated
      surface. **Hold until the owner confirms the real constraint is booking
      volume/revenue rather than admin time** — don't scope this speculatively.
- [ ] **The docs drift fast — they need a periodic pass against the code.** Last done
      2026-08-24, which found and fixed: the migration range (three files said `0039`,
      disk had `0046`), a **sixth** `pg_cron` job that three files still counted as
      five (`purge-expired-personal-data`, added by `0046`), the second reminder
      (`0018` moved it from 2h to 1h; PRD and ARCHITECTURE still said 2h), four
      references to `availability_rules`/`availability_exceptions` as if they were live
      tables (`0011` dropped both), `ARCHITECTURE.md` §6's whole data-flow example
      (stale route, stale service, stale RPC arity), §6a's "client dispatch" trigger
      column (a leftover from the Inngest design), and the completion email
      (`appointment_completed`, always, not `review_request` when a URL is set).
      `SCHEMA.md` §8's narrative still stops at `0027` by design — the migration file
      headers are the record past that.
- [ ] **`google_place_id` is unset**, deliberately — the reviews sync stays idle and the
      public Reviews block renders nothing (a clean empty state, not a fault). Two
      separate places, both required before reviews appear: `google_place_id` in
      Settings → Business, and the `GOOGLE_PLACES_API_KEY` Edge Function secret
      (`supabase secrets set`) — the one secret deliberately left unset. Everything
      else the owner had to key in is done: address, phone, Instagram, review link,
      402 published slots, 49 menu items, and the
      `HairSalon` structured data in `index.html` (`docs/GO-LIVE.md` §4).

### Explicitly not doing

Dropped from the old plan as process sized for a team, not one owner: a second
observability dashboard (Sentry already covers this), a four-wave release
ceremony (one environment, one deploy path — `docs/DEPLOYMENT.md`), and recurring
formal capability-matrix audits (useful once, not worth maintaining as ceremony).
