# Design consultation — Owner Console shell extension

**Run:** `/design-consultation`, non-interactive (headless subagent, no human reviewer
present for this session — see §8 for exactly which calls that affects).
**Date:** 2026-08-13
**Scope:** Extend the Today page's approved refresh direction
(`docs/superpowers/specs/2026-08-13-today-command-center-payment-log-design.md`) to the
other six navs of the 7-nav Owner Console shell — Inbox, Calendar & Capacity, Bookings,
Customers, Growth, Settings — plus the shared sidebar chrome. **This is an extension
brief, not a new design system.** It proposes zero new colours and treats
`docs/DESIGN.md` as load-bearing throughout.
**Output discipline:** this file only. `docs/DESIGN.md` is not edited by this
consultation — any token-level change it recommends is a proposal for a human to fold
into DESIGN.md later, not something already applied.

---

## 1. What this is and what it replaces

The normal `/design-consultation` flow proposes an aesthetic, palette, and type system
from a blank page, then asks the user to pick between generated variants. None of that
applies here: Kokolett already has a shipped, tokenised identity (terracotta `#e05d38`
against cool-neutral greys, Inter/Source Serif 4/JetBrains Mono, `0.75rem` radius, one
shadow) and a memory-recorded standing instruction
(`kokolett-rebrand-direction`, 2026-08-13) that the current work is an **elevated
refresh** of that identity — richer type rhythm, better spacing/density, real
interactivity — explicitly not a repaint.

So this brief skips Phase 2 (competitive research) and Phase 5 (font+colour mockup
generation) from the skill's usual flow — both are for choosing a palette, and there is
no palette to choose. What survives is Phase 3's proposal discipline (a coherent,
opinionated package with an explicit SAFE/RISK split) and Phase 6's job of writing
something a builder can execute against — retargeted at _component-level_ decisions
(sidebar, stat tiles, list density, calendar surface, settings forms) instead of
system-level ones (fonts, palette).

**Baseline audit finding, worth stating up front:** the six target pages are not a
mismatched patchwork the refresh has to reconcile. `DashboardLayout`, `Card`, `Button`,
`Field`/`Input`/`Select`/`Textarea`, `StatusChip`, `EmptyState`/`ErrorState`/
`LoadingState`, and `ConfirmDialog` are already shared across every one of them —
Inbox, Bookings, Customers, Growth and Settings all already use `font-display` section
headings, uppercase-tracked micro-labels, and `font-mono tabular-nums` for money/time/
reference numbers, because they're built from the same primitives Today is. The
refresh's job is narrower and more honest than "unify six inconsistent pages": it's to
(a) take the specific pattern innovations the Today spec introduced — a named,
reusable interaction shape, and a slightly richer type/spacing treatment for the
single most important number on a screen — and deliberately propagate them, and (b)
fix the handful of real inconsistencies the audit below found, rather than inventing
new ones to fix.

---

## 2. The memorable thing

Per the skill's own forcing question — one sentence, everything below should serve it:

> **"She can run her whole day from her phone between clients and the software never
> makes her stop and think."**

Not "delightful," not "modern" — _fast to re-orient after an interruption_. A
twelve-hour solo-owner day is a sequence of five-second glances between clients, not a
sit-down session. Every recommendation below is judged against: does this make the
next glance faster, or does it just look nicer sitting still?

---

## 3. System-level confirmation (no changes proposed)

Carried forward unchanged from `docs/DESIGN.md` — restated here only so this brief is
self-contained, not because anything below alters them:

- **Colour:** terracotta `#e05d38` primary, cool-neutral greys, status hues per §3's
  table. **Zero new hex values anywhere in this brief.**
- **Type roles:** Inter (UI/body), Source Serif 4 (display — `font-display` in
  Tailwind), JetBrains Mono (numerals/references/times — `font-mono`).
- **Radius:** `0.75rem` base (`rounded-lg`), with the existing `sm`/`md`/`xl`/`2xl`
  steps.
- **Elevation:** one shadow, `shadow-card`. No new shadow values proposed.
- **Motion:** 150–300ms `ease-out`, collapsed globally under
  `prefers-reduced-motion: reduce` (`src/index.css:135`). Nothing below asks for a new
  duration or easing curve.
