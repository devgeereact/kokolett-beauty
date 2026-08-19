# CEO / Founder Plan Review — `docs/plan.md`: 2026 Owner-First Full Product Upgrade

**Skill:** `/plan-ceo-review` (gstack) · **Mode:** SCOPE REDUCTION (judgment call — see Step 0F)
**Run type:** non-interactive — no human founder available. Every `AskUserQuestion` decision point
the skill would normally raise was resolved by my own judgment, grounded in the project's own docs
and direct codebase evidence, never in the sibling reviews' word alone. Every such point is marked
**[JUDGMENT CALL]**.
**Output policy:** `docs/plan.md` was **not** edited. This document is the entire deliverable.

---

## Session notes — how this run relates to the two sibling reviews

Two other non-interactive skill runs already exist against this same plan: `docs/fresh/office-hours.md`
(`/office-hours`, git-archaeology lens) and `docs/fresh/plan-design-review.md` (`/plan-design-review`,
Phase 1+5 design-system lens). I read both in full before writing anything here. Per this task's
explicit instruction, I did not take their factual claims on trust — I re-derived the load-bearing
ones myself against primary sources:

- Re-ran `git log` and confirmed commits `5012def`, `52a25dc`, `3d8a11f`, `85f199a` exist with the
  messages both sibling docs cite.
- Read `src/components/dashboard/DashboardLayout.tsx` directly: its `entries[]` array is literally
  the plan's 7-nav model, with a code comment citing `docs/plan.md Phase 1 step 3` by name, and a
  `secondaryEntries[]` array (Reports, AI Assistant) with a comment citing `docs/BASELINE-AUDIT.md`.
  Confirmed, not inferred.
- Went one step further than either sibling doc: walked the **full chronological commit order**
  (not just `git log -30`) and found that **the single item both sibling reviews flagged as the
  plan's last genuinely open, high-value fix — the Today-page reschedule split-brain bug — has
  already been fixed**, in commits `d6d6781` and `a257b44`, both dated the same day as this review
  and both landing _after_ `docs/plan.md` itself was committed (`175121c`). Confirmed directly by
  reading `src/pages/dashboard/TodayPage.tsx:118-123`: `doOwnerReschedule` now calls
  `rescheduleAppointmentAsOwner`, not `createAppointmentAsOwner`. See Pre-Review System Audit below —
  this is new information neither sibling review had, and it materially changes the punch list.

Where I agree with a sibling finding, I say so and move on rather than re-deriving it from scratch.
Where I add something neither sibling caught, I flag it explicitly. This review's distinct
contribution is the **CEO/founder lens the task asked for**: scope-rightness for a one-person
business, phase sequencing, KPI integrity against `docs/PRD.md`'s own success metrics, and the
single riskiest bet in the 24 steps — not a repeat of the git-archaeology or design-system audits.

---

## Pre-Review System Audit

- **Branch:** `chore/gstack-init-and-plan-doc`, working tree clean, HEAD `4727434`.
- **`docs/plan.md` was added in commit `175121c`** ("add 2026 owner-first upgrade plan and refresh
  platform preview mockup") — chronologically _after_ `docs/BASELINE-AUDIT.md` (`c00a9fb`) and
  `docs/CAPABILITY-MATRIX.md` (`902809f`/`a46fd03`), i.e. the plan was written with both audits
  already in hand.
- **Since `docs/plan.md` was committed, at least 5 more Phase-4/5-relevant fixes have shipped**,
  none of them plan-gated: `d6d6781` (reschedule duplicate-booking bug — Phase 4 step 14's exact
  target), `a257b44` (3 more reschedule RPC bugs found reviewing that fix), plus a run of
  `style(design): FINDING-00N` commits (`a57e358` through `b150cf3`) that are Phase 5-shaped work
  (token misuse, ARIA-tabs cleanup, touch targets, layout) shipped as one-off design findings, not
  as a "Phase 5" deliverable.
- **No `TODOS.md` exists in this repo** (grep confirmed) — nothing to reconcile against.
- **Recent commit shape confirms the sibling docs' "actual operating model" finding independently**:
  of the last ~15 commits, none reference a `docs/plan.md` step number; all are either a named bug
  fix ("Fix drag edge cases…"), a named design finding ("FINDING-007…"), or a spec (`Today command
center + payment log`). The project ships by owner-ask → spec/finding → fix, not by phase gate.

**Net effect on this review:** the plan is stale in more places, and more recently, than either
sibling review had visibility into. That trend line matters for the mode decision below — a plan
that keeps going stale within hours of being read is not a plan that benefits from a heavier review
process; it benefits from being cut down to what's still true and re-issued as a short punch list.

---

## Step 0: Nuclear Scope Challenge + Mode Selection

### 0A. Premise Challenge

1. **Is this the right problem to solve?** Partially. Six of the plan's seven phases (1–6, i.e. 21
   of 24 steps) exist to serve one declared goal: _"reduce owner daily time spent."_ That goal is
   plausible but **unmeasured** — no file in this repo's docs tree contains a number for how long
   the owner currently spends on admin, confirmed by grep, matching both sibling reviews. Worse, and
   this is new to this review (see Riskiest Bet below): **that KPI is not one of `docs/PRD.md`'s own
   16 stated success metrics.** The plan invented its headline metric outside the product's own
   definition of success.
