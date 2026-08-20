# Eng Review — `docs/plan.md` ("2026 Owner-First Full Product Upgrade")

Mode: eng-manager, non-interactive. Every internal decision point below that would
normally go through `AskUserQuestion` was resolved by me using engineering judgment —
each one is called out explicitly under **Judgment calls made without a human** at the
end, so you can revisit any of them. No file outside `docs/fresh/plan-eng-review.md`
was modified; `docs/plan.md` and every other tracked file are untouched.

---

## Executive summary

`docs/plan.md` is well-structured as a document, but it is reviewing a codebase that
no longer exists. The plan was committed at **2026-08-13 16:38:27**. Two other docs —
`docs/history/2026-08-13-baseline-audit.md` and `docs/history/2026-08-13-capability-matrix.md` — were committed **almost two
hours earlier that same day** (14:39:57), and between the commit those audits were
graded against (`acc7117`) and current `HEAD` (`4727434`), **29 more commits touched
`src/`**, including the entire 7-nav restructure, the Inbox merge, and the Cmd+K quick
actions. Concretely:

- **Phase 0** (steps 1–2, "blocks all other phases") is already done. Its two
  deliverables — a route/docs baseline audit and an owner-capability matrix — exist as
  committed files, dated the same day as the plan and older than several commits the
  plan's own file list doesn't know about.
- **Phase 1** (7-nav model, Inbox consolidation, Calendar & Capacity grouping) is
  shipped, not planned. `DashboardLayout.tsx`'s nav array is annotated
  `// The seven core owner workflows (docs/plan.md Phase 1 step 3)` — the code already
  cites this plan by section number.
- **Phase 2 step 9** (cross-nav quick actions / command-bar) is shipped:
  `QuickActionLauncher.tsx` + a 406-line test file, wired as Cmd+K in
  `DashboardLayout.tsx`.
- **Phase 3 steps 11–12** ("missing production modules… Reports, AI Assistant") are
  false as written. Both are real, mounted, non-redirect pages today. Reports and the
  AI Assistant's advisory modules are pure client-side computation over data already
  fetched — **zero new RPCs**, contrary to what "with new RPCs" in the phase header
  implies for these two.
- **Phase 1 step 7** ("relabel dead-nav entries… Reports, AI Assistant") was already
  tried and explicitly reversed. `DashboardLayout.tsx:75-81` carries a comment saying
  exactly that: _"kept reachable, visually secondary rather than hidden or relabelled…
  neither is a stub or redirect."_ The plan and the shipped code disagree, and nothing
  in the plan acknowledges the reversal.
- A **sibling, uncoordinated worktree** (`feat/today-payment-log`) has already landed
  migration `0027` (a payments log table + `log_payment` RPC) with its own plan doc —
  entirely outside `docs/plan.md`'s scope and file list, but squarely inside what
  Phase 4 ("guards for all write-critical RPC workflows") would need to cover once
  merged.

None of this means the plan's _ideas_ are wrong — the reschedule-semantics bug it
flags in Phase 4 step 14 is real and well-evidenced (see below). It means the plan, as
currently written, will mislead anyone who executes it in order: they'll re-derive
Phase 0's baseline (already done), re-plan Phase 1's IA (already shipped), and
over-scope Phase 3 as new-module construction (already 80% built) before reaching the
one phase — data-integrity hardening — that's actually still open and actually
urgent.