- **Accessibility floor:** WCAG 2.2 AA, 44×44px touch targets, colour never carries
  status alone. Every proposal below is written to satisfy this by construction, not
  as an afterthought.

---

## 4. What "the Today precedent" actually establishes

Reading the Today spec closely, its "richer type rhythm, better spacing/density, real
interactivity" isn't a vague mood — it cashes out to two concrete, reusable moves. The
job of this brief is to name them precisely enough that they propagate consistently
rather than getting reinvented per-page.

### 4.1 The disclosure-action pattern

`AppointmentCard`'s owner-note control (`Add note` → open textarea → `Save note` →
collapses to `Note ✓`) is the shape the Today spec deliberately reused for payment
logging rather than inventing a new interaction (`Log payment` → amount + note →
`Save payment` → collapses to `Paid £45.00`). The spec's own reasoning for this
(§3): a blocking modal is rejected because "forcing three taps per customer to record
something that already happened is how a diary stops being kept," and a
no-prompt-at-all control is rejected because it's "the easiest thing to forget on a
twelve-hour day." The disclosure-action shape is the resolution: zero-friction to
ignore, one click to open, collapses to a scannable confirmation chip once done.

This is now a **named, reusable pattern**, not a one-off for notes and payments. It's
the right shape for any optional, non-blocking data-capture task attached to a row —
which several of the target pages already have ad hoc:

- Growth's inline "Add a style" form is a permanently-open sidebar panel, not a
  disclosure — fine for a rare, deliberate action (adding a menu item), wrong if it
  ever needs a per-row equivalent.
- Settings' `googlePlaceId`/`googleReviewUrl` fields are always-visible inputs on a
  visited tab — correct, since editing a setting isn't optional-per-item the way a
  note is.
- Customers' contact-edit block (`Edit` → inline form → `Save`/`Cancel`) is
  _already_ the disclosure shape, just not named as such. Good — it's independent
  confirmation the pattern predates this brief in places, not a new invention.

**Recommendation:** treat "disclosure-action block" as a documented interaction
pattern (open → inline fields → primary + ghost-cancel pair → collapses to a
confirmation line), and reach for it by default whenever a new per-row optional
action is added anywhere in the six target navs, rather than choosing between a modal
and an always-open form each time.

### 4.2 Headline-metric weighting

The Today spec's stat tiles aren't new markup — `Card p-4` + uppercase-tracked label +
`font-display text-2xl font-semibold` value already exists verbatim on
`AppointmentsPage`'s four stat tiles too (`AppointmentsPage.tsx:192-207`). What the
spec changes is _meaning_: "Expected takings" (a placeholder sum the codebase itself
flags as unreliable) becomes "Collected today" (an owner-entered, trustworthy figure).
The visual lesson isn't a new component — it's that **the single most-trusted number
on a stat row deserves to look more trusted than its neighbours**, and right now all
four tiles on both Today and Bookings are typographically identical regardless of
which one the owner actually needs to act on. §5.2 below turns this into a concrete
tile-weighting rule.

---

## 5. Component-level proposal, by surface