2. **What is the actual outcome, and is the plan the most direct path to it?** For the fraction of
   the plan that is still open (see What Already Exists), yes — fixing a real accessibility bug or
   an orphaned page is a direct fix for a direct problem. For the process apparatus (Phase 6's
   release waves, a second observability module, recurring capability-matrix audits) — no, these are
   sized for a multi-stakeholder team and this is `docs/PRD.md` §3's explicit n=1: "The owner
   authenticates through Supabase Auth… and is the only account that can mutate salon data."
3. **What happens if we do nothing further on this plan?** Almost nothing bad, in the short term —
   the app is live, the core booking loop works end to end (per `docs/PRD.md` §12's acceptance
   criteria, cross-checked against `docs/BASELINE-AUDIT.md`/`docs/CAPABILITY-MATRIX.md`, both of
   which found Day Operations and Customer Management essentially complete). The real cost of doing
   nothing is `docs/plan.md` itself continuing to actively mislead: a future session (human or agent)
   reading it cold will plan against Phase 3's "missing production modules" that have been built and
   shipped since before the plan was written, and against a Phase 4 step 14 that is now closed.

### 0B. Existing Code Leverage

| Plan phase/step                                            | Claimed state in `docs/plan.md`      | Actual state, verified this run                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0 (baseline, capability matrix)                      | To be produced                       | **Done.** `docs/BASELINE-AUDIT.md`, `docs/CAPABILITY-MATRIX.md` exist, file:line grounded.                                                                                                                                                                                                                                     |
| Phase 1 step 3 (7-nav model)                               | To be built                          | **Done.** `DashboardLayout.tsx:57-73`, code comment cites the plan step by name.                                                                                                                                                                                                                                               |
| Phase 1 step 5 (Inbox consolidation)                       | To be built                          | **Done.** `InboxPage.tsx`, `?tab=` state, SLA urgency styling.                                                                                                                                                                                                                                                                 |
| Phase 1 step 6 (orphaned pages first-class under Calendar) | To be built                          | **Done.** `CalendarCapacityTabs.tsx` — 3-route segmented tab strip.                                                                                                                                                                                                                                                            |
| Phase 1 step 7 (dead-nav handling)                         | "Temporarily remove or relabel"      | **Superseded by a better shipped decision** — kept reachable, visually secondary, never hidden.                                                                                                                                                                                                                                |
| Phase 2 step 9 (cross-nav quick actions)                   | To be built                          | **Done.** `QuickActionLauncher.tsx` (Cmd+K).                                                                                                                                                                                                                                                                                   |
| Phase 2 step 10 (kill blocking dialogs)                    | To be built                          | **Done.** `ConfirmDialog`/`Toast` replacing `window.confirm`/`alert`.                                                                                                                                                                                                                                                          |
| Phase 3 step 11 (Reports module)                           | "Missing production module"          | **Done**, and predates the Phase 0 audit (`3d8a11f`).                                                                                                                                                                                                                                                                          |
| Phase 3 step 12 (AI Assistant)                             | "Missing production module"          | **Done** (`85f199a`), mechanism differs from `docs/ARCHITECTURE.md`'s description (client-side deterministic module, not an Edge Function + `ai_recommendations` table) but the safety property — advisory-only, no autonomous mutation — holds.                                                                               |
| Phase 4 step 14 (reschedule semantics)                     | To be fixed                          | **Done, verified this run.** `d6d6781` + `a257b44`. `TodayPage.tsx:118-123` now calls `rescheduleAppointmentAsOwner`.                                                                                                                                                                                                          |
| Phase 5 step 17 (token/ARIA drift)                         | To be resolved                       | **Partially done.** `AssistantPage.tsx`'s ARIA tabs fixed (`b150cf3`); `SettingsPage.tsx:164-173` still has the identical bug (verified live this run — `role="tablist"`/`role="tab"`/`aria-selected` present); `InboxPage.tsx`'s tab toggle still has **no** `aria-pressed`/`aria-selected` at all (verified — zero matches). |
| Phase 5/PRD §4.2 (request filter/priority/history)         | Implied by Growth-nav's one sentence | **Not built.** Verified: zero `priority` or filter-control references in `RequestsPanel.tsx`.                                                                                                                                                                                                                                  |
| Growth (offer/promotion mechanism)                         | Implied by Growth-nav's one sentence | **Not built**, per `docs/CAPABILITY-MATRIX.md`'s grep, not independently re-checked this run (low priority, see below).                                                                                                                                                                                                        |

**Reading this table as a founder:** roughly two-thirds of the plan's substantive content is already
shipped. What remains open is small, concrete, and already diagnosed by someone (mostly this repo's
own audits) — it does not need six more phases of process to finish.