**Recommendation: re-baseline `docs/plan.md` before anyone executes it.** Fold in
`docs/history/2026-08-13-baseline-audit.md` and `docs/history/2026-08-13-capability-matrix.md` as inputs, re-run route/nav discovery
against current `HEAD` (not `acc7117`), reconcile the `feat/today-payment-log`
worktree's schema/RPC additions, and rewrite Phases 0–2 as a changelog of what already
shipped plus what's still open, rather than a forward plan. Phases 3–6 need re-scoping
once that baseline is current, since their effort estimates (implicitly, "build two
missing modules") are wrong.

---

## Step 0 — Scope challenge

1. **What already partially/fully solves each sub-problem?** Nearly everything in
   Phases 0–2. See "What already exists" below — this is the single largest finding.
2. **Minimum set of changes to achieve the stated goal?** Given the above, the
   near-term minimum isn't "execute Phases 0–2" — it's "audit what's already shipped,
   close the four or five specific capability gaps `docs/history/2026-08-13-capability-matrix.md` already
   found (orphaned routes, 30-day search cap, split reschedule mechanisms, missing
   request history), then start Phase 3/4 fresh." That's a materially smaller plan
   than the 24-step document implies.
3. **Complexity check (8+ files / 2+ new services triggers a challenge):** The plan's
   own "Relevant files" section lists 26 files/paths. That would normally trigger a
   scope challenge, but nearly all of them are _read_ targets for Phase 0 discovery,
   not new files — the actual new-build surface (once Phase 0/1/2 are recognized as
   done) is much smaller: Email Ops (new page + maybe one new RPC), the reschedule-fix
   (one service function swap), and RPC contract guards (test-only, no new prod code).
   Verdict: **does not trigger** once re-scoped; the raw file count is a Phase-0
   discovery artifact, not a build-surface signal.
4. **Search-before-building:** No new infra pattern is introduced (no new queueing
   system, no new state machine framework) — everything stays inside the existing
   Postgres-RPC + client-service pattern. `[Layer 1]` — reuse the existing pattern, no
   search needed.
5. **Completeness check:** The plan is a strategy doc, not an implementation plan, so
   "100% coverage" doesn't apply directly yet — but its own Phase 6 test-coverage step
   (21) is under-specified for what "expand automated test coverage" means at the RPC
   layer. See Test Review below.
6. **Distribution check:** N/A — this is a web PWA already deployed via the existing
   `cpanel-deploy` pipeline; no new artifact type.

**Verdict:** scope is not overbuilt in absolute file count, but it is **badly
mis-scoped in effort allocation** — most of the planned effort for Phases 0–2 has
already been spent, and the plan doesn't know it. Re-scoping (not cutting) is the
right move.

---

## What already exists (required section)

| Plan item                                                                | Status in current `HEAD`                                      | Evidence                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0 step 1 (baseline vs docs/routes)                                 | **Done**                                                      | `docs/history/2026-08-13-baseline-audit.md`, commit `c00a9fb`/`f382d1b`/`b01c8ad`, dated 2026-08-13 14:39:57 — before `plan.md`'s own commit                                                                                                                                   |
| Phase 0 step 2 (capability matrix)                                       | **Done**                                                      | `docs/history/2026-08-13-capability-matrix.md`, same commit `b01c8ad`                                                                                                                                                                                                          |
| Phase 1 step 3 (7-nav model)                                             | **Done**                                                      | `src/components/dashboard/DashboardLayout.tsx:57-73`, comment cites "docs/plan.md Phase 1 step 3" directly                                                                                                                                                                     |
| Phase 1 step 5 (Inbox merges Approvals+Requests)                         | **Done**                                                      | `src/App.tsx:76-84` (redirects `/dashboard/approvals`→`inbox?tab=approvals`, `/dashboard/requests`→`inbox?tab=requests`), `src/pages/dashboard/InboxPage.tsx` (392 lines) + `InboxPage.test.tsx` (220 lines)                                                                   |
| Phase 1 step 6 (WeeklyDefault/AppointmentType under Calendar & Capacity) | **Done**                                                      | `src/components/dashboard/CalendarCapacityTabs.tsx` (shared sub-nav across `CalendarPage`/`AppointmentTypePage`/`WeeklyDefaultPage`), `DashboardLayout.tsx` `activePaths` grouping                                                                                             |
| Phase 1 step 7 (relabel/remove Reports & Assistant nav)                  | **Tried and reversed**                                        | `DashboardLayout.tsx:75-81`: _"Real, shipped pages that sit outside the plan's 7-nav model — kept reachable, visually secondary rather than hidden or relabelled… neither is a stub or redirect."_                                                                             |
| Phase 2 step 9 (cross-nav quick actions)                                 | **Done**                                                      | `src/components/dashboard/QuickActionLauncher.tsx` + `QuickActionLauncher.test.tsx` (406 lines), Cmd+K, wired in `DashboardLayout.tsx` header                                                                                                                                  |
| Phase 2 step 10 (kill blocking browser dialogs)                          | **Mostly done**                                               | `ConfirmDialog.tsx` + test exist; `TodayPage` has an undo banner per `docs/history/2026-08-13-capability-matrix.md` §1. Not independently re-verified for zero remaining `window.confirm`/`alert` — flagged as a doubt, not a finding.                                         |
| Phase 3 step 11 (Reports module)                                         | **Done, zero new RPCs**                                       | `src/pages/dashboard/ReportsPage.tsx` (132 lines) + `src/services/reportsService.ts` — pure aggregation over `listAppointments`/`listWeeklyTemplate`/`listCustomers` (existing reads) via `src/lib/insights.ts`                                                                |
| Phase 3 step 12 (AI Assistant advisory queue)                            | **Substantially done, different mechanism than plan implies** | `src/pages/dashboard/AssistantPage.tsx` (81 lines, 8 real panel modules) + `src/lib/insights.ts` — client-side, deterministic, zero Supabase writes. See Architecture Review §1 for the open ambiguity this leaves.                                                            |
| Phase 3 step 13 (Email Ops)                                              | **Backend exists, UI doesn't**                                | `supabase/migrations/0005`/`0006` (outbox), `0014` (drain-on-schedule cron), `0016` (retire unsent mail) — the data model and the drain job are live; there is no owner-facing page over it                                                                                    |
| Phase 4 step 14 (reschedule semantics bug)                               | **Real, still open**                                          | `TodayPage.tsx`'s inline reschedule calls `createAppointmentAsOwner` (duplicate-creation) instead of `rescheduleAppointmentAsOwner` (atomic retire-and-recreate) — confirmed independently by `docs/history/2026-08-13-capability-matrix.md` §1 and §3's cross-cutting finding |

---

## NOT in scope (required section)

Deferred with rationale — these surfaced during the review but are outside what an
eng review of a planning document should resolve:

- **Rewriting `docs/plan.md` itself.** This review's job is to assess the document,
  not to rewrite it — the task explicitly forbids editing `docs/plan.md`. The
  re-baseline recommendation above is the deliverable; executing it is separate work.
- **Reconciling `feat/today-payment-log`'s migration `0027` into `docs/plan.md`'s file
  list.** Flagged as a real gap (see Architecture Review §4) but fixing it means
  editing the plan, which is out of scope for this review.
- **Verifying `docs/history/2026-08-13-baseline-audit.md`'s "doubts / not fully verified" items**
  (`pg_cron` job existence, `send-emails` Edge Function body, `useRealtimeAppointments`
  internals). Those audits already flagged them honestly as unverified; re-verifying
  them is Phase-0-refresh work, not eng-review work.
- **Auditing every one of the plan's 26 "Relevant files" line by line.** The ones that
  matter for this review's specific asks (architecture soundness, phase dependencies,
  Phase 3/4 feasibility, Verification adequacy) were read in full; the rest were
  sampled via the two existing audit docs, which already did this exhaustively.

