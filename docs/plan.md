## Punch list — Owner Console

Replaces the previous 24-step phased plan (2026-08-13), which three independent
reviews found mostly shipped or overtaken by decisions made along the way.
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
      further code change, but the next in-place edit should get caught in review.
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
      headers are the record past that. A further pass ran 2026-08-30 (documented in
      `docs/KOKO_GAP.md` §4), fixing the migration range and Edge Function count again
      (7→9→10) plus an `ARCHITECTURE.md` §6b gap (a third AI surface, `draft-copy`,
      wasn't described). A third pass ran 2026-08-31 (migrations now at `0064`,
      Edge Functions at 11): fixed the stale function count in `RULES.md` §1
      (was still "seven"), resolved the `google_place_id` item below, added two new
      shared interaction primitives to `DESIGN.md` §15.4b, extended `HOOKS.md` §8/§18
      for fields those hooks had grown, and closed an `rls_test.sql` coverage gap for
      two tables (`email_template_revisions`, `product_events`) that had shipped
      without being added to the probe list, violating `RULES.md` §1's own rule. This
      drifts every ~1-2 weeks of active work — next pass due whenever migrations pass
      roughly `0075` or another Edge Function ships.
- [x] ~~`google_place_id` is unset~~ — **resolved.** It is now set in Settings →
      Business, `GOOGLE_PLACES_API_KEY` is set as an Edge Function secret, and reviews
      are syncing live: `google_place_snapshot` shows `rating: 5.0, rating_count: 11,
      last_error: null` (verified live via Supabase 2026-08-31). Everything else the
      owner had to key in is done: address, phone, Instagram, review link, 402
      published slots, 49 menu items, and the `HairSalon` structured data in
      `index.html` (`docs/GO-LIVE.md` was rewritten 2026-08-30 as an undated setup
      procedure; the dated 2026-08-19 completion record it replaced is no longer kept).

### Explicitly not doing

Dropped from the old plan as process sized for a team, not one owner: a second
observability dashboard (Sentry already covers this), a four-wave release
ceremony (one environment, one deploy path — `docs/DEPLOYMENT.md`), and recurring
formal capability-matrix audits (useful once, not worth maintaining as ceremony).