### 0C. Dream State Mapping

```
  CURRENT STATE                        THIS PLAN (as written)              12-MONTH IDEAL
  ────────────────                     ───────────────────────             ───────────────
  Owner console: 7-nav,                Phase 1-6: re-derive and            A living, short punch-
  already shipped. Reports/AI          re-build most of what's             list (not a phased plan)
  Assistant live. Reschedule           already live; add process           that stays in sync with
  bug fixed. 2 live a11y bugs.         apparatus (release waves,           what's shipped, because
  Growth-nav underbuilt vs PRD's       2nd observability module,           it's regenerated from the
  own money metrics (booking           recurring audits) sized             same spec→plan→ship loop
  conversion, returning-customer       for a team that doesn't             that's already producing
  rate, availability-request           exist.                              results — plus one
  conversion — all near-zero                                               deliberate track for the
  plan coverage).                                                          PRD's revenue-adjacent
                                                                            metrics that this plan
                                                                            currently skips entirely.
```

This plan, followed literally, moves the project **away** from that ideal: it re-derives already-good
decisions (Inbox tab mechanism, dialog primitive, secondary-nav policy) instead of documenting them,
and it adds team-scale process (Phase 6) to a project whose demonstrated advantage is shipping faster
than a team-scale process would allow.

### 0C-bis. Implementation Alternatives

**APPROACH A — Follow `docs/plan.md` literally, Phases 4→6 in order**
Summary: finish the (now much shorter) list of open items inside the plan's existing phase
structure; keep Phase 6's release-wave/UAT/ops-dashboard ceremony as written.
Effort: L (human: 1-2 weeks / CC: a few sessions). Risk: Medium — not correctness risk, _process_
risk: it re-imposes gates on a team of one that has been correctly ignoring them.
Reuses: the plan's own phase labels.
Completeness: 6/10 — technically finishes "the plan," but a large share of that effort re-litigates
decisions the codebase already made better.

**APPROACH B — Cut to a punch list, fold survivors into the existing spec→plan→ship loop (recommended)**
Summary: retire the phase-gate structure as a literal backlog. Keep the two still-live a11y bugs, the
Growth-nav gap, and the "re-baseline `docs/plan.md` or retire it" item as a short, flat list; drop
Phase 6's team-scale governance items outright; route everything else through the mechanism already
producing results (owner names a want or a bug surfaces → spec → plan → ship).
Effort: S (human: an afternoon to re-triage / CC: minutes per item). Risk: Low — formalizes a pattern
proven twice already (Today spec, Calendar spec).
Reuses: the demonstrated spec-driven workflow; `docs/RULES.md`'s existing typecheck/lint/CodeRabbit
gate as the only release governance a team of one needs.
Completeness: 9/10 — covers every genuinely open item found by this review and both siblings; the
1-point gap is that it doesn't force a conversation with the owner about whether admin-time or
revenue is the real constraint (that's a human decision no approach can substitute for).

**APPROACH C — Split into "bug-fix track" + "growth track," drop ops-governance entirely**
Summary: same as B, but explicitly opens a second track for the PRD's under-served money metrics
(booking-abandonment, empty-slot visibility, request conversion) rather than leaving that as a single
punch-list line.
Effort: M (human: needs the owner to weigh in on constraint / CC: same as B for execution).
Risk: Low-Medium — risk is entirely in whether the owner confirms revenue, not time, is the real
constraint; if she doesn't, this opens scope she didn't ask for.
Completeness: 10/10 on paper, but gated on information this non-interactive run cannot obtain.

**[JUDGMENT CALL] Recommendation: Approach B now, with Approach C's growth-track question flagged
as the first thing to resolve before anyone writes a new phase.** Reasoning: B is strictly a subset
of C that ships immediately; C only adds value once someone has the one conversation that decides
whether it's needed. Shipping B does not foreclose C — it's additive once the owner answers.

### 0D. SCOPE REDUCTION analysis

**Ruthless cut — what's the absolute minimum that ships value now:**

1. Fix the two live a11y bugs (`SettingsPage.tsx`'s incomplete ARIA tabs, `InboxPage.tsx`'s missing
   `aria-pressed`) — both P1, both trivial, both already diagnosed by `plan-design-review.md`.
2. Confirm (2-minute check, already done above) that Phase 4 step 14 and the orphaned-page
   discoverability fix are closed — mark them done in whatever replaces `docs/plan.md`.
3. Have the owner conversation: is admin time or booking volume/revenue the real constraint right
   now? This gates whether Growth-nav's build-out (Approach C) is worth opening.
4. Re-baseline or retire `docs/plan.md` itself so it stops describing shipped work as pending.

**Everything else is deferred, no exceptions:** Phase 4 step 15's blanket "guards for all
write-critical RPCs" (narrow it to whatever the owner conversation actually surfaces, not a phase);
Phase 5's remaining token/primitive audit (small, but not urgent — fold into the next design pass);
Phase 6 in its entirety (see Section 8/9 findings below — this is where the plan is most
disproportionate to a one-person business).

**What can be a follow-up PR vs. must-ship-together:** items 1-2 above are a single small PR.
Item 3 is a conversation, not code. Item 4 is a doc edit. Nothing in this reduced set has a
"must ship together" dependency on anything else — that in itself is evidence the plan's phase-gate
dependency chain (_"blocks all phases"_, _"depends on Phase 0"_) was never load-bearing.

### 0F. Mode Selection

**[JUDGMENT CALL] Mode selected: SCOPE REDUCTION.**

Per the skill's own default rules: "Plan touching >15 files → suggest REDUCTION unless user pushes
back." `docs/plan.md`'s own **Relevant files** section lists 24 files plus 6 migrations plus 3 docs
— comfortably over that bar even before counting what it would additionally touch to re-derive
already-shipped decisions. Combined with the staleness finding above (a plan that's gone stale twice
within the same day it was written is not a plan whose remaining scope deserves a full HOLD-SCOPE
rigor pass — the rigor is better spent on what's still real), REDUCTION is the correct posture. This
matches both sibling reviews' independently-reached conclusions (office-hours.md's "Approach B",
plan-design-review.md's "stale plan prose describing already-shipped, already-better decisions" as
its top risk) — three separate analyses, three different evidence paths, one answer.

I did not select EXPANSION or SELECTIVE EXPANSION: there is no unmet ambition gap here to dream
into — the codebase is already ahead of the plan's own prose in most places it was reviewed. I did
not select HOLD SCOPE: holding a stale 24-step scope as the baseline and making it "bulletproof"
would mean hardening process apparatus (Phase 6) that shouldn't exist for this team size in the
first place — rigor applied to the wrong scope is waste, not diligence.

---

## Condensed 11-Section Review (REDUCTION mode footprint)

Per the mode's own reduced requirements (no CEO plan doc, no Phase 2/3 scope mapping, error map and
deploy standard scoped to "critical paths only" / "simplest possible", Design section skipped by
default). This is a strategy document, not a code diff, so each section below evaluates the plan's
_content_, not a set of file changes.

