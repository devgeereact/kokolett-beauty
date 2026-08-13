## Plan: 2026 Owner-First Full Product Upgrade

Rebuild the app as an owner-operations platform (not just UI polish) using a phased rollout: first remove friction and duplicated workflows, then ship a simplified 7-nav owner console, then deliver missing production modules (Reports, AI Assistant, Email Ops), and finally harden reliability, accessibility, and performance. Core principle: reduce owner time-to-complete daily operations while preserving booking integrity and static-PWA constraints.

**Steps**

### Phase 0 — Product truth alignment (blocks all other phases)

1. Baseline the current state vs docs and routes to eliminate planning drift: reconcile implemented behavior with `docs/PRD.md`, `docs/ARCHITECTURE.md`, and current mounted routes in `src/App.tsx` (_blocks all phases_).
2. Create a source-of-truth capability matrix (Implemented / Partial / Missing) for each owner job: day operations, queue management, booking management, customer management, growth, system settings (_depends on step 1_).

### Phase 1 — Information architecture redesign (owner speed first)

3. Replace current dashboard IA with a simplified 7-nav model (_depends on Phase 0_):
   - Today
   - Inbox
   - Calendar & Capacity
   - Bookings
   - Customers
   - Growth
   - Settings
4. Remove duplicated “Appointments” experiences by assigning single responsibility:
   - Today = live day execution only
   - Bookings = full-list search/filter/history/status management
   - Calendar = schedule visualisation + slot management only
5. Consolidate `Approvals` + `Requests` into `Inbox` with tabbed/segmented queues and SLA indicators (age, expiring soon, next action) (_depends on step 3_).
6. Move hidden operational pages into visible IA:
   - `WeeklyDefaultPage` and `AppointmentTypePage` become first-class under Calendar & Capacity.
7. Temporarily remove or relabel dead-nav entries until implemented (Reports, AI Assistant) to preserve trust (_parallel with steps 3-6_).

### Phase 2 — Workflow redesign per nav (productivity contracts)

8. Define explicit “owner outcome” per nav and reject any feature not tied to time-saved outcomes (_depends on Phase 1_):
   - Today: run today in <10 minutes of admin overhead.
   - Inbox: clear all pending decisions with batched actions.
   - Calendar & Capacity: adjust supply without side effects.
   - Bookings: find/update any appointment in <15s.
   - Customers: act from customer context (rebook, notes, communication).
   - Growth: manage website-facing offer/requests/subscribers/reviews.
   - Settings: stable business rules and integration controls.
9. Introduce cross-nav quick actions (global command bar style interactions) for owner-critical tasks: new booking, mark completed, offer slot to request, rebook customer (_depends on step 8_).
10. Eliminate blocking browser dialogs and replace with consistent in-app confirmations, toasts, and undo where safe (_parallel with step 9_).

### Phase 3 — Missing production modules (major capability gaps)

11. Build `Reports` as an actual module (not redirect) with owner-usable operational metrics first (_depends on Phase 2_):

- Today/weekly revenue and utilisation
- Approval turnaround
- Request conversion funnel
- No-show/cancellation trends

12. Build `AI Assistant` as advisory-only queue with explicit owner actions (accept/dismiss/convert to draft action), never direct mutation of business tables (_depends on step 11 for data foundations_).
13. Add `Email Ops` module to expose failed/bounced outbox, retry state, and actionability for delivery issues (_parallel with steps 11-12_).

### Phase 4 — Data correctness, integrity, and safety hardening

14. Fix owner reschedule semantics to ensure true reschedule lifecycle linkage (not duplicate-rebook behavior) (_depends on Phase 1 route/workflow ownership_).
15. Add contract-level guards for all write-critical RPC workflows: book, approve/reject, status transitions, offer slot, customer reschedule (_depends on step 14_).
16. Add owner-visible operational safeguards:

- stale pending approvals alerts
- conflict prevention messaging
- queue fairness transparency for requests.

### Phase 5 — UX/Design system modernization to 2026 quality

17. Resolve design-system drift and token misuse (font contract, token-safe translucency, primitive consistency) (_parallel with Phase 4_).
18. Standardize component behavior for density modes and responsiveness (mobile owner console + desktop efficiency).
19. Upgrade interactions:

- keyboardable calendar interactions
- accessible drawer/dialog behavior
- reliable feedback patterns for all state-changing actions.

20. Apply modern perceived-performance patterns: skeletons, optimistic non-destructive updates, and route-level bundle splitting (_depends on component standardization_).

### Phase 6 — Reliability, observability, QA, and release governance

21. Expand automated test coverage to mission-critical owner workflows and booking integrity invariants (_depends on Phases 3-4_).
22. Add production operational dashboards/alerts for email queue health, realtime subscription health, and error trends (_parallel with step 21_).
23. Run structured UAT by owner task journeys (open app → run day → close day) and harden based on measured friction.
24. Execute phased release:

