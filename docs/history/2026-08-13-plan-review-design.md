# Design Plan Review — `docs/plan.md` Phase 1 + Phase 5

**Skill:** `/plan-design-review` (gstack) · **Run mode:** non-interactive (no human designer available)
**Scope:** Phase 1 — Information architecture redesign (steps 3–7); Phase 5 — UX/Design system
modernization (steps 17–20). Phases 0, 2, 3, 4, 6 are out of scope for this run.
**Reviewer grounding:** `docs/DESIGN.md` (token contract), `docs/history/2026-08-14-today-payment-log-design.md`,
`docs/history/2026-08-14-calendar-rebuild-design.md`, and the current `src/` implementation
(`DashboardLayout.tsx`, `InboxPage.tsx`, `CalendarCapacityTabs.tsx`, `CalendarShell.tsx`,
`ConfirmDialog.tsx`, `QuickActionLauncher.tsx`).
**Output policy for this run:** `docs/plan.md` and `docs/DESIGN.md` were **not** edited. Every "fix"
below is a recommended edit to the plan text, written here for a human (or the next planning pass)
to apply — not applied automatically.

---

## How this run differs from a normal `/plan-design-review`

The skill is built for an interactive session: it fires `AskUserQuestion` at every non-trivial
finding, generates visual mockups via the gstack designer and waits for a human to rate them on a
served comparison board, and edits the plan file in place as decisions land. None of that is
possible here — there is no human in the loop for this run. Per the calling instructions, every
internal decision point the skill would normally ask about was resolved by my own judgment,
grounded strictly in `docs/DESIGN.md` and the shipped code. Those points are marked **[JUDGMENT
CALL]** throughout and summarized again at the end.

The three biggest judgment calls, up front:

1. **Skipped visual mockup generation (Step 0.5).** The comparison-board feedback loop requires a
   human to open a served HTML board and rate variants — meaningless with nobody to view it.
   Phase 1's IA is also already substantially implemented (see below), so the more useful artifact
   was reading the actual shipped screens rather than mocking up an IA that already exists.
2. **Skipped the Codex/outside-voices dual-model pass.** That step is itself gated behind an
   `AskUserQuestion` ("want outside voices?") and is designed for a human to opt into. I judged that
   grounding every finding in verifiable codebase evidence was worth more here than a second,
   unverified model opinion.
3. **Treated "the plan" as the two Phase sections' prose, not the shipped code.** This surfaced the
   review's single biggest finding: large parts of Phase 1 (and part of Phase 2) are **already
   built**, and the plan text reads as if they are still pending. That drift between plan-as-written
   and reality is itself a design-process risk, scored under Pass 7.

---

## What already exists (reuse targets — do not rebuild)

| Component                                                                    | What it already solves                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/dashboard/DashboardLayout.tsx`                               | The full 7-item primary nav (Today/Inbox/Calendar & Capacity/Bookings/Customers/Growth/Settings), a visually-secondary 2-item tier (Reports, AI Assistant) below a divider, the dedicated `sidebar` token ramp (DESIGN.md §3), and a shared mobile slide-over that renders the identical nav. Both tiers explicitly cite `docs/plan.md Phase 1 step 3/6` in code comments.         |
| `src/pages/dashboard/InboxPage.tsx`                                          | Phase 1 step 5's Approvals+Requests consolidation, `?tab=` query-param state, SLA urgency styling (`text-status-pending` on holds expiring within 2h), and a policy-aware empty state.                                                                                                                                                                                             |
| `src/components/dashboard/CalendarCapacityTabs.tsx`                          | Phase 1 step 6's "first-class under Calendar & Capacity" — a segmented tab strip of three real routed pages (Schedule / Appointment type / Weekly hours), explicitly modelled on `CalendarShell`'s view switcher.                                                                                                                                                                  |
| `src/components/dashboard/calendar/CalendarShell.tsx`                        | The canonical accessible tab/segmented-control pattern: plain `<button>` + `aria-pressed`, **not** `role="tablist"`/`role="tab"`, with a code comment explaining why (promising roving-tabindex keyboard nav via ARIA and then not implementing it is worse for assistive tech than no ARIA at all).                                                                               |
| `src/components/ui/ConfirmDialog.tsx`                                        | A fully accessible modal primitive already proven in production: focus trap, Escape-to-close, focus restored to trigger on close, portaled to `document.body` (specifically to dodge `backdrop-filter` containing-block clipping), `role="alertdialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`. This is the reference implementation Phase 5 step 19 should point to. |
| `src/components/dashboard/QuickActionLauncher.tsx`                           | Phase 2 step 9's Cmd+K cross-nav launcher — already shipped, portaled, keyboard-aware, editable-target-safe.                                                                                                                                                                                                                                                                       |
| `src/components/ui/States.tsx`                                               | `EmptyState`/`ErrorState`/`LoadingState` — the reuse target for any interaction-state work Phase 1/5 need to specify.                                                                                                                                                                                                                                                              |
| The two shipped specs (Today command centre + payment log; Calendar rebuild) | Concrete evidence of "on-brief": both are written at the altitude the plan's Phase 1/5 prose is not — specific components, specific ARIA contracts, specific DESIGN.md citations, explicit non-goals.                                                                                                                                                                              |