**Section 1 — Architecture.** The plan's real "architecture" is its phase-dependency graph
(_"blocks all phases"_, _"depends on Phase N"_). Finding: **that graph doesn't describe how the
project actually ships**, evidenced by Phase 3's flagship modules landing before Phase 0's own audit
commit. Recommend dropping strict phase-gating from whatever replaces this plan; a flat, priority-
ordered list is a more honest model of a one-person operation's real constraint (attention, not
sequencing).

**Section 2 — Error & Rescue Map (critical paths only, per REDUCTION).** One real, previously-live
production risk existed here: Today's inline reschedule silently created a duplicate booking instead
of retiring the original. **Status: FIXED** (`d6d6781`, `a257b44`) — see registry below. No other
new error path is introduced by this plan (it's a doc, not code); a full method-level audit belongs
to `/plan-eng-review` on the actual reschedule-fix diff, not to this document review.

**Section 3 — Security.** Phase 4 step 15's "contract-level guards for all write-critical RPCs" is
the only security-shaped item in the plan. `docs/ARCHITECTURE.md` §8 already documents a solid RLS +
security-definer-RPC posture, and this is a single-owner admin surface with no multi-tenant or
external-API attack surface expansion proposed anywhere in the plan. Not zero-value, but not urgent:
recommend narrowing to whatever specific gap the owner conversation (0D item 3) surfaces, rather than
a blanket audit of every RPC.

**Section 4 — Data Flow / Interaction Edge Cases.** The one concrete edge case this plan ever named
with precision — three reschedule entry points (Today inline, Calendar Move panel, calendar drag)
converging on two different backend behaviours — is now closed. No other edge case in the plan is
specified with comparable rigor; Growth-nav's "manage website-facing offer/requests/subscribers/
reviews" is one sentence covering four distinct sub-features with zero edge-case treatment.

**Section 5 — Code Quality.** DRY/dead-code findings already surfaced by `docs/CAPABILITY-MATRIX.md`
(unused `settingsService.ts`/`app_settings`, `listAllRequests()` built but never called, four
renamed-but-undocumented services) are cheap, isolated cleanups — not scope for a phase, just noise
worth sweeping in whatever PR next touches those files.

**Section 6 — Tests.** Plan step 21 ("expand automated test coverage to mission-critical owner
workflows and booking integrity invariants") is legitimate and not superseded by anything shipped.
**Keep this item**, resequenced ahead of Phase 5's remaining design polish — booking integrity tests
protect revenue directly; design polish doesn't.

**Section 7 — Performance.** Nothing new to add. `docs/PRD.md`'s own non-functional requirements
(FCP <2s, booking flow usable on mid-range 4G) already gate this. Phase 5 step 20's perceived-
performance patterns are legitimate polish, correctly low priority under reduction.

**Section 8 — Observability.** **Cut Phase 6 step 22** (dedicated ops dashboards/alerts for email
queue health, realtime subscription health, error trends). Sentry is already the monitoring stack
(`docs/ARCHITECTURE.md` topology diagram, `src/lib/sentry.ts`, confirmed present). Standing up a
second observability surface for one operator to check is the textbook definition of process theatre
this business doesn't have the headcount to staff.

**Section 9 — Deployment / Rollout.** **Cut Phase 6 step 24's four-wave release choreography**
(Wave A/B/C/D). One production environment, one deploy path (`docs/DEPLOYMENT.md`), no second
stakeholder to coordinate a wave with. Keep the underlying _principle_ — ship data-safety fixes
before cosmetic polish — as an ordering rule, not a formal gate ceremony.

**Section 10 — Long-Term Trajectory.** Reversibility of "retire the phase-gated plan.md as literal
backlog": **5/5**, it's a document, not an architecture. Technical debt that actually matters:
none of it is in `docs/plan.md`'s named "hardening" categories — the real debt is Growth-nav's
under-build relative to `docs/PRD.md`'s own metrics (see Riskiest Bet) and the plan document's own
drift from reality actively costing future planning sessions time (this review is the third session
this week to have to re-derive "most of Phase 0-4 is already done" from scratch — that's the debt).

**Section 11 — Design.** **Skipped per REDUCTION mode default** (Mode Quick Reference table). Not a
gap: `docs/fresh/plan-design-review.md` already ran this exact section against Phase 1+5 in depth
(score 4.5/10 as literal prose → 8.5/10 if its T1-T10 fixes land) and its two P1 a11y findings are
carried forward into this review's Implementation Tasks below rather than re-derived.

---

## The Riskiest Assumption — direct answer to the task's question

**Not any implementation risk inside the 24 steps — the allocation bet underneath all of them.**

`docs/plan.md`'s own **Decisions** section (line 146) states: _"Primary KPI: reduce owner daily time
spent."_ Twenty-one of the plan's 24 steps — everything from Phase 1 onward — exist to serve that
one KPI. Cross-checking it against `docs/PRD.md` §8's actual, product-defined success metrics table
(8 business metrics: monthly confirmed bookings, booking conversion rate, returning-customer rate,
Google review conversion, appointment utilisation, average booking value, cancellation rate, no-show
rate; 8 product metrics: booking completion rate, landing-to-confirmation time, approval turnaround,
email delivery success, dashboard TTI, availability-request conversion, magic-link exchange success,
AI recommendation acceptance) — **"reduce owner daily time spent" appears nowhere in either list.**
The plan invented its own headline metric, outside the product's own definition of what "working"
means, with zero measured baseline anywhere in this repo (confirmed by grep, matching both sibling
reviews).

Meanwhile, of the PRD's 16 real success metrics, exactly one gets dedicated plan coverage: Growth-nav,
in one sentence ("manage website-facing offer/requests/subscribers/reviews," Phase 2 step 8). The
metrics closest to actual revenue — booking conversion rate, returning-customer rate, availability-
request conversion rate — get no phase, no step, no verification criterion anywhere in the 24 steps.

**This is a classic proxy-metric bet: optimizing hard for a number nobody has measured, at the direct
opportunity cost of the numbers the product itself says define success.** If the owner's real
constraint turns out to be booking volume or revenue rather than admin time, this plan spends six
phases and most of its remaining engineering budget solving the wrong problem, competently. The fix
is cheap — it's the one open conversation in Approach B/0D item 3 — but until that conversation
happens, every hour spent on Phase 5/6 process work is a bet placed without having checked the odds.

---

## Scope-rightness and sequencing verdict (direct answers to the task's questions)

**Is the scope right for a one-person, one-location business?** Partially, and unevenly. Phase 0's
baseline-truth work was exactly right-sized and genuinely valuable — it's the reason this review
could be this precise. Phases 1-4's _content_ (nav consolidation, reschedule integrity, orphaned-page
discoverability) was right-sized too, which is exactly why it's already been built without waiting
for phase gates. Phase 6 is where the scope stops fitting the business: release waves, a second
observability module, and structured UAT scripts are patterns for a team shipping to multiple
stakeholders, and this is `docs/ARCHITECTURE.md` §8 / `docs/PRD.md` §3's explicit single-account
n=1 system. That's not a judgment call — it's architecturally stated in the docs this plan itself
cites as sources.

**Is the phase sequencing right?** No, and the project has already proven it wrong by ignoring it:
Phase 3's "missing modules" shipped before Phase 0's audit, and Phase 2's quick-actions/dialog work
shipped in parallel with Phase 1, not after it. The dependency language (_"blocks all phases"_)
describes a waterfall that adds no safety here — nothing in the actually-shipped work broke from
being built out of the declared order.

**What's scope creep relative to what moves the business's numbers?** Ranked, most to least:

1. Phase 6 step 22 (second observability module) — duplicates Sentry, zero PRD metric it serves.
2. Phase 6 step 24 (four-wave release ceremony) — coordination overhead with no one to coordinate with.
3. Phase 2 step 2 / Phase 0 step 2's "recurring capability matrix" as ongoing ceremony — valuable once
   (proven, it's how this review got its evidence), expensive to maintain at this codebase's ship rate.
4. Phase 4 step 15's "guards for all write-critical RPCs" as a blanket item — the one concrete case
   (reschedule) is fixed; auditing every other RPC pre-emptively, with no incident driving it, is
   solving a hypothetical instead of the PRD's real, unaddressed money metrics.

---

## Outside Voice

**[JUDGMENT CALL] Substituted the two existing sibling reviews (`office-hours.md`,
`plan-design-review.md`) for a live Codex/subagent dispatch.** Reasoning: (a) both were generated by
separate skill invocations with independently fresh context — genuine adversarial independence, the
same property a live second-model pass would provide; (b) their central finding (plan stale relative
to shipped reality) was not merely accepted here but **independently re-derived from primary sources**
(direct `git log`/file reads, not summary-of-summary trust) and, in the reschedule-fix case, extended
with information neither sibling doc had; (c) the task's own efficiency instruction weighs against
spending a 5-minute external dispatch to re-confirm a convergence that three independent analytical
paths (git archaeology, design-system audit, CEO/KPI lens) already agree on without prompting each
other.

**Cross-model tension: none.** All three reviews converge on the same finding — the plan is stale as
a literal backlog and should be cut down, not followed as written — via three different evidence
paths. Where this review adds new information (the reschedule fix already shipped), it strengthens
rather than contradicts the sibling conclusions.

---

## Required Outputs

### NOT in scope for this review

- Re-running `/plan-design-review`'s Phase 1+5 pixel-level audit — already done, cited not repeated.
- Re-deriving the git-archaeology evidence chain — already done by `/office-hours`, re-verified not
  re-produced.
- A code-level `/plan-eng-review` of the reschedule-fix migrations (`0024`-`0026`) — recommended as
  the next step (see Next Steps below), not performed here; this is a strategy review, not a code
  review.
- Growth-nav's build-out (offer/promotion mechanism, request history view/filter/priority) — real
  gap, correctly gated behind the owner conversation (0D item 3), not speculatively designed here.

### What already exists (reuse targets — do not rebuild)

See the 0B table in full above. Summary: 7-nav IA, Inbox consolidation, orphaned-page discoverability,
cross-nav quick actions, non-blocking dialogs, Reports, AI Assistant, and (new to this review) the
reschedule-integrity fix are all shipped and should be documented as done, not re-planned.

### Dream state delta

Per 0C: this plan, as literally written, moves _away_ from the 12-month ideal of a living, always-
current punch list by re-deriving already-good decisions and adding team-scale process. Cutting it to
Approach B closes that gap almost entirely; Approach C (gated on the owner conversation) closes the
rest by giving the PRD's own revenue metrics a track that currently doesn't exist.

### Error & Rescue Registry

```
  CODEPATH                          | FAILURE MODE                          | STATUS
  -----------------------------------|----------------------------------------|------------------
  TodayPage inline reschedule        | createAppointmentAsOwner created a    | FIXED (d6d6781)
  (doOwnerReschedule)                | duplicate, left original live         | verified in code
  reschedule_appointment_as_owner    | never checked NEW time was in future  | FIXED (a257b44,
  RPC                                | (only checked old time)                | migration 0026)
  customer_reschedule_appointment    | dropped approved_by audit ref on      | FIXED (a257b44,
  RPC                                | owner-approved bookings                | migration 0026)
  reschedule_appointment_as_owner    | vestigial SERVICE_UNAVAILABLE guard    | FIXED (a257b44,
  RPC                                | blocked reschedule with 0 services     | migration 0026)
```

No CRITICAL GAPS remain in this registry — all four rows are closed. This is a materially different
result than either sibling review found (both treated the reschedule bug as the plan's top open item);
the difference is timing, not disagreement.

### Failure Modes Registry

```
  CODEPATH                    | FAILURE MODE                | RESCUED? | TEST? | USER SEES?  | LOGGED?
  -----------------------------|------------------------------|----------|-------|-------------|--------
  SettingsPage tab toggle       | role="tablist"/"tab" promises| N/A —    | No    | No visible  | N/A
                                 | roving-tabindex keyboard nav | a11y bug | test  | error; SR   |
                                 | that isn't implemented       |          |       | users get   |
                                 |                               |          |       | broken nav  |
  InboxPage Approvals/Requests  | No aria-pressed/aria-selected| N/A —    | No    | SR users get| N/A
  toggle                        | on the active-lane toggle    | a11y bug | test  | no selected-|
                                 |                               |          |       | state cue   |
```

Neither row is a data-integrity or security gap (hence no CRITICAL GAP marking under this skill's
own rule, which reserves that for RESCUED=N + TEST=N + USER SEES=Silent on a _data_ path) — but both
are real, live accessibility bugs in exactly the surfaces this plan's own Phase 1/5 restructured,
already diagnosed with file:line precision by `plan-design-review.md`, and cheap to fix.

### TODO candidates (presented for a human to file — no `TODOS.md` exists yet, none created here)

1. **Re-baseline or retire `docs/plan.md`.** What: replace the phase-gated 24-step document with a
   short, living punch list reflecting what's actually open (this review's list, below). Why: the
   plan has gone stale twice within the day it was written; leaving it as-is guarantees a fourth
   session re-derives the same finding. Pros: stops wasting future planning-session time; makes
   "what's left" answerable in one read. Cons: loses the single-document "whole 2026 upgrade" narrative
   (mitigated — nobody has been following it as one narrative anyway). Effort: S. Priority: P1.
2. **Fix the two live a11y bugs** (`SettingsPage.tsx` incomplete ARIA tabs, `InboxPage.tsx` missing
   `aria-pressed`). What/why: both are diagnosed with file:line precision already; the fix pattern is
   proven in this same codebase (`AssistantPage.tsx`'s `b150cf3` fix). Effort: S. Priority: P1.
3. **Have the owner conversation on the real constraint** (admin time vs. booking volume/revenue).
   What: a five-minute, direct question. Why: it's the one input that decides whether Growth-nav's
   build-out (Approach C) is worth opening, and nothing else in this review can substitute for it.
   Effort: S (not engineering time). Priority: P1, blocks any new phase being scoped.
4. **Growth-nav build-out** (request filter/priority/history, offer/promotion mechanism) — **Hold**
   pending item 3's answer. Do not build speculatively; `docs/PRD.md`'s own metrics say this is where
   the money is, but scoping it before knowing it's the actual constraint risks the same
   proxy-metric mistake this review just flagged in the plan it's replacing.

Presenting per the skill's own options: **A)** add items 1-3 as the sole surviving punch list from
this plan **B)** skip — not valuable enough **C)** build item 2 now, defer 1/3/4.
**[JUDGMENT CALL] Selected A** — items 1-3 are small, already-diagnosed, and directly answer this
review's own findings; nothing here warrants deferral or dismissal.

---

## Implementation Tasks

```markdown
- [ ] **T1 (P1, human: ~20min / CC: ~5min)** — docs — Replace `docs/plan.md`'s phase-gated structure
      with a short punch list reflecting shipped-vs-open state (this review's 0B table + the 3 open
      items below)
  - Surfaced by: Pre-Review System Audit, 0B, Section 1, Section 10
  - Files: `docs/plan.md`
  - Verify: re-read; confirm it names the 3 genuinely open items and marks the rest done

- [ ] **T2 (P1, human: ~30min / CC: ~10min)** — a11y — Replace `SettingsPage.tsx`'s
      `role="tablist"`/`role="tab"`/`aria-selected` (lines ~164-178) with the
      `CalendarShell`/`AssistantPage` plain-button + `aria-pressed` pattern
  - Surfaced by: Section 5/11 (via `plan-design-review.md`, re-verified live this run)
  - Files: `src/pages/dashboard/SettingsPage.tsx`
  - Verify: screen-reader manual pass; grep confirms zero remaining `role="tab"` in the file

- [ ] **T3 (P1, human: ~30min / CC: ~10min)** — a11y — Add `aria-pressed` (or equivalent) to
      `InboxPage.tsx`'s Approvals/Requests toggle
  - Surfaced by: Section 5/11 (via `plan-design-review.md`, re-verified live this run — zero matches
    for `aria-pressed`/`aria-selected`/`role="tab"` in the file)
  - Files: `src/pages/dashboard/InboxPage.tsx`
  - Verify: screen-reader manual pass; extend `InboxPage.test.tsx`

- [ ] **T4 (P1, human: ~5min, not engineering)** — process — Ask the owner directly: is admin time
      or booking volume/revenue the actual constraint right now?
  - Surfaced by: Riskiest Assumption, 0D item 3
  - Files: none — this gates whether T5 opens
  - Verify: answer recorded somewhere durable (even a one-line note in the new punch list from T1)

- [ ] **T5 (P2, Hold pending T4)** — product — Scope Growth-nav's build-out (request filter/priority/
      history view, offer/promotion mechanism) only if T4 confirms revenue/volume is the constraint
  - Surfaced by: Riskiest Assumption, `docs/CAPABILITY-MATRIX.md` §5
  - Files: `src/components/dashboard/RequestsPanel.tsx`, `src/services/requestService.ts`, new Growth
    surfaces TBD
  - Verify: not applicable until scoped

_No new tasks from Section 2/4/6/7 — the one concrete item each surfaced (reschedule integrity,
booking-invariant test coverage) is either already fixed (T-none, closed) or already correctly kept
in the reduced scope without a new task (test coverage — recommend as an ongoing practice, not a
one-off task)._
```

---

## Next Steps — Review Chaining

**Recommend `/plan-eng-review` next**, scoped specifically to the reschedule-fix migrations
(`0024`-`0026`) and the two a11y fixes (T2/T3) once implemented — that is the appropriate altitude
for a method-level error/rescue audit and test-coverage check, not this document review.
**Do not recommend `/plan-design-review` again** — SCOPE REDUCTION mode's own default, and correctly
so here: it already ran against this exact plan and its findings are carried forward unchanged.

---

## Completion Summary

```
+====================================================================+
|            CEO PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| Mode selected         | SCOPE REDUCTION                             |
| System Audit          | Plan stale in more places than either       |
|                        | sibling review found; reschedule bug now    |
|                        | fixed (new finding, this run)                |
| Step 0                | 3 alternatives scored; Approach B selected  |
| Section 1  (Arch)     | 1 finding — phase-gate graph doesn't match  |
|                        | how the project ships                        |
| Section 2  (Errors)   | 4 error paths mapped, 0 GAPS (all fixed)    |
| Section 3  (Security)  | 1 finding — narrow Phase 4 step 15, no      |
|                        | blanket audit needed                         |
| Section 4  (Data/UX)  | 1 edge case mapped (reschedule split), now  |
|                        | closed; Growth-nav under-specified           |
| Section 5  (Quality)  | 3 dead-code/DRY items, cheap sweeps only    |
| Section 6  (Tests)    | 1 item kept (Phase step 21), resequenced    |
| Section 7  (Perf)     | No issues, moving on                        |
| Section 8  (Observ)   | 1 cut — duplicate observability module      |
| Section 9  (Deploy)   | 1 cut — 4-wave release ceremony             |
| Section 10 (Future)   | Reversibility 5/5; real debt = plan drift   |
| Section 11 (Design)   | SKIPPED — REDUCTION default; already        |
|                        | covered by plan-design-review.md             |
+--------------------------------------------------------------------+
| NOT in scope           | 4 items, written above                       |
| What already exists    | written (0B table, 10 rows)                  |
| Dream state delta      | written                                      |
| Error/rescue registry  | 4 methods, 0 CRITICAL GAPS (all fixed)       |
| Failure modes registry | 2 items (a11y), neither CRITICAL (not data)  |
| TODO candidates        | 4 items proposed, all accepted (Option A)    |
| CEO plan doc           | skipped (REDUCTION mode default)             |
| Outside voice          | substituted — 2 independent sibling reviews, |
|                        | cross-checked against primary sources        |
| Diagrams produced      | 2 (dependency/reality table, dream-state)    |
| Riskiest bet           | identified — proxy KPI not in PRD's own      |
|                        | 16 success metrics; 21/24 steps serve it     |
| Unresolved decisions   | 1 (see below)                                |
+====================================================================+
```

### Unresolved Decisions

- **Whether admin time or booking volume/revenue is the owner's real constraint (T4).** This is the
  one question no non-interactive review — this one included — can answer. Every other finding in
  this document is settled; this one gates whether Approach C's growth track ever opens, and it can
  only be resolved by asking the person who runs the business.

---

## Judgment calls made in place of `AskUserQuestion` (full list)

1. **Selected SCOPE REDUCTION mode** — reasoned from the skill's own >15-files default trigger
   (`docs/plan.md`'s own file list clears that bar) plus the staleness evidence this session found
   independently, converging with both sibling reviews' independent conclusions.
2. **Selected Implementation Approach B** (cut to punch list, fold into existing spec-driven loop)
   over A (follow literally) and C (open a growth track now) — reasoned that B is a strict subset of
   C that ships immediately without waiting on information only the owner can supply, and does not
   foreclose C once that information exists.
3. **Substituted the two sibling reviews for a live Codex/subagent "outside voice" dispatch** —
   reasoned that their independence was genuine (separate invocations, fresh context) and that this
   review's own re-verification against primary sources (not just trusting their summaries) provides
   at least as much adversarial rigor as a fourth model pass would, for a fraction of the session time.
4. **Skipped Section 11 (Design)** per REDUCTION mode's own default — reasoned that
   `plan-design-review.md` already covers this ground for the exact phases (1, 5) it applies to, and
   re-running it would duplicate work rather than add information.
5. **Accepted all 4 TODO candidates as Option A (add to the punch list)** rather than deferring or
   skipping any — reasoned that each is small, already diagnosed with file:line precision by this
   review or a sibling, and none has any dependency that would justify holding it back except T5,
   which is explicitly gated on T4 rather than skipped outright.
6. **Did not write a `TODOS.md` file** — the task's explicit "only create this one new file"
   instruction takes precedence over the skill's default step; TODO candidates are listed above
   instead, matching the precedent set by `plan-design-review.md`'s own run under the same constraint.
7. **Did not attempt to write a `## GSTACK REVIEW REPORT` section to `docs/plan.md`** — the task
   explicitly forbids editing that file; this document is the review's entire output, standing in
   place of both the interactive session and the plan-file status update the skill would normally
   produce.

If any of these calls should have gone the other way, they are each independently reversible — none
are load-bearing on each other, and none have been applied to any file other than this one.

**NO UNRESOLVED DECISIONS BLOCK SHIPPING THE PUNCH LIST ABOVE** — the one open item (T4) is a
conversation, not a blocker to fixing the two a11y bugs or re-baselining the plan document.