- Wave A: IA + workflow cleanup (no risky data changes)
- Wave B: Reports + Email Ops
- Wave C: AI Assistant advisory queue
- Wave D: final polish + docs parity.

**Relevant files**

- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/App.tsx` — owner route map, current redirects (`/dashboard/reports`, `/dashboard/assistant`), route ownership.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/lib/routes.ts` — canonical route constants for nav redesign.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/components/dashboard/DashboardLayout.tsx` — sidebar entry model and mobile drawer behavior.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/TodayPage.tsx` — daily execution workflow and current reschedule path.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/AppointmentsPage.tsx` — list/search/status management scope.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/CalendarPage.tsx` — calendar ownership boundary and keyboard interaction requirements.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/ApprovalsPage.tsx` — approvals queue behaviors.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/RequestsPage.tsx` — request queue behaviors and offer flow.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/CustomersPage.tsx` — customer productivity features and quick actions.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/ServiceMenuPage.tsx` — current “Services” behavior (to become Growth sub-area).
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/AppointmentTypePage.tsx` — appointment type/capacity controls.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/WeeklyDefaultPage.tsx` — weekly template/capacity controls.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/pages/dashboard/SettingsPage.tsx` — settings scope reduction and reclassification.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/components/dashboard/AppointmentCard.tsx` — status actions, confirmations, notes interaction model.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/components/dashboard/NewBookingPanel.tsx` — owner booking creation flow.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/services/appointmentService.ts` — lifecycle transitions and owner actions.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/services/requestService.ts` — fairness-aware request queue operations.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/services/dashboardService.ts` — summary data and report foundation.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/services/bookingService.ts` — booking boundary and error mapping.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/services/customerSessionService.ts` — customer session + self-service lifecycle.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/src/index.css` — token layers, motion/accessibility baselines.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/tailwind.config.ts` — design token mapping and status/sidebar scales.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/index.html` — font loading and global shell consistency.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/supabase/migrations/0003_owner_ops.sql` — owner RPCs and dashboard summary contract.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/supabase/migrations/0007_availability_is_the_gate.sql` — queue fairness and availability gate policy.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/supabase/migrations/0011_slots_are_the_model.sql` — slot model and booking constraints.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/supabase/migrations/0019_calendar_feed_and_owner_booking.sql` — owner booking + feed controls.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/supabase/migrations/0022_slots_and_mail_keep_their_promises.sql` — customer reschedule/cancel and outbox guarantees.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/supabase/functions/send-emails/index.ts` — delivery pipeline and owner-visible email health needs.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/docs/PRD.md` — target outcomes and roadmap alignment.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/docs/ARCHITECTURE.md` — route/data flow boundaries.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/docs/SCHEMA.md` — data guardrails and status semantics.
- `/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/docs/DESIGN.md` — accessibility + token governance.

**Verification**

1. IA verification: run route-audit checklist confirming no dead nav links, no duplicate appointment surfaces, and all owner-critical pages reachable in ≤2 clicks.
2. Workflow verification: task-based UAT scripts for owner jobs:
   - “Open day and process first 10 minutes”
   - “Clear pending queue”
   - “Reschedule safely”
   - “Recover from slot conflict”.
3. Integrity verification: lifecycle invariants test matrix for booking + status transitions + request conversion + approval timeouts.
4. Accessibility verification: keyboard-only pass for booking and dashboard core paths; focus order, dialog behavior, and status announcements.
5. Performance verification: compare before/after for initial load JS size, owner route TTI, and interaction latency after route splitting.
6. Reliability verification: simulated email failures, retry outcomes, and owner observability for failed/bounced states.
7. Security/privacy verification: confirm advisory-only AI boundaries, no client direct writes to protected tables, and no PII leakage in monitoring.
8. Quality gates before each release wave: `npm run typecheck`, `npm run lint`, test suite pass, and domain UAT sign-off.

**Decisions**

- Rollout approach: phased (not big-bang).
- AI scope: advisory-only with explicit owner action.
- Nav strategy: simplified 7-nav model.
- Primary KPI: reduce owner daily time spent.
- Constraints: no additional constraints provided.
- Included scope: full owner-console restructure + missing production modules + reliability/design-system hardening.
- Excluded scope: multi-stylist, POS, payments/deposits, loyalty, SMS/WhatsApp, native apps, and other out-of-scope PRD items.

**Further Considerations**

1. Inbox composition detail: Option A combine Approvals + Requests with tabs (recommended), Option B single interleaved priority queue, Option C keep separate nav but shared components.
2. Reports depth in first release: Option A operations-first MVP (recommended), Option B finance-heavy dashboards first, Option C full BI-style rollout.
3. AI activation policy: Option A advisory queue only (recommended), Option B advisory + one-click prepared actions with confirmation, Option C deferred until reports maturity.