---

## Architecture review

### 1. AI Assistant's mechanism ambiguity carries into Phase 3 step 12 unresolved

`docs/history/2026-08-13-capability-matrix.md` §"AI assistant" and `docs/history/2026-08-13-baseline-audit.md` finding #6 already
establish: `docs/ARCHITECTURE.md` describes the assistant as an Edge Function that
writes `pending`-status rows to an `ai_recommendations` table; the real, shipped
assistant is `src/lib/insights.ts` — a pure, client-side, zero-write TypeScript module
computed from data the dashboard already fetched. **The safety property holds**
(advisory-only, nothing auto-executes — this satisfies CLAUDE.md's hard constraint
that "the AI assistant is advisory only and cannot mutate business data" trivially, by
construction, since the module has no write path at all).

`docs/plan.md` step 12 says: _"Build `AI Assistant` as advisory-only queue with
explicit owner actions (accept/dismiss/convert to draft action), never direct
mutation of business tables."_ This is genuinely ambiguous between two very
different-sized pieces of work:

- **(a)** Formalize what's already shipped into a persisted recommendation-queue
  model — new table, RLS policies, possibly a new Edge Function to compute and store
  recommendations server-side, an accept/dismiss state machine. This is real new
  infrastructure and a real new RPC/write surface.
- **(b)** Keep the current client-computed panels and just add "accept/dismiss" as UI
  affordances that call the _existing_ action RPCs (reschedule, send email, mark
  complete) the panels already link out to. This is a UI-only change with no new
  backend surface at all.

**(confidence: 9/10)** — directly quoting the motivating lines: `docs/plan.md:53`
("Build `AI Assistant` as advisory-only queue…") vs. `src/lib/insights.ts:1-10`
("nothing in this file talks to Supabase, and nothing here mutates data"). The plan
doesn't say which of (a)/(b) it means, and the two differ by roughly an order of
magnitude in RPC/schema footprint.

**Recommendation:** (b). The existing architecture already satisfies the product
requirement and the CLAUDE.md hard constraint with the smallest possible attack
surface (literally zero write capability in the computing module). (a) reintroduces a
persistence layer and a new write RPC for a capability that already works — that's
solving a problem the codebase doesn't have. If "queue" in the plan's language turns
out to mean something org-visible (e.g. a shared, cross-session view of dismissed
recommendations), that's a real requirements question this review can't resolve
without you — flagging as a judgment call below rather than deciding it silently.

### 2. Phase 3 (new RPCs) before Phase 4 (guard all write-critical RPCs) is a

sequencing risk — but a smaller one than it looks

Phase 4 step 15 says _"Add contract-level guards for all write-critical RPC
workflows."_ If Phase 3 step 12 goes with option (a) above, or if Email Ops (step 13)
needs a `requeue_outbox_email(id)`-style RPC, those new RPCs are created in Phase 3
and wouldn't automatically fall inside a Phase 4 scope that was defined by an earlier
snapshot of "all write-critical RPCs." Given the recommendation above (option (b) for
the assistant, and Email Ops likely needing at most one narrow new RPC), the actual
new-RPC surface Phase 3 introduces is small — but the plan should say explicitly that
Phase 4's guard sweep runs _after_ Phase 3's RPCs exist, re-enumerated at that point,
not against a list frozen at Phase 0.

