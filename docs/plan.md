## Punch list — Owner Console

Replaces the previous 24-step phased plan (2026-08-13), which three independent
reviews found mostly shipped or overtaken by decisions made along the way — see
`docs/history/2026-08-13-plan-review-ceo.md` for the full analysis and reasoning.
This is a flat, living list of what's actually open. When an item ships, delete it
rather than marking it done — `git log` is the record of what happened.

**Shipped, not tracked here any more:** the 7-nav owner console (Today, Inbox,
Calendar & Capacity, Bookings, Customers, Growth, Settings), the Approvals+Requests
merge into Inbox, cross-nav quick actions (`Cmd+K`), non-blocking dialogs (`Toast`/
`ConfirmDialog`), the Reports and AI Assistant pages, and the reschedule
duplicate-booking fix.

### Open

- [ ] **A11y — `SettingsPage.tsx` incomplete ARIA tabs.** Replace the
      `role="tablist"`/`role="tab"`/`aria-selected` markup (~line 164) with the plain
      button + `aria-pressed` pattern already used in `AssistantPage.tsx`. P1, small.
- [ ] **A11y — `InboxPage.tsx` Approvals/Requests toggle has no `aria-pressed` or
      `aria-selected`.** Screen-reader users get no selected-state cue. P1, small.
- [ ] **Migration-immutability violation — `0024`/`0025` were edited in place** after
      being live, instead of only via a follow-up migration (`docs/SCHEMA.md:10`'s own
      rule). `0026` already redid the fix correctly; the violation itself needs no
      further code change, but the next in-place edit should get caught in review. See
      `docs/history/2026-08-13-pr-review-gstack-init.md` for the full finding.
- [ ] **Race — `useAppointmentDrag.ts` shares one drag state across every calendar
      block.** `busy` only locks after a drop, not while a drag is in flight, so a
      second pointer can start dragging a different appointment mid-drag and the
      wrong one gets rescheduled. `DayView.tsx`/`WeekView.tsx` both pass the same
      `drag.beginDrag` to every block. Needs a per-drag identity check, not just
      `busy`. P1 — this is a data-integrity bug, not cosmetic.
- [ ] **Growth-nav is under-built relative to the PRD's own money metrics** — booking
      conversion, returning-customer rate and request-conversion have no dedicated
      surface. **Hold until the owner confirms the real constraint is booking
      volume/revenue rather than admin time** — don't scope this speculatively.
- [ ] **`docs/ARCHITECTURE.md` §2 service list and `docs/HOOKS.md`** should get a
      periodic pass against `src/services/` and `src/hooks/` — both drift fast in this
      project (see the 2026-08-14 docs cleanup for the last correction).

### Explicitly not doing

Dropped from the old plan as process sized for a team, not one owner: a second
observability dashboard (Sentry already covers this), a four-wave release
ceremony (one environment, one deploy path — `docs/DEPLOYMENT.md`), and recurring
formal capability-matrix audits (useful once, not worth maintaining as ceremony).