This matters for the review below: several Phase 1 findings are not "the plan is wrong" but "the
plan describes a decision that was already made better, in code, than the plan's own words say."

---

## The 0–10 Rating Method — Results

### Pass 1: Information Architecture — **5/10**

**What's there:** Step 4's single-responsibility split (Today = live execution only, Bookings =
full list/search, Calendar = visualisation + slots) is genuinely good hierarchy reasoning — it
answers "what does the owner see first/second/third" per surface, not just per screen. Step 5's SLA
framing (age, expiring soon, next action) is IA that respects urgency, not just category.

**What's missing (why not a 10):**

- No primary/secondary tier definition, even though `DashboardLayout.tsx` already invented and
  shipped one (7 primary + 2 visually-secondary, divider-separated). The plan describes a flat list
  of 7; the shipped reality is richer and better.
- Step 6's "become first-class under Calendar & Capacity" never says _how_. It shipped as a
  three-route segmented tab strip (`CalendarCapacityTabs.tsx`) — a legitimate, specific IA
  decision the plan text doesn't capture, leaving a future reader to reinvent it (possibly
  differently, possibly with the ARIA-tabs footgun described in Pass 6).
- Step 7 ("Temporarily remove or relabel dead-nav entries... to preserve trust") describes a
  _worse_ solution than what shipped. The actual decision — keep both reachable, visually
  de-emphasized, cited in code as "neither is a stub or redirect" (`docs/history/2026-08-13-baseline-audit.md`) — is
  more trustworthy than removal or relabelling and should be the policy documented, not a
  temporary stopgap description.
- No mobile IA statement at all, despite `DashboardLayout.tsx` already handling it (identical nav
  JSX rendered in both the desktop sidebar and the mobile slide-over).

**Fix to 10 (recommended plan text):**

> Replace step 3 with an explicit two-tier statement: "7 primary nav entries, equal visual weight,
> plus a visually-secondary tier (Reports, AI Assistant) below a divider — always reachable, never
> hidden or relabelled, per the shipped `DashboardLayout.tsx` pattern." Replace step 6 with:
> "WeeklyDefaultPage and AppointmentTypePage surface as a segmented tab strip alongside Calendar's
> Schedule view (three routed pages, shared header) — the same visual language as `CalendarShell`'s
> Week/Day/Month switcher." Replace step 7 with a statement of the policy actually shipped (keep
> reachable, de-emphasize visually) rather than "remove or relabel." Add one line: "Mobile renders
> the identical primary+secondary nav inside the existing slide-over — no separate mobile taxonomy."

---

### Pass 2: Interaction State Coverage — **4/10**

**What's there:** Step 20 (Phase 5) names skeletons and optimistic updates as a category. Step 5's
SLA language implicitly requires a "no items" / "nothing waiting" state for the Approvals lane
under the current instant-confirm policy.

**What's missing:**

- Phase 1 never specifies states for the surfaces it restructures. It merges two queues (Approvals,
  Requests) into one page with two lanes — that merge changes what "empty" means for each lane
  (Approvals is _structurally_ almost-always-empty under current policy; Requests is not), and the
  plan doesn't say so even though the shipped code already got this right (`InboxPage.tsx`'s empty
  state literally explains the policy reason for zero rows).
- Phase 5 step 19's "reliable feedback patterns for all state-changing actions" names the concern
  but gives no table: no loading/success/error/optimistic-rollback breakdown per action type
  (approve, decline, mark-complete, log-payment, drag-reschedule).