**(confidence: 7/10)** — this is a plan-structure gap, not a bug I can point to a
line for; flagged as medium confidence per the calibration table.

### 3. Given static-PWA + Supabase-only, every "new RPC" is a `SECURITY DEFINER`

Postgres function — consistent with existing pattern, but each one needs its own
RLS/definer review

`docs/SCHEMA.md:207,294-297,401-402` confirms the existing write-critical RPCs
(`book_appointment`, `approve_appointment`, `reject_appointment`,
`set_appointment_status`, `create_appointment_as_owner`, `offer_slot_to_request`,
`decline_request`, `reschedule_appointment_as_owner`) are all `security definer`
Postgres functions — there is no application server to host business logic anywhere
else, by the hard constraint in `CLAUDE.md` ("Static build only… No server runtime of
any kind"). This is the only architecturally valid place to put new write logic, and
the plan is consistent with it (it doesn't propose anything requiring a server). The
risk isn't the pattern — it's that `docs/SCHEMA.md` and `docs/plan.md`'s own migration
list (`0003`, `0007`, `0011`, `0019`, `0022`) stop at `0022`, while current `HEAD` is
at migration `0026`, and the sibling worktree adds `0027`. Any new Phase 3/4 RPC needs
to be planned against the _current_ function/RLS surface, not the one the plan's file
list points at.

### 4. `feat/today-payment-log` worktree is invisible to this plan and directly

overlaps Phase 4's scope

**(confidence: 9/10)** — quoting the evidence directly: `git log --oneline
feat/today-payment-log -5` shows `f5d4cf8 feat(db): add payments log and log_payment
(migration 0027)`, with its own separate plan doc committed at `05c5232 "docs(plan):
Today command center + payment log implementation plan"`. This is a second,
independently-evolving plan for overlapping territory (Today workflow = Phase 2,
payments = new data-integrity surface = squarely Phase 4's job), and `docs/plan.md`
references neither the worktree, the migration, nor the payments domain anywhere in
its 26-file "Relevant files" list or its Phase 4 write-critical-RPC enumeration.

**Recommendation:** before Phase 4 executes, merge or at minimum inventory
`feat/today-payment-log`'s schema/RPC additions into the write-critical-RPC guard
list. Running Phase 4's "guard all write-critical RPCs" sweep without `log_payment` in
scope ships a hardening phase that's already incomplete on day one.

### 5. Failure-scenario pass — one per new codepath the plan implies

| New/changed codepath                                                                                                                | Realistic production failure                                                                                                                           | Plan accounts for it?                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Reschedule-semantics fix (Phase 4 step 14: swap `createAppointmentAsOwner`→`rescheduleAppointmentAsOwner` in Today's inline picker) | In-flight reschedule races a customer-initiated cancel on the same appointment between read and RPC call                                               | No — Verification section has no concurrency/race test named for this specific fix, despite the plan explicitly identifying the bug             |
| Email Ops "retry state" UI/RPC                                                                                                      | Outbox row was already picked up by the drain cron between the owner's page load and their retry click — double-send                                   | No — not mentioned in Verification's "simulated email failures" item, which covers failure/retry but not the race between owner action and cron |
| AI Assistant "convert to draft action" (if option (a) is chosen — see §1)                                                           | Owner accepts a stale recommendation computed against schedule data that changed since the panel loaded (double-booking risk)                          | No — Verification's AI-boundary item only checks "no client direct writes," not staleness of the advisory data itself                           |
| Any new Phase 3 RPC exposed via PostgREST                                                                                           | RLS policy gap exposes the function to a role it shouldn't (the exact class of bug `SCHEMA.md`'s existing `security definer` design is built to avoid) | Partially — Phase 4 step 15 exists for this, but only if it re-scopes per Architecture §2 above                                                 |

**Critical gap flagged:** the reschedule race (row 1) has no test and no stated error
handling in the plan, and would be silent (the owner sees "rescheduled," the customer
sees their cancelled appointment silently un-cancel, or vice versa) — this meets the
skill's bar for a critical gap (no test AND no error handling AND silent failure
mode).

---

## Code quality review

The plan document itself is well-organized (clear phase boundaries, explicit
dependency annotations per step). Two document-level issues:

1. **The "Relevant files" section points at a different worktree entirely**
   (`/Users/mrgee/WebstormProjects/kokolett-beauty.worktrees/ui-polishing-professional-touch/…`
   for all 26 paths), not this checkout. **(confidence: 10/10 — directly quoted from
   `docs/plan.md:92-124`.)** Every path resolves against a worktree, not the current
   repo root. Two of the specific files it names as authoritative —
   `ApprovalsPage.tsx` and `RequestsPage.tsx` — **no longer exist as separate
   components** in current `HEAD`; both were folded into `InboxPage.tsx`. A reader
   who opens those paths in this checkout gets a 404, not stale content — worse than
   drift, it's dead links.
2. **DRY violation across planning docs:** `docs/history/2026-08-13-baseline-audit.md`,
   `docs/history/2026-08-13-capability-matrix.md`, and `docs/plan.md` now each independently describe the
   same route/nav state with different currency (audit docs are current as of commit
   `acc7117`/`f382d1b`, plan is current as of nothing — it doesn't cite a commit at
   all). None of the three docs cross-reference each other's findings in a way that
   lets a reader resolve conflicts. Recommend the re-baseline fold all three into one
   source of truth rather than three overlapping ones.

No code-level DRY/complexity issues apply — this document doesn't yet contain
implementation code to review at that level.

---

## Test review

### Test framework detection

`vitest run` (package.json `"test": "vitest run"`), `@vitest/coverage-v8` present,
`"test:coverage": "vitest run --coverage"`. 17 existing test files under `src/`, all
Vitest + Testing Library — component/hook/lib level. **Zero files under
`supabase/`** — confirmed via `find supabase -iname "*test*"` returning nothing.
There is no pgTAP, no `supabase/tests`, no DB-level test harness of any kind.

### Coverage diagram — Verification section's own items vs. what exists to run them

```
PLAN'S VERIFICATION ITEMS                              EXISTING TEST INFRASTRUCTURE
[+] 1. IA verification (route-audit, dead links)        [GAP] No automated route-audit script;
                                                                docs/history/2026-08-13-baseline-audit.md did this
                                                                by hand, once, against a stale commit
[+] 2. Workflow UAT scripts (4 owner journeys)           [GAP] No E2E/Playwright/Cypress config found
                                                                anywhere in the repo — these would be
                                                                manual runs, undocumented as such
[+] 3. Integrity: lifecycle invariants test matrix       [GAP] [→E2E] No DB-level test exists for ANY
        (booking + status + request conversion +               of book_appointment / approve_appointment /
        approval timeouts)                                      set_appointment_status / offer_slot_to_request.
                                                                  This is the plan's own Phase 4 deliverable,
                                                                  and Phase 6's Verification item 3 assumes
                                                                  a test matrix that has zero starting
                                                                  infrastructure to build on.
[+] 4. Accessibility: keyboard-only pass                 [PARTIAL] src/components/ui/*.test.tsx exist
                                                                    (ConfirmDialog, Field, Toast) but no
                                                                    axe/a11y-specific tooling detected
                                                                    (no jest-axe, no @axe-core in package.json
                                                                    — not independently verified, flagged
                                                                    as a doubt)
[+] 5. Performance: before/after JS size, TTI            [GAP] No bundle-size baseline captured anywhere
                                                                 in the repo today — "before" doesn't exist
                                                                 yet to compare "after" against
[+] 6. Reliability: simulated email failures/retry       [PARTIAL] Outbox + drain-cron exist (migrations
                                                                    0005/0006/0014/0016) but no test
                                                                    simulates a failure/retry cycle
[+] 7. Security/privacy: advisory-only AI boundary,       [★★ PARTIAL] insights.ts's own doc comment IS
        no client writes to protected tables                        the boundary evidence today (no Supabase
                                                                      import). No automated test asserts
                                                                      this stays true as the file evolves —
                                                                      a future edit could add a write call
                                                                      with nothing catching it.
[+] 8. Quality gates (typecheck/lint/tests/UAT)          [★★★ EXISTS] npm run typecheck / lint / test
                                                                       all wired in package.json — this
                                                                       item is the one fully backed by
                                                                       real tooling today

COVERAGE: 1/8 Verification items backed by existing automated infrastructure (12%)
GAPS: 6 (1 marked [→E2E]) | PARTIAL: 3 | Quality scoring: ★★★:1 ★★:1 (rest ungraded — no test exists to grade)
```

### The single most important gap: no RPC-level test harness exists, and Phase 4's

entire deliverable depends on one

Phase 4 step 15 ("contract-level guards for all write-critical RPC workflows") and
Verification item 3 ("lifecycle invariants test matrix") both assume a way to test
Postgres RPCs directly. Nothing in the repo does this today — the 17 existing tests
are all client-side, and even the client-side ones that touch RPC-adjacent logic
(`customerSessionService.test.ts`) likely mock the Supabase client rather than hit a
real database. **This is not a gap in what to test — it's a gap in the tooling to
test it with**, and the plan's Verification section reads as if the harness already
exists. Per CLAUDE.md's own project convention (memory: "Validate SQL in a
rolled-back transaction — how to test migrations against the live DB with no Docker
and no side effects"), there is already a house pattern for testing SQL against the
live DB safely — but that pattern is for one-off migration validation, not a
repeatable RPC contract-test suite. Building that suite (pgTAP, or a
rolled-back-transaction Vitest harness hitting a real Supabase branch/local instance)
is prerequisite work Phase 6 doesn't call out as its own step — it's presupposed
inside step 21 ("expand automated test coverage… and booking integrity invariants")
without acknowledging the harness doesn't exist yet.

**Recommendation:** add an explicit Phase 4 or Phase 6 step: _"Stand up an RPC
contract-test harness (rolled-back-transaction Vitest tests against a real Supabase
instance, following the project's existing rollback-transaction validation pattern) —
prerequisite to steps 15 and 21."_ Without it, "contract-level guards" has no test to
prove the guard works, and step 21's "booking integrity invariants" coverage has
nowhere to live except more client-side tests that can't see RLS/definer behavior at
all.

### Regression rule check

The reschedule-semantics bug (Phase 4 step 14) is a genuine regression candidate:
existing behavior (`createAppointmentAsOwner` duplicate-creation) is being replaced
with different behavior (`rescheduleAppointmentAsOwner` atomic retire), and per the
**IRON RULE**, this requires a regression test as a critical, non-negotiable
requirement — not optional, not deferred. The plan doesn't currently name this test
anywhere in Phase 4 or the Verification section. **Flagging as mandatory**, not a
suggestion: add "regression test: Today's inline reschedule leaves no duplicate
appointment and correctly retires the original" to Phase 4's deliverables.

---

## Performance review

The plan's own Phase 5 step 20 (skeletons, optimistic updates, route-level bundle
splitting) and Verification item 5 (before/after JS size) are the right instincts, but
two gaps:

1. **No current baseline exists to diff against.** Recommend capturing a bundle-size
   and route-TTI baseline as the _first_ action of Phase 5, not an assumed input to
   its verification step.
2. **N+1 risk in the newly-discovered Reports/Assistant architecture:**
   `reportsService.ts:30-34` runs `Promise.all([listAppointments, listWeeklyTemplate,
listCustomers])` on every page load with a fixed 180-day window and no caching —
   fine at current data volume (a single-location, single-stylist salon), but
   `listCustomers()` is separately flagged in `docs/history/2026-08-13-capability-matrix.md` as capped at 200
   rows with no pagination. If Reports and the Assistant both independently call
   `listCustomers()`/`listAppointments()` on their own page loads (confirmed: neither
   service shares a cache), that's two full re-fetches of the same ~180-day window
   for an owner who tabs between Reports and AI Assistant in one session. **(confidence:
   6/10 — moderate, flagging as "verify this is actually felt" rather than asserting
   it's a real bottleneck at current data volume.)** Not urgent given salon scale, but
   worth a shared-cache layer (e.g. a `useReportsWindow` hook) if Phase 3's Email Ops
   module adds a third consumer of the same appointment window.

---

## Phase dependency correctness

| Phase | Stated dependency                                       | Actual state                                                                                                                                                                                                                                                                                                    | Correctness verdict                                                                        |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0     | Blocks all phases                                       | Already executed (audits committed before the plan)                                                                                                                                                                                                                                                             | **Dependency claim is stale** — nothing currently blocks on it because it already happened |
| 1     | Depends on Phase 0                                      | Steps 3, 5, 6 shipped; step 7 shipped-then-reversed; step 4 partially true (structural separation exists, but `docs/history/2026-08-13-capability-matrix.md`'s "Bookings" gaps — 30-day cap, missing reschedule wiring — mean the _outcome_ Phase 2 step 8 wants from Phase 1 isn't fully delivered yet)        | **Mostly satisfied, not verified as complete**                                             |
| 2     | Depends on Phase 1                                      | Step 9 shipped; step 10 mostly shipped; step 8 (explicit outcomes) not formally written anywhere, though the raw material for it is in `docs/history/2026-08-13-capability-matrix.md`                                                                                                                           | **Substantially satisfied**                                                                |
| 3     | Depends on Phase 2                                      | Reports/Assistant already exist independent of Phase 2 completion — they didn't wait for Phase 2 and don't structurally need to have. The stated dependency is **broader than the real one**: Email Ops (the only genuinely unbuilt piece) has no real dependency on Phase 2's quick-actions/dialog work either | **Dependency overstated** — could parallelize starting now                                 |
| 4     | Depends on "Phase 1 route/workflow ownership" (step 14) | Step 14's bug is real and independent of Phase 1's nav work — it's a service-layer fix (`TodayPage.tsx` calling the wrong function), unrelated to which nav item hosts the page                                                                                                                                 | **Dependency mischaracterized** — step 14 could ship today, independent of any other phase |
| 5     | Parallel with Phase 4                                   | No conflict found                                                                                                                                                                                                                                                                                               | **Correct as stated**                                                                      |
| 6     | Depends on Phases 3–4                                   | Correct in principle, but as shown above, Phase 6's step 21 silently depends on a test harness that doesn't exist and isn't itself a named step in Phases 3–4                                                                                                                                                   | **Understated — missing a real dependency** (the RPC test harness)                         |

**Net:** the plan's phase _ordering_ is mostly defensible in the abstract, but its
dependency edges are drawn against a stale snapshot. Once re-baselined, Phase 3
(Email Ops) and the Phase 4 step-14 reschedule fix can very likely both start
immediately, in parallel, without waiting on anything — they don't depend on each
other or on unfinished Phase 1/2 work the way the plan currently implies.

---

## Worktree parallelization strategy

Once re-baselined to reflect what's actually left, the remaining work splits cleanly:

| Workstream                                                                                                                                                                | Modules touched                                                                                                                                    | Depends on                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Reschedule-semantics fix (Phase 4 step 14 + regression test)                                                                                                              | `src/pages/dashboard/TodayPage.tsx`, `src/services/appointmentService.ts` (read-only reference), new test file                                     | —                                 |
| Email Ops module (Phase 3 step 13)                                                                                                                                        | New `src/pages/dashboard/EmailOpsPage.tsx`, `src/services/` (new read service over outbox), `src/lib/routes.ts`, `DashboardLayout.tsx` (nav entry) | —                                 |
| RPC contract-test harness (prerequisite to Phase 4 step 15 / Phase 6 step 21)                                                                                             | New `supabase/tests/` or `src/services/*.rpc.test.ts` pattern, CI config                                                                           | —                                 |
| `feat/today-payment-log` reconciliation into Phase 4's RPC guard scope                                                                                                    | `docs/plan.md` (editing it — outside this review's scope), `supabase/migrations/0027`                                                              | Merge of `feat/today-payment-log` |
| Booking-management capability gaps from `docs/history/2026-08-13-capability-matrix.md` (30-day search cap, reschedule wiring on `AppointmentsPage`, request history view) | `src/pages/dashboard/AppointmentsPage.tsx`, `src/services/requestService.ts` (`listAllRequests` already exists, just needs a caller)               | —                                 |

**Execution order:** Launch the reschedule fix, the Email Ops module, and the RPC
test-harness stand-up in three parallel worktrees — none share a module directory and
none depend on each other. The `feat/today-payment-log` reconciliation should merge
first among anything touching Phase 4's guard scope, since the guard sweep is
incomplete without it. The booking-management capability gaps are independent of all
of the above and can run as a fourth parallel lane.

**Conflict flag:** the RPC contract-test harness lane and the reschedule-fix lane both
eventually touch `src/services/appointmentService.ts` (one to add the fix, one to add
its regression test) — sequence the regression test to land in the same worktree as
the fix itself, not as a separate parallel lane, to avoid a merge race on the same
function.

---

## Implementation tasks

Synthesized from this review's findings.

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — TodayPage — Fix inline reschedule to call `rescheduleAppointmentAsOwner` instead of `createAppointmentAsOwner`
  - Surfaced by: Architecture Review / Phase dependency correctness — `docs/history/2026-08-13-capability-matrix.md`'s cross-cutting reschedule finding, independently confirmed
  - Files: `src/pages/dashboard/TodayPage.tsx`, `src/services/appointmentService.ts`
  - Verify: new regression test asserting no duplicate appointment is created and the original is retired
- [ ] **T2 (P1, human: ~1d / CC: ~1h)** — supabase — Stand up an RPC contract-test harness (rolled-back-transaction pattern) before Phase 4/6 depend on it
  - Surfaced by: Test Review — zero DB-level test infrastructure exists today
  - Files: new `supabase/tests/` or equivalent, CI wiring
  - Verify: harness runs a `book_appointment` happy-path + rejection-path test against a rolled-back transaction with no side effects
- [ ] **T3 (P2, human: ~1d / CC: ~2h)** — docs — Re-baseline `docs/plan.md` against current `HEAD`, folding in `docs/history/2026-08-13-baseline-audit.md`/`docs/history/2026-08-13-capability-matrix.md` and the `feat/today-payment-log` worktree
  - Surfaced by: Executive summary — plan predates its own Phase 0 output and 29 subsequent commits
  - Files: `docs/plan.md` (out of scope for this review to edit directly — task for whoever owns the plan)
  - Verify: every "Relevant files" path resolves in this checkout, not a worktree; every phase status reflects current `HEAD`
- [ ] **T4 (P2, human: ~4h / CC: ~30min)** — dashboard — Build Email Ops page over existing outbox (the one genuinely unbuilt Phase 3 module)
  - Surfaced by: What already exists — outbox/drain-cron already live, only the owner-facing UI is missing
  - Files: new `src/pages/dashboard/EmailOpsPage.tsx`, `src/services/` (new read service), `src/lib/routes.ts`, `DashboardLayout.tsx`
  - Verify: page renders failed/bounced rows and retry state from the existing outbox table
- [ ] **T5 (P3, human: ~2h / CC: ~20min)** — booking management — Wire `listAllRequests()` into a request-history view (dead code today, built "for the history view" per its own doc comment)
  - Surfaced by: What already exists / `docs/history/2026-08-13-capability-matrix.md` §2
  - Files: `src/components/dashboard/RequestsPanel.tsx` or new history component, `src/services/requestService.ts`
  - Verify: answered/declined requests are visible after leaving the open queue

---

## Judgment calls made without a human

This run is non-interactive per the task's instruction, so every point that would
normally be an `AskUserQuestion` was resolved here instead. Revisit any of these:

1. **AI Assistant "queue" interpretation (Architecture §1).** I recommended option
   (b) — keep the client-side architecture, add UI-only accept/dismiss over existing
   RPCs — over (a) — build a persisted recommendation-queue with new schema/Edge
   Function. This is a real product-scope question, not purely technical; if "queue"
   in the plan means something cross-session/shared, (a) may be intended.
2. **Skipped the skill's mandatory per-finding `AskUserQuestion` gates entirely.**
   The skill's own anti-shortcut clause treats writing findings without asking as a
   known failure mode. I did this deliberately per the task's explicit instruction
   ("no human is available, answer every internal decision point yourself… keep the
   session efficient"), not by oversight — flagging it prominently rather than
   silently.
3. **Skipped the Outside Voice (Codex/cross-model) pass.** Normally default-on; I
   judged it out of budget for an efficiency-constrained non-interactive run and
   because this review's central finding (baseline drift) is evidenced by git history
   and file contents, not by a judgment call an outside model would usefully
   contest.
4. **Wrote the report to `docs/fresh/plan-eng-review.md` instead of appending
   `## GSTACK REVIEW REPORT` to `docs/plan.md`.** This is a deliberate deviation from
   the skill's normal "Plan File Review Report" step, per the task's explicit
   instruction not to edit any existing tracked file.
5. **Treated `docs/history/2026-08-13-capability-matrix.md`'s "Doubts / not fully verified" items as
   ground truth rather than re-verifying them myself** (e.g. `pg_cron` job existence,
   `send-emails` Edge Function internals). Re-verifying was out of this review's
   budget; I inherited their confidence level rather than upgrading or downgrading it.
6. **Did not independently grep for remaining `window.confirm`/`alert()` calls** to
   fully close out Phase 2 step 10's status — marked "mostly done" on the strength of
   `ConfirmDialog.tsx`'s existence rather than exhaustive verification.

---

## Completion summary

- Step 0: Scope Challenge — scope not reduced (file count doesn't trigger the
  complexity gate), but effort allocation flagged as badly miscalibrated pending
  re-baseline
- Architecture Review: 5 issues found (1 high-confidence critical gap: silent
  reschedule race)
- Code Quality Review: 2 issues found (dead-worktree file paths, cross-doc DRY
  violation)
- Test Review: diagram produced, 6 gaps identified (1 marked `[→E2E]`), 1 mandatory
  regression test named
- Performance Review: 2 issues found (no baseline to diff against, moderate-confidence
  N+1 risk between Reports/Assistant)
- NOT in scope: written
- What already exists: written (11-row table — the review's central finding)
- TODOS.md updates: 0 — no `TODOS.md` exists in this repo; captured as Implementation
  Tasks instead, which serves the same purpose here
- Failure modes: 1 critical gap flagged (silent reschedule race, no test, no error
  handling)
- Outside voice: skipped (see Judgment calls #3)
- Parallelization: 4 lanes, 4 parallel / 1 sequenced-after-merge (`feat/today-payment-log`
  reconciliation)
- Lake Score: N/A — no completeness-vs-shortcut option pairs were presented to a human
  to choose between in this non-interactive run

---

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs         | Status          | Findings                                                                                                     |
| ------------- | --------------------- | ------------------------------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------ |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0 (this run) | —               | not run in this session                                                                                      |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0            | —               | outside voice skipped, see Judgment calls #3                                                                 |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1            | **ISSUES_OPEN** | 5 architecture issues, 2 code-quality issues, 6 test gaps, 2 performance issues, 1 critical failure-mode gap |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0            | —               | not run in this session (a sibling review run may cover this separately)                                     |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0            | —               | not run in this session                                                                                      |

**VERDICT:** Eng Review not CLEAR — eng review required before this plan should be
executed as written. The primary blocker isn't code quality, it's currency: the plan
must be re-baselined against current `HEAD` before its phase-by-phase effort estimates
can be trusted.

**UNRESOLVED DECISIONS:**

- AI Assistant "queue" scope — option (a) persisted recommendation-queue vs. option
  (b) UI-only layer over existing client-side computation (Architecture §1 /
  Judgment call #1)
- Whether `feat/today-payment-log` should merge before or in parallel with a
  `docs/plan.md` re-baseline, given Phase 4's guard sweep is incomplete without it
- Whether Phase 2 step 10 (kill blocking browser dialogs) is fully closed or still has
  remaining `window.confirm`/`alert()` call sites — not exhaustively verified in this
  run
