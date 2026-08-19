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
- [ ] **`docs/ARCHITECTURE.md` §2 service list and `docs/HOOKS.md`** should get a
      periodic pass against `src/services/` and `src/hooks/` — both drift fast in this
      project (see the 2026-08-14 docs cleanup for the last correction).
- [x] ~~**Owner data.**~~ Done: address, phone, Instagram and review link are set, 402
      slots are published and the service menu has 49 items. Only `google_place_id`
      remains, deliberately.
- [ ] **Owner data (remainder).** The salon's real address, phone, opening hours, service menu and
      Google review URL still have to be entered in Settings. The footer and the policy
      pages render nothing where they are blank, and the `HairSalon` structured data in
      `index.html` cannot claim `address`/`telephone`/`openingHours` until they exist.
- [x] ~~**`.env` for the production build.**~~ Done: `VITE_APP_URL` is the www form,
      Sentry is live on a real EU DSN. The ImageKit endpoint is still a placeholder and
      that is fine, since all 49 menu items have a null `image_path`.
- [ ] **`.env` (superseded).** The live bundle was built from
      `.env.example` placeholders: `VITE_APP_URL` pointed at the **non-www** apex (it
      feeds the owner's magic-link redirect), the ImageKit endpoint was
      `your_imagekit_id`, and the Sentry DSN was a placeholder, so error reporting is
      off in production.
- [ ] **CI runs no SQL.** No `supabase db push`, no lint, no migration-apply check, no
      pgTAP — a migration that cannot apply reaches production undetected, which has
      happened once already (0002 created `citext` after the table that used it).
- [ ] **No RLS tests.** Nothing asserts that anon cannot read `appointments` or
      `customers`, or that a non-owner authenticated session is denied. The whole
      security model is unverified by any automated check. Highest-value test to add.

### Explicitly not doing

Dropped from the old plan as process sized for a team, not one owner: a second
observability dashboard (Sentry already covers this), a four-wave release
ceremony (one environment, one deploy path — `docs/DEPLOYMENT.md`), and recurring
formal capability-matrix audits (useful once, not worth maintaining as ceremony).