Each of these is scoped to component treatment and spacing rhythm within the existing
token set — no new primitives beyond one small extraction (§5.2's `StatTile`), which
is a refactor of code that already exists twice, not a new pattern.

### 5.1 Sidebar nav (`DashboardLayout.tsx`)

**Current:** flat `Link` rows, active state = full-width filled pill
(`bg-sidebar-primary`), 7 primary entries + a divider + 2 visually-secondary legacy
entries (Reports, AI Assistant). Already correct in structure — the audit found
nothing wrong with the IA or the `isEntryActive` logic, both of which stay untouched.

**Proposal — SAFE:** keep the filled-pill active state. It's clear, meets contrast,
and a full block target is more forgiving to tap than a thin accent bar would be —
important on the "borrowed iPad in portrait" device this file's own comments already
call out. Don't risk touch-target regression for a purely visual refinement here.

**Proposal — refinement within the safe choice:** the current pill is functionally
correct but visually flat next to the richer stat-tile treatment proposed below —
right now the sidebar and the content area don't share a sense of "this got more
design attention." Two low-risk additions, both inside existing tokens:

- Give the active pill a subtle inset treatment using the sidebar's own `-ring` token
  on focus (already present, just not currently distinct from the hover state) so
  keyboard navigation through the sidebar is as legible as mouse hover.
- Increase the label weight step between inactive (`font-medium`, current) and active
  states slightly further using the existing `font-semibold` step already used
  elsewhere (Card titles, stat values) — currently active and inactive sidebar labels
  differ only by colour, not weight, which is a smaller signal than every other "this
  is the important one" moment in the app uses.

**Proposal — RISK:** demote the Reports/AI Assistant secondary block from "smaller
text, same list" to genuinely distinct chrome — e.g. a label caption ("More") above
them, or moving them to sit only in account-adjacent chrome rather than the primary
nav column. Today they're already `text-[13px] font-normal` and `/70` opacity-adjacent
via `sidebar-foreground/70`, so the current treatment is defensible; the risk is
whether two items permanently sitting below a divider, on every screen, for two
features described elsewhere in `docs/plan.md` as "temporarily relabel until
implemented," undersells that they're second-class on purpose. **Judgment call:**
leave this as a flagged option rather than a firm recommendation — it's a product-scope
question (are Reports/AI Assistant graduating soon?) more than a visual one, and this
brief shouldn't quietly decide that.

### 5.2 Stat tiles — extract `StatTile`, add a weighting rule

**Current:** `TodayPage.tsx:202-231` and `AppointmentsPage.tsx:192-207` each hand-build
an identical `Card p-4` tile independently — same markup, duplicated, with no shared
component. That duplication is itself a small maintenance risk (a future visual tweak
has to be made twice, and Today's already drifted slightly — it wraps tiles in a
`Link` with a focus ring the Bookings version doesn't have).

**Proposal — extract a shared `StatTile` component** (`src/components/ui/StatTile.tsx`)
taking `label`, `value`, optional `to` (renders the existing `Link`-wrapped focus-ring
variant), optional `tone` (`'default' | 'warn'`, matching `AppointmentsPage`'s existing
`tone === 'warn'` status-pending colour swap), and optional `urgent` hint line
(matching Today's "Some expire within 2 hours" sub-line). This is a pure refactor of
two already-duplicated call sites — zero visual risk, straightforward win.

**Proposal — headline-metric weighting rule (the concrete form of §4.2):** add a
`variant?: 'headline' | 'default'` prop. `headline` steps the value up from
`text-2xl` to `text-3xl` and the label from `text-xs` to `text-sm`, while keeping
every other tile at the current size. Exactly one tile per stat row gets `headline`:

- Today: "Collected today" (once the payment-log migration lands per the spec) — the
  number the owner is most likely to check first thing and last thing.
- Bookings: "Needs closing off" — already singled out with the `warn` tone; giving it
  the size step too means the one number that requires action reads as heavier before
  the owner even processes the colour.
- Inbox: no stat row currently exists (the tab-count badges serve that role instead —
  see §5.3). No change proposed there.

This is a five-line component change with an outsized effect on the "five-second
glance" goal from §2: right now every stat tile asks for equal attention, which
functionally means none of them get priority attention.

### 5.3 List / card density

**Current state is already mostly right**, and the audit specifically did not find a
case for uniformly tightening everything — Inbox's approval cards (`InboxPage.tsx:266`,
`Card p-5`) are deliberately roomier than Bookings' history rows because an approval
is a decision with three data points and two possible actions to read before acting,
while a Bookings history row is a completed, already-resolved fact being scanned past.
Collapsing that difference would make Inbox faster to scroll and slower to actually
use, which fails the §2 test.

**Proposal — name the two densities that already exist, so future pages pick the
right one deliberately rather than by copying whichever file is open:**

- **Comfortable** (`Card p-5`, `gap-3`+ spacing, full StatusChip + secondary detail
  visible): for anything requiring a decision before moving on — Inbox approval
  cards, Today's schedule (`AppointmentCard`), Customers' detail panel.
- **Compact** (`-mx-2 rounded-lg px-2 py-2.5 hover:bg-muted`, the row treatment
  Growth's service-menu list already uses at `ServiceMenuPage.tsx:194`): for
  already-resolved or high-volume scanning — this exact treatment should extend to
  Customers' list rows (currently a `Card`-per-row grid at `p-4`, heavier than it
  needs to be for a list that's often dozens of rows long) and to Bookings' grouped
  history rows once a booking is `completed` (a completed row doesn't need the same
  visual weight as one still awaiting an owner decision).

**Concrete change proposed:** Customers' list view (`CustomersPage.tsx:186-247`)
currently renders every customer as a bordered `Card`-weight tile even in the
post-selection single-column mode. Switch the single-column mode specifically to the
compact hover-row treatment (keep the existing tile-grid for the no-selection,
multi-column browse mode — that one benefits from the heavier boundary since rows
sit side by side, not stacked). This is a genuine density win for an owner scrolling a
growing customer list, consistent with §2.

### 5.4 Calendar surface

**Current state, on inspection, is the most visually mature surface in the app
already** — `DayView`/`WeekView` render a real `<table>` with genuine hour rows, a
`color-mix()`-based today tint (`DayView.tsx:186`, already the correct workaround for
DESIGN.md §8's opacity-modifier limitation), status colour carried via `border-l-4` +
a small dot rather than a filled background (matching AppointmentCard's precedent and
correctly avoiding the WCAG contrast failure a filled status colour would hit at
10–11px), and a drag-to-reschedule interaction with a ghost preview.

**Proposal — SAFE:** don't touch the interaction model, the drag mechanics, or the
`<table>` accessibility structure. This is load-bearing and already correct; a refresh
that "modernises" working drag/keyboard code for cosmetic reasons is the wrong kind of
risk.

**Proposal — one real inconsistency found, worth fixing:** `EventBlock.tsx:96` sets
the booked-block time label at `font-mono text-[11px]` — an arbitrary value outside
the documented `text-xs`(12)/`text-sm`(14) scale, one pixel under the DESIGN.md §4
floor ("never below 14px for anything a customer must read to book" — this is
owner-only, so the floor technically doesn't bind, but the _hour labels_ beside it
(`DayView.tsx:173`) go even smaller, to `text-[10px]`). Two arbitrary sub-scale sizes
sitting next to each other, on the single most information-dense screen in the app, is
the kind of thing "richer type rhythm" is supposed to fix. **Recommendation:** step
both up to the nearest scale value — hour labels to `text-xs` (12px, the actual scale
floor) and event-block time labels stay `text-xs` as well rather than a separate
11px step — and confirm the grid still fits the shortest (15-minute) slot height
before shipping (`HOUR_ROW_PX` may need a look; this is an implementation check, not a
design one).

**Proposal — RISK:** `CalendarShell`'s Week/Day/Month view switcher and
`CalendarCapacityTabs`'s Schedule/Appointment type/Weekly hours switcher already use
the same segmented-control pattern (`bg-muted p-1` container, active =
`bg-card shadow-card`) — good, that's already the right precedent. See §5.5 for why
Inbox and Settings don't match it and should.

### 5.5 Settings forms — and a cross-cutting tab inconsistency

**Real inconsistency found (not invented for this brief):** there are currently
**three different visual treatments for "switch between sections of one page"** live
in the app simultaneously:

| Surface                                                           | Container                               | Active state                                         |
| ----------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Calendar view switcher (`CalendarShell`)                          | `bg-muted p-1`, segmented               | `bg-card shadow-card`                                |
| Calendar & Capacity page switcher (`CalendarCapacityTabs.tsx:25`) | `bg-muted p-1`, segmented               | `bg-card shadow-card`                                |
| Inbox Approvals/Requests switcher (`InboxPage.tsx:188`)           | `border border-border p-0.5`, segmented | `bg-primary text-primary-foreground` (filled)        |
| Settings section tabs (`SettingsPage.tsx:166`)                    | none, `border-b border-border`          | `border-b-2 border-primary text-primary` (underline) |

Three patterns doing the identical job (in-page section switching) is exactly the kind
of drift a "same visual system across the rest of the nav" pass exists to catch — a
returning owner has to re-learn which affordance means "this is the active tab" three
different ways depending on which page she's on.

**Proposal — RISK, and the strongest opinion in this brief:** standardise on the
segmented-control shape already used by two of the four (`bg-muted p-1` container,
`bg-card shadow-card` active state). Rationale: it already appears more often, it
pairs naturally with the elevated-card language used everywhere else (the active tab
_is_ a small card, reusing the same `shadow-card` token rather than inventing a new
signal), and it reads as more "designed" than a plain underline — which matters for
the "richer" half of the brief. Concretely: Inbox's Approvals/Requests switcher
changes container (`border` → `bg-muted p-1`) and active state (filled primary →
`bg-card shadow-card`); Settings' section tabs change from underline to the same
segmented shape. **Cost:** Settings currently has four tabs and an underline row can
comfortably wrap or scroll on narrow screens in a way a segmented pill row is
marginally less used to doing gracefully — verify wrap behaviour at four tabs on a
360px viewport before shipping this one.

**Proposal — form density, Settings specifically:** the Booking Rules tab
(`SettingsPage.tsx:335-477`) stacks six `Field`s in a single column inside one `Card`.
Every one of those fields is a short numeric input with a one-line hint — exactly the
shape Inbox's approval-card `dl` grid (`InboxPage.tsx:287`, `grid gap-3 sm:grid-cols-3`)
already handles well for short label/value pairs. **Recommendation:** at `sm:` and
above, lay Booking Rules' numeric fields out two-per-row instead of one-per-row (label

- hint stacked above each input, same as now — just two columns instead of one). This
  roughly halves the scroll length of the single longest form in the app without
  changing a single field's own treatment, which is exactly the "better density" the
  Today precedent asks for, applied to a form instead of a list.

**Proposal — SAFE, unchanged:** keep the Save button un-sticky and bottom-anchored.
A sticky save bar is tempting on a long form, but this form is short enough after the
two-column change above that the tradeoff (extra chrome permanently on screen) isn't
worth it — revisit only if a future settings section grows meaningfully past Booking
Rules' current length.

### 5.6 Growth (formerly Services)

**Current state:** already close to the target — `Card`-grouped sections, a
sticky-on-desktop add-form sidebar (`ServiceMenuPage.tsx:287`, `lg:sticky lg:top-24`),
and the compact hover-row list treatment (§5.3) that this brief recommends _extending
to_ Customers, not changing here. Growth is, structurally, already what the other
pages should look more like.

**Proposal:** no structural change. The one thing worth flagging: this page is titled
"Services" in its own `DashboardLayout` `title` prop (`ServiceMenuPage.tsx:151`) while
the sidebar entry and the 7-nav IA call it "Growth" (`DashboardLayout.tsx:71`,
`plan.md` Phase 1 step 3). That's a naming gap, not a visual one, but it sits exactly
on the boundary of this brief's scope (it's the page header, which _is_ a visual
element) so it's worth naming here even though the fix belongs to whoever owns
Growth's eventual scope expansion (`plan.md` Phase 2 step 8 describes Growth as
"manage website-facing offer/requests/subscribers/reviews" — broader than the current
Services-only page). **Judgment call:** flagged, not fixed — renaming the page header
now, before Growth's scope actually expands, risks being wrong twice.

### 5.7 Bookings and Inbox

Both already inherit everything proposed above (StatTile weighting for Bookings'
"Needs closing off" tile per §5.2; the tab standardisation for Inbox per §5.5) with no
additional page-specific treatment needed — which is itself the point of an extension
brief: most of the work is propagating a small number of named patterns consistently,
not inventing six bespoke treatments.

---

## 6. Motion — real interactivity, still restrained

The Today spec's "real interactivity" doesn't mean new animation — DESIGN.md §6 already
caps this system at 150–300ms ease-out with opacity-only state transitions, and that
cap is correct for a "five-second glance" product. What it means in practice, applied
to this brief's proposals:

- The disclosure-action block (§4.1) should open/close with the same treatment
  `noteOpen` already gets implicitly (instant, no transition currently defined) — add
  the existing `animate-fade-up`/opacity pattern already defined in
  `tailwind.config.ts:92-99` so the block's appearance reads as intentional rather
  than a layout jump, without introducing a new keyframe.
- `StatTile`'s `headline` variant (§5.2) should NOT animate its size on data refresh —
  numbers changing size on every poll is the kind of "real interactivity" that reads
  as noisy rather than alive. Keep tile updates static; reserve motion for
  user-triggered opens (disclosure blocks, tab switches), not for data arriving.
- No new easing curve, no new duration bucket. This is a hard constraint carried from
  §3, not a proposal.

---

## 7. SAFE / RISK summary

**SAFE (already-correct patterns this brief asks to extend, not change):**

- Shared primitives (`Card`, `Button`, `Field`, `StatusChip`, empty/error/loading
  states) stay exactly as they are — the audit found no case for touching them.
- Calendar's drag/keyboard/table accessibility structure is untouched.
- Sidebar's filled-pill active state and touch-target sizing are untouched.
- No new colour, shadow, radius, or motion primitive anywhere in this brief.

**RISK (deliberate departures, each with an explicit cost):**

1. Standardise all in-page tab/section switchers on the segmented-control shape
   (§5.5) — costs a wrap-behaviour check on Settings at narrow viewports.
2. Give exactly one stat tile per row a `headline` size step (§5.2) — costs a small
   amount of visual rhythm-breaking on rows that currently read as uniform; the bet is
   that's a feature (draws the eye correctly) not a bug.
3. Collapse Customers' single-column list rows to the compact hover treatment (§5.3)
   — costs the heavier card boundary some owners may have gotten used to; the bet is
   density wins on a growing list.

---

## 8. Judgment calls made without a human present

This run had no reviewer available for the skill's normal AskUserQuestion checkpoints.
Every one of the following was resolved by the agent's own best judgment and should be
sanity-checked by a human before anything here is implemented:

1. **Skipped Phase 0's "update DESIGN.md / start fresh / cancel" prompt entirely** —
   the task brief already fixed the answer (extension, not new system, and DESIGN.md
   itself must not be edited), so the prompt had no live decision left to make.
2. **Skipped Phase 2 (competitive research / WebSearch / browse) and Phase 5 (AI
   mockup generation / font+colour comparison board)** — both exist to choose a
   palette and aesthetic direction from scratch; there is no such choice here.
   Grounding instead came from reading the actual current implementation of all seven
   target pages plus the shared primitives, which is the closest equivalent available
   for a token-constrained extension.
3. **The "memorable thing" answer (§2)** is this agent's own synthesis of the Today
   spec's stated rationale ("forcing three taps... is how a diary stops being kept"),
   not a fresh answer from the product owner. Worth confirming it still matches her
   own framing.
4. **§5.1's sidebar RISK item (demoting Reports/AI Assistant further)** was
   deliberately left as a flagged option rather than a firm recommendation — it
   depends on a product-roadmap question (are those features graduating soon?) this
   brief has no authority to answer.
5. **§5.5's tab-standardisation direction** (segmented-control over underline, rather
   than the reverse) is a genuine 50/50 aesthetic call — both patterns are individually
   fine and used elsewhere in mature products. The recommendation follows majority
   precedent already in this codebase (2 of 4 instances) plus a coherence argument
   (reuses `shadow-card` rather than introducing a new active-state signal), but a
   human with actual taste preference here could reasonably choose the other
   direction.