**Fix to 10:**

> Add to Phase 1: an interaction-state note for Inbox's two lanes, matching what's shipped —
> Approvals' empty state explains the policy reason (not a generic "no items"), Requests' empty/
> queued/expiring states reuse `EmptyState`/`LoadingState`/`ErrorState` (`src/components/ui/States.tsx`).
> Add to Phase 5 step 19 an explicit state matrix: every state-changing action gets a row for
> loading (inline spinner via the existing `Button loading` prop), success (toast + optimistic UI
> update — already the pattern in `InboxPage.tsx`'s `approve`/`decline`), and error (toast via
> `showToast`/`errorMessage()` + rollback to prior state) — this is describing an existing,
> working pattern, not inventing one; the plan should say so explicitly so it isn't re-derived
> differently next time.

---

### Pass 3: User Journey & Emotional Arc — **3/10**

**What's there:** Step 5's SLA/urgency framing is the one place Phase 1 reasons about how the owner
_feels_ (time pressure on an expiring hold), not just what she sees.

**What's missing:** Nothing addresses the day-one emotional arc of an owner whose nav just moved
(`/dashboard/approvals` and `/dashboard/requests` now redirect into `/dashboard/inbox?tab=` — true
in code today, per `InboxPage.tsx`'s own comment, but not stated as a _plan commitment_, so a future
refactor could silently drop it and break bookmarks/muscle memory with no one noticing). Phase 5 is
written entirely as engineering-quality bullets ("resolve drift", "standardize", "upgrade") with no
owner-experience framing at all, despite `docs/DESIGN.md`'s own stated rationale for the whole
colour system being a twelve-hour shift, and `TodayPage.tsx`'s own comment about the tablet being
"left open... overnight."

**Fix to 10:**

> Add to Phase 1: "Old `/dashboard/approvals` and `/dashboard/requests` deep-links continue to
> redirect into the merged Inbox (already true in code — make it a plan-level commitment so it
> survives future refactors)." Add one line to Phase 5 tying step 20 (skeletons/optimistic updates)
> explicitly to the twelve-hour-shift, salon-tablet owner context DESIGN.md and TodayPage already
> establish — perceived performance is not generic "2026 quality," it's specifically for a tired
> owner glancing at a tablet between clients.

---

### Pass 4: AI Slop Risk / Design Hard Rules — **5/10**

**Classifier:** This is App UI (owner dashboard), not marketing/landing. Applying App UI rules:
calm surface hierarchy, dense-but-readable, minimal chrome, utility language, cards only when the
card _is_ the interaction.

**What's there:** The shipped nav (`DashboardLayout.tsx`) is already restrained — text-only labels,
no icon-in-colored-circle decoration (AI Slop blacklist item 3), flat token-driven surfaces, no
decorative gradients or ornamental shadows. This is good taste already in production; the plan just
doesn't say so, which means nothing stops a future pass from "improving" it with icon decoration.

**What's missing:** Phase 5 step 17 ("token misuse... primitive consistency") is the right
instinct — anti-slop is literally its job — but it stays abstract. It doesn't name the two concrete
primitive-drift instances already sitting in the codebase (see Pass 6) or DESIGN.md §8's single
most concrete "token misuse" footgun: opacity modifiers like `bg-primary/50` silently no-op against
this project's `var()`-based colours (Tailwind pinned to 3.4, not v4). "Resolve token misuse" with
no citation of that rule is asking an implementer to rediscover the exact bug DESIGN.md already
warns about by name.

**Fix to 10:**