6. **§5.6's Growth/Services naming gap** was flagged rather than fixed, on the
   judgment that renaming a page header ahead of an actual scope change (per
   `plan.md` Phase 2) risks solving the wrong problem.
7. **No AI mockups or HTML preview page were generated.** The skill's Phase 5 normally
   produces a visual artifact before writing anything permanent; skipped here because
   nothing in this brief touches typography, colour, or aesthetic direction — the
   inputs a preview page exists to visualise. Every proposal instead cites the exact
   file and line of the pattern being extended or the inconsistency being fixed, on
   the judgment that concrete code references serve this particular brief's "show your
   work" job better than a mockup would for a component-level, token-constrained
   extension.
8. **Telemetry, gstack config, and cross-project-learnings preamble steps from the
   skill's own bootstrap were not executed** — they configure the interactive CLI
   experience (upgrade checks, proactive-suggestion prompts, artifact sync) and have
   no bearing on the content of a design brief. Skipped as out of scope for a
   subagent whose only deliverable is this file.

---

## 9. What this brief does not cover

Per the task's explicit boundary: no change to `docs/DESIGN.md` or any other tracked
file. Nothing here is implemented — this is the brief a build plan would be written
against next, the same relationship the Today spec has to its own (still-pending)
implementation. Also out of scope, per the Today spec's own stated sub-project 2
boundary: purging remaining customer-facing price references, and any change to
`services.price_pence`/`appointments.price_pence`.