> Add to Phase 1 step 3: "Primary nav stays text-only (no icon glyphs) — matches the shipped
> pattern; do not introduce icon-in-circle nav decoration." Rewrite Phase 5 step 17 as a concrete
> punch list: (a) unify the tab/segmented-control primitive on `CalendarShell`'s plain-button +
> `aria-pressed` pattern (see Pass 6 for the two files that still diverge); (b) grep for
> `bg-*/NN`-style opacity modifiers against token colours and replace with `color-mix()` or a
> dedicated token, per DESIGN.md §8's explicit warning; (c) audit for one-off `rounded-xl border …
shadow-card` combinations that should be the `Card` primitive instead.

---

### Pass 5: Design System Alignment — **5/10**

**What's there:** DESIGN.md exists and Phase 5 exists specifically to calibrate against it — the
right phase to have. `DashboardLayout.tsx` already correctly uses the dedicated `sidebar` token
ramp (DESIGN.md §3: "so it reads as chrome rather than content") rather than `card`/`background`.

**What's missing:** Phase 1 never states the sidebar-token rule as a constraint, even though it's
exactly the kind of thing a future "redesign the nav" pass could silently violate by reaching for
`bg-card`/`border` instead. Phase 5 step 18 ("standardize component behavior for density modes") is
ambiguous about scope: DESIGN.md §5 already defines exactly **two** fixed densities keyed to
_context_ (marketing `py-16`/`py-24` vs dashboard `p-4`/`gap-3`), not to user preference. The plan
doesn't say whether "standardize" means auditing existing components against those two, or
introducing a new user-facing density toggle (a materially bigger, unscoped feature DESIGN.md
doesn't currently support).

**Fix to 10:**

> Add to Phase 1 step 3: "Sidebar chrome uses the dedicated `sidebar`/`sidebar-foreground`/
> `sidebar-primary`/`sidebar-accent`/`sidebar-border`/`sidebar-ring` ramp (DESIGN.md §3), never
> `card`/`background`/`border`." Resolve step 18 explicitly **[JUDGMENT CALL — see below]**:
> "'Density modes' means auditing existing components against DESIGN.md §5's two already-defined
> densities (marketing spacious / dashboard dense) for drift — not building a new user-facing
> density toggle. A togglable density system is out of scope for this phase; revisit only if the
> owner explicitly asks for it."

---

### Pass 6: Responsive & Accessibility — **5/10**

**What's there:** Phase 5 step 19 correctly names the two highest-value a11y line items —
"keyboardable calendar interactions" and "accessible drawer/dialog behavior" — and both are backed
by an already-approved, far more rigorous spec (`2026-08-11-calendar-rebuild-design.md`): real
`<table>` semantics, `AgendaList` as a fully keyboard-operable zero-drag alternative, 44×44px touch
targets, `prefers-reduced-motion` handling.

**What's missing — and this is the review's most concrete, verifiable finding:** the plan's "token
misuse... primitive consistency" (step 17) and "reliable feedback patterns" (step 19) bullets
already have two live instances in exactly the surfaces Phase 1 touches:

1. **`src/pages/dashboard/SettingsPage.tsx`** still uses `role="tablist"` / `role="tab"` /
   `aria-selected` (lines ~164–178) — the identical half-implemented ARIA-tabs pattern that commit
   `b150cf3` ("FINDING-007 — drop half-implemented ARIA tabs on AssistantPage") just fixed
   elsewhere in this same codebase, on the same day, with a code comment explaining exactly why
   it's wrong: `role="tablist"`/`role="tab"` promises arrow-key roving-tabindex navigation that
   isn't implemented, which is worse for assistive tech than no ARIA at all.
2. **`src/pages/dashboard/InboxPage.tsx`**'s Approvals/Requests toggle (part of Phase 1 step 5,
   confirmed by `grep`) has **neither** `role="tablist"`/`role="tab"` **nor** `aria-pressed`/
   `aria-selected` — it's two plain buttons with no exposed selected-state at all. A screen-reader
   user gets no indication which lane is active.

Neither is hypothetical or a mockup gap — both are lines of shipped code, in the exact nav areas
Phase 1 restructures, and neither is mentioned in the plan despite Phase 5 existing specifically to
catch this class of drift.

Beyond that: neither Phase 1 nor Phase 5 restates DESIGN.md's concrete numeric bars (44×44px touch
targets, 4.5:1 body contrast) as acceptance criteria for the _new_ interactive surfaces Phase 1
introduces (Inbox's tab toggle, approve/decline buttons) — leaving compliance implicit rather than
a checked bar.

**Fix to 10:**

> Add to Phase 1: "All new/consolidated interactive targets (Inbox tab toggle, approve/decline
> actions) meet the 44×44px minimum (DESIGN.md §7)." Expand Phase 5 step 19 to name the acceptance
> bar explicitly instead of only pointing at the calendar spec: "drawer/dialog behaviour follows
> the pattern already proven in `ConfirmDialog.tsx` (focus trap, Escape-to-close, focus-restore,
> portal, `role=\"alertdialog\"`) rather than a second inconsistent implementation or an external
> library." Add two concrete line items under step 19, both P1, both trivial fixes against an
> existing proven pattern: unify `SettingsPage.tsx`'s tab markup onto the `CalendarShell`/
> `AssistantPage` plain-button + `aria-pressed` convention; add the missing pressed/selected state
> to `InboxPage.tsx`'s Approvals/Requests toggle.

---

### Pass 7: Unresolved Design Decisions

| Decision needed                            | If deferred, what happens                                                                                                                                                                                                                                                  | Resolution in this run                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar & Capacity sub-nav mechanism      | A future implementer re-derives a different (possibly ARIA-tabs) pattern than the one already shipped and proven.                                                                                                                                                          | **[JUDGMENT CALL]** Document the shipped `CalendarCapacityTabs.tsx` segmented-strip pattern as the answer — it already exists and is correct.                                                                                                                                                                                                                                                                                     |
| Density-mode scope (step 18)               | Either under-delivers (if a toggle was actually wanted) or balloons into unplanned settings UI (if "standardize" is read as "build a toggle").                                                                                                                             | **[JUDGMENT CALL]** Recommend audit-only against DESIGN.md §5's two existing context-keyed densities; explicitly defer a user-facing toggle pending an actual owner ask.                                                                                                                                                                                                                                                          |
| Dialog/drawer primitive strategy (step 19) | Risk of three concurrent, incompatible modal patterns: `ConfirmDialog`'s proven portal pattern, a newly-introduced library (e.g. Radix Dialog), and the existing "inline-expanding panel" convention the calendar spec explicitly says this codebase uses everywhere else. | **[JUDGMENT CALL]** Recommend extracting `ConfirmDialog.tsx`'s pattern into a general-purpose primitive for true blocking dialogs, and keeping the inline-panel convention (per the calendar spec's own explicit reasoning) for everything that isn't a blocking confirmation — not adopting an external library. This is a real product/scope call; flag it for explicit owner sign-off before building, don't silently default. |
| Plan-vs-shipped drift                      | Future planning passes (including AI-agent-authored ones) re-plan or re-implement already-solved IA work, or worse, regress a better shipped decision (step 7's actual behaviour) back to the plan's weaker described one ("remove or relabel").                           | Not a design taste call — a plan-hygiene fix. Recommend adding a one-line "already shipped, see `DashboardLayout.tsx`/`InboxPage.tsx`/`CalendarCapacityTabs.tsx`" callout to Phase 1 (and Phase 2 step 9) so nobody re-derives it.                                                                                                                                                                                                |

---

## NOT in scope for this review (deferred, with rationale)

- **Mockup generation** — no human available to rate a comparison board; Phase 1's IA is already
  built and directly inspectable in `src/`, which is a stronger artifact than a from-scratch mock.
- **Codex/outside-voices dual-model pass** — itself gated behind a human opt-in question in the
  skill; skipped in favour of codebase-verified findings.
- **Editing `docs/plan.md` directly** — explicitly out of scope for this run; all fixes above are
  recommendations only.
- **Phases 0, 2, 3, 4, 6** — outside this run's requested scope (Phase 1 + Phase 5 only), though
  Phase 2 step 9 (`QuickActionLauncher.tsx`) came up as reuse-target evidence in passing.
- **Creating `docs/TODOS.md`** — no such file exists in this repo yet; TODO candidates below are
  presented as recommendations rather than filed, since creating a new tracked file beyond this
  review document is outside this run's mandate.

## TODO candidates (would normally be one `AskUserQuestion` each — presented here for a human to file)

1. **Fix `InboxPage.tsx`'s missing tab-selected state** (P1). Add `aria-pressed` (or equivalent) to
   the Approvals/Requests toggle, matching `CalendarShell`/`AssistantPage`. Cheap, isolated, mirrors
   a pattern already proven correct in this exact codebase today.
2. **Fix `SettingsPage.tsx`'s incomplete `role="tablist"`** (P1). Same fix as FINDING-007, same
   rationale, one file away from being consistent.
3. **Formalize `ConfirmDialog.tsx` into a general `Dialog`/`Drawer` primitive** (P2, needs a scope
   decision — see Pass 7). Not a pure bug fix; genuinely worth an explicit go/no-go before building.
4. **Density-mode toggle** (Hold). Do not build until an owner explicitly asks for it — DESIGN.md
   doesn't currently define a third density, and inventing one un-asked is scope creep dressed as
   "standardization."

---

## Implementation Tasks

Synthesized from the findings above. P1 blocks calling Phase 1/5's design work "complete"; P2
should land in the same pass; P3 is a follow-up.

- [ ] **T1 (P1, human: ~20min / CC: ~5min)** — docs — Add two-tier nav definition + sidebar-token
      citation to Phase 1 step 3
  - Surfaced by: Pass 1, Pass 5
  - Files: `docs/plan.md`
  - Verify: re-read step 3, confirm it now names the secondary tier and the `sidebar-*` token rule
- [ ] **T2 (P1, human: ~15min / CC: ~5min)** — docs — Specify the Calendar & Capacity sub-nav
      mechanism (segmented tab strip, three routed pages) in step 6
  - Surfaced by: Pass 1, Pass 7
  - Files: `docs/plan.md`
- [ ] **T3 (P2, human: ~15min / CC: ~5min)** — docs — Rewrite step 7 to describe the shipped
      "always reachable, visually secondary" policy instead of "remove or relabel"
  - Surfaced by: Pass 1
  - Files: `docs/plan.md`
- [ ] **T4 (P1, human: ~30min / CC: ~10min)** — a11y — Add pressed/selected ARIA state to
      `InboxPage.tsx`'s Approvals/Requests toggle
  - Surfaced by: Pass 6 — confirmed via `grep` that neither `role="tab"` nor `aria-pressed` exists
    on this toggle today
  - Files: `src/pages/dashboard/InboxPage.tsx`
  - Verify: screen-reader manual pass; extend `InboxPage.test.tsx`
- [ ] **T5 (P1, human: ~30min / CC: ~10min)** — a11y — Replace `SettingsPage.tsx`'s
      `role="tablist"`/`role="tab"` with the `CalendarShell`/`AssistantPage` plain-button +
      `aria-pressed` pattern
  - Surfaced by: Pass 4, Pass 6 — same pattern FINDING-007 already fixed once this session
  - Files: `src/pages/dashboard/SettingsPage.tsx`
- [ ] **T6 (P2, human: ~30min / CC: ~10min)** — docs — Add interaction-state table for Inbox's two
      lanes and a state matrix for Phase 5 step 19's "reliable feedback patterns"
  - Surfaced by: Pass 2
  - Files: `docs/plan.md`
- [ ] **T7 (P2, human: ~20min / CC: ~5min)** — docs — Expand Phase 5 step 17 into the concrete
      punch list (tab-primitive unification, opacity-modifier audit, primitive-reuse audit)
  - Surfaced by: Pass 4, Pass 5
  - Files: `docs/plan.md`
- [ ] **T8 (P2, human: ~10min / CC: ~5min)** — docs — Resolve and state the density-mode decision
      in step 18 (audit-only, no new toggle, pending explicit owner ask)
  - Surfaced by: Pass 5, Pass 7
  - Files: `docs/plan.md`
- [ ] **T9 (P1, human: ~20min / CC: ~5min)** — docs — Expand step 19 to cite `ConfirmDialog.tsx` as
      the canonical dialog/drawer contract and name the two concrete tab-state fixes (T4, T5)
  - Surfaced by: Pass 6
  - Files: `docs/plan.md`
- [ ] **T10 (P3, human: ~10min / CC: ~5min)** — docs — Add an "already shipped" callout at the top
      of Phase 1 cross-referencing `DashboardLayout.tsx`/`InboxPage.tsx`/`CalendarCapacityTabs.tsx`
  - Surfaced by: Pass 7 (plan-vs-shipped drift)
  - Files: `docs/plan.md`

_No new tasks from Pass 3 beyond what T6/T3 already cover — the emotional-arc gap is closed by the
same plan-text edits, not a separate task._

---

## Completion Summary

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md exists; UI scope = Phase 1 IA +   |
|                       | Phase 5 design-system modernization         |
| Step 0                | Initial rating: 5/10 — good IA bones,       |
|                       | large plan/shipped-code drift, two live     |
|                       | a11y bugs found in the surfaces it touches  |
| Pass 1  (Info Arch)  | 5/10 → 9/10 if T1–T3 applied                |
| Pass 2  (States)     | 4/10 → 8/10 if T6 applied                   |
| Pass 3  (Journey)    | 3/10 → 7/10 if T3/T6 applied                |
| Pass 4  (AI Slop)    | 5/10 → 9/10 if T1/T7 applied                |
| Pass 5  (Design Sys) | 5/10 → 9/10 if T1/T7/T8 applied             |
| Pass 6  (Responsive) | 5/10 → 9/10 if T4/T5/T9 applied             |
| Pass 7  (Decisions)  | 4 surfaced, all resolved by judgment call   |
|                       | in this run (see below) — none applied      |
+--------------------------------------------------------------------+
| NOT in scope          | 5 items, written above                      |
| What already exists   | written above (8 components/specs)          |
| TODOS candidates      | 4 items, presented (no TODOS.md exists)     |
| Approved Mockups      | 0 generated (no human to rate them)         |
| Decisions made        | 0 (plan.md not edited, per task scope)      |
| Decisions deferred    | 4 (Pass 7 table) — all resolved by judgment |
|                       | call here, none applied to plan.md          |
| Overall design score  | ~4.5/10 → ~8.5/10 if T1–T10 applied          |
+====================================================================+
```

Plan is **not** design-complete as written. The largest single risk is not a missing design
decision but **stale plan prose describing already-shipped, already-better decisions** — anyone
implementing Phase 1 from `docs/plan.md` alone, without reading the current `src/`, would likely
redo or regress work that already exists and is already correct.

### Unresolved Decisions

None are unresolved in the sense of "nobody answered" — every decision point this run would
normally raise via `AskUserQuestion` was resolved by judgment call (see next section) precisely
because no human was available to answer. They remain **unapplied** to `docs/plan.md` — flagging
that distinction explicitly per the skill's own "never silently default" rule.

---

## Judgment calls made in place of `AskUserQuestion` (full list)

Every point below would, in a normal interactive run, have been a blocking `AskUserQuestion`. Since
none was available, each was resolved using best professional judgment grounded in `docs/DESIGN.md`
and the shipped code, and is called out here so a human reviewer can override any of them:

1. **Skipped Step 0.5 visual mockup generation entirely**, in favour of reading shipped code as the
   visual reference — reasoned that Phase 1's IA already exists and is inspectable directly, which
   is stronger evidence than a generated mock of something already built.
2. **Skipped the "outside design voices" (Codex) pass** — reasoned that codebase-verified findings
   (e.g., the two live ARIA-tab bugs) outweigh a second unverified model opinion for this review's
   purpose.
3. **Resolved Calendar & Capacity's sub-nav mechanism** (Pass 1/7) as "document the shipped
   `CalendarCapacityTabs.tsx` pattern" rather than proposing an alternative — reasoned that the
   shipped pattern is already correct and consistent with `CalendarShell`, so the fix is
   documentation, not redesign.
4. **Resolved the density-mode ambiguity** (Pass 5/7, step 18) as "audit against DESIGN.md's two
   existing densities, do not build a new user-facing toggle" — reasoned that DESIGN.md defines
   exactly two context-keyed densities today, and a togglable system is a materially larger,
   currently-unrequested scope expansion that should get an explicit owner decision, not be
   defaulted into existence by a "standardize" bullet.
5. **Resolved the dialog/drawer primitive strategy** (Pass 6/7, step 19) as "extract
   `ConfirmDialog.tsx`'s pattern for true blocking dialogs; keep the inline-panel convention
   elsewhere; do not adopt an external library" — reasoned from the calendar spec's own explicit
   statement that this codebase "has no modal/dialog primitive and consistently uses
   inline-expanding panels instead," treating that as a deliberate, working convention rather than
   a gap to paper over with a dependency.
6. **Treated the SettingsPage/InboxPage ARIA-tab findings as P1 fixes**, not merely plan-doc notes —
   reasoned that they are live accessibility bugs in shipped code sitting inside the exact surfaces
   Phase 1 restructures, discovered as a direct consequence of reviewing Phase 1's design-system
   alignment, so surfacing them as build-actionable tasks (T4, T5) rather than only as plan-text
   edits better serves the review's purpose.
7. **Did not create `docs/TODOS.md`** — reasoned that the task's explicit "only create this one new
   file" instruction takes precedence over the skill's default "always write TODOS.md" step; TODO
   candidates are listed in this document instead.

If any of these calls should have gone the other way, they are each independently reversible —
none are load-bearing on each other.
