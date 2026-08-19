# Design Shotgun — Owner Console Nav Shell

Exploration for the sidebar/nav shell that replaces
`src/components/dashboard/DashboardLayout.tsx` under the simplified 7-nav Owner
Console IA (`docs/plan.md` Phase 1 step 3): **Today, Inbox, Calendar & Capacity,
Bookings, Customers, Growth, Settings**, plus two visually-secondary entries that
sit outside the 7-nav model (**Reports, AI Assistant** — real, shipped pages, kept
reachable rather than hidden, per the existing code's own comment).

All variants are constrained to `docs/DESIGN.md`'s locked tokens: terracotta
`#e05d38` primary, the dedicated `sidebar`/`-foreground`/`-primary`/`-accent`/
`-border`/`-ring` colour ramp, Inter for UI text, `0.75rem` radius, exactly one
shadow (`shadow-card`), 44×44px touch targets, visible focus rings, and
colour-never-alone status signalling. No new brand colours, fonts, or shadows
appear anywhere below.

## How this run differs from a normal `/design-shotgun`

Normally this skill generates AI image mockups and opens a browser comparison
board for a human to rate. No human was available for this run, per the task.
Two deliberate adaptations (both judgment calls, flagged again at the bottom):

1. **No AI-generated visual mockups.** A nav shell is an interaction/structure
   problem (breakpoints, touch targets, active-state logic, information
   density) more than a mood-board problem. A generic AI image render would
   invent spacing, typography and icon details that don't map onto the real
   Tailwind/React implementation, and there was no reviewer to look at images
   anyway. Variants below are specified at the level DESIGN.md itself uses:
   concrete widths, breakpoints, Tailwind-scale spacing, and named tokens.
2. **Self-judged, not board-voted.** Each variant is scored against the three
   criteria the task specified, and one winner is picked with reasoning below.

## The five variants

### Variant A — Persistent Wide Rail (minimal evolution of current shell)

- **Desktop (`lg:` ≥1024px):** fixed 240px sidebar, always icon-less,
  full-label. Unchanged from the current `DashboardLayout.tsx`.
- **Grouping:** flat list of the 7 primary entries, one `border-sidebar-border`
  divider, then the 2 secondary entries at reduced weight (`text-[13px]`,
  70%-opacity foreground) — exactly the current model.
- **Active state:** solid `bg-sidebar-primary` fill, full-width pill,
  `sidebar-primary-foreground` text — exactly the current treatment.
- **Mobile (<1024px):** full-screen slide-over with a `black/50` scrim,
  triggered by a "Menu" button in the header — exactly the current pattern.
- **Density:** comfortable, `py-2.5` primary rows, `gap-1` between items.
- **Why considered:** lowest implementation risk and zero retraining cost —
  the owner already knows this shell. Useful as the baseline every other
  variant is measured against.

### Variant B — Collapsible Icon Rail

- **Desktop:** sidebar defaults to a 64px icon-only rail, expandable to 240px
  via a persistent toggle chevron. Requires adding an icon set — **the repo
  currently has no icon library at all** (`grep` of `package.json` for
  lucide/heroicons/react-icons/phosphor returns nothing), so this variant
  carries a real new-dependency cost none of the others do.
- **Grouping:** same one-divider model as A.
- **Active state:** icon recolours to `sidebar-primary` plus a tinted
  background circle; label (when expanded) sits in a solid pill as in A.
  Collapsed mode relies on a hover tooltip to disclose the label.
- **Mobile:** identical drawer to A (icon rail collapse is desktop-only).
- **Density:** dense — more items fit without scrolling once labels are gone.
- **Why considered:** the conventional "maximize canvas" SaaS pattern
  (Linear/Notion/Vercel-style rail), useful as the canvas-optimized end of the
  spectrum to weigh against glanceability.

### Variant C — Grouped Sections

- **Desktop:** 240px sidebar, entries organised under three small-caps Inter
  group headers (`text-xs`, no new font, no new colour): **Operate** (Today,
  Inbox, Calendar & Capacity), **Manage** (Bookings, Customers), **Grow**
  (Growth, Settings), with Reports/AI Assistant under a final unlabelled,
  demoted group as today.
- **Active state:** 4px `sidebar-primary` left border + a light
  `sidebar-accent` background tint, rather than a full solid fill — a lighter
  "you are here" affordance that still pairs colour with a shape change (not
  colour alone).
- **Mobile:** a bottom sheet (slides up ~80% height, grab handle) instead of a
  full-screen scrim overlay, for one-handed phone thumb-reach.
- **Density:** comfortable, same row height as A; group headers add a small
  amount of vertical rhythm cost.
- **Why considered:** tests whether semantic grouping helps wayfinding. Real
  tension flagged here: `docs/plan.md` step 3 explicitly _flattens_ the IA
  from a more cluttered current state down to 7 items — re-introducing groups
  partially undoes that simplification for a marginal wayfinding gain.

### Variant D — Flat Dense List, Tablet-First Breakpoint

- **Desktop/tablet:** same 220–240px full-label sidebar as A, but the
  visibility breakpoint is pulled in from `lg:` (1024px) to `md:` (768px), and
  the mobile drawer trigger only appears below `md:`. This directly targets a
  gap already implicit in the current shell: `DashboardLayout.tsx`'s own
  account-block comment names "an iPad in portrait, a plausible salon device"
  as a real case to design for, yet the sidebar visibility class
  (`hidden ... lg:flex`) and the drawer trigger (`lg:hidden`) both key off
  1024px — an iPad in portrait (CSS width ≈768–834px) falls below that and
  loses the persistent sidebar entirely, landing in "tap Menu to see nav."
  Landscape iPad (~1024px) is the exact `lg` boundary, so it just barely
  keeps it; portrait does not.
- **Grouping:** flat, no dividers at all — even the current single divider
  before Reports/AI Assistant is dropped; the two are told apart only by the
  existing reduced-opacity treatment.
- **Active state:** solid pill fill as in A, kept unchanged (no new
  contrast risk).
- **Mobile (<768px, phone only):** same full-screen slide-over as A.
- **Density:** the tightest of the five, but bounded by DESIGN.md's own
  floors rather than going below them — `text-sm` (14px) labels throughout,
  never the smaller 13px A already uses for secondary items; rows compressed
  via tighter inter-item `gap-0.5` rather than shorter row height, so the
  44×44px minimum touch target is never at risk.
- **Why considered:** most directly answers the brief's stated primary
  device — a tablet left open at the front desk overnight — by closing a
  breakpoint gap that already exists in the current shell for that exact
  device class.

### Variant E — Adaptive Collapse (icon rail at tablet width, full label at desktop)

- **Desktop (≥1280px):** full 240px icon+label sidebar.
- **Tablet range (768–1279px):** auto-collapses to a 72px icon-only rail with
  hover tooltips (same new-icon-library cost as Variant B).
- **Mobile (<768px):** full-screen slide-over.
- **Active state:** two synced treatments — full pill in expanded mode, a
  terracotta-tinted 44×44px icon circle plus left accent bar in collapsed
  mode, so "current page" survives the collapse.
- **Grouping:** single divider, as in A.
- **Density:** adaptive — comfortable when expanded, compact when collapsed.
- **Why considered:** the "smart default" many dashboards ship — trade label
  visibility for canvas exactly in the medium-width range, full labels at
  true desktop width. Useful as a foil to Variant D, which makes the opposite
  bet at the same breakpoint.

## Evaluation

Scored against the three criteria set for this headless run: owner-speed
(glanceable on an unattended salon tablet, per the "iPad in portrait" case
already named in the codebase and the calendar-rebuild spec's "left open on a
salon tablet overnight" framing), WCAG 2.2 AA fit, and identity fit with
DESIGN.md's terracotta/cool-neutral system.

| Variant                                 | Owner-speed / glanceability                                                                                                                                                                                                                                                               | WCAG 2.2 AA                                                                                                                                                                      | Identity fit                                                                                                                                                                                   | Verdict                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A — Persistent Wide Rail                | Good: labels always visible, zero decoding. Inherits the existing `lg:` breakpoint gap, so a portrait salon tablet still loses the sidebar.                                                                                                                                               | Solid — matches the already-shipped, already-scoped baseline.                                                                                                                    | Full token compliance, lowest risk.                                                                                                                                                            | Safe, but doesn't fix the one real gap for the stated primary device.           |
| B — Collapsible Icon Rail               | Poor for this device: icon-only recognition requires memorization exactly where the brief asks for glance-and-decide. Hover tooltips are the disclosure mechanism, and a touchscreen tablet has no hover — the label becomes undiscoverable on the primary device without a tap-and-hold. | At risk: label disclosure depends on a pointer affordance the primary device doesn't have.                                                                                       | Token-compliant, but a generic icon-rail visual language is a bigger swing from DESIGN.md's warm/utilitarian direction, and it requires a new icon dependency the repo doesn't currently have. | Rejected — optimizes for the wrong device.                                      |
| C — Grouped Sections                    | Mixed: grouping helps only once a mental model is learned, and adds scan cost that works against the plan's explicit flattening goal. Bottom-sheet mobile pattern is a bigger, less-tested interaction change.                                                                            | Fine if the border-accent active state keeps a non-colour cue (it does, via a shape change) — needs care to confirm contrast on the tint.                                        | Token-compliant.                                                                                                                                                                               | Interesting but not clearly justified against the flattening intent of Phase 1. |
| D — Flat Dense, Tablet-First Breakpoint | Best fit: closes the actual breakpoint gap for the named primary device (portrait salon tablet), keeps full labels always, density is tightened only via spacing, never below the 14px/44px floors.                                                                                       | Strong — touch targets and label size explicitly held at DESIGN.md's own floors; no new contrast risk since active-state styling is unchanged from the already-correct baseline. | Full token compliance, no new dependency.                                                                                                                                                      | **Winner.**                                                                     |
| E — Adaptive Collapse                   | Wrong-way optimization: it collapses labels away specifically in the 768–1279px range, which is exactly where the salon tablet lives, trading the primary device's glanceability for the secondary (desktop) device's canvas.                                                             | Same touch/hover mismatch as B, but scoped precisely onto the primary device this time — worse, not better.                                                                      | Token-compliant but the most complex to implement (two synced active-state treatments) and needs the same new icon dependency as B.                                                            | Rejected — inverts the brief's stated priority.                                 |

## Winner: Variant D — Flat Dense List, Tablet-First Breakpoint

**Pick this one.** It is the only variant that treats "glanceable on a salon
tablet left open overnight" as the design constraint to solve for, rather than
as a secondary concern traded off against desktop canvas efficiency (B, E) or
against wayfinding structure (C). Concretely:

- It closes a real, code-visible gap: the current shell's `lg:` (1024px)
  breakpoint hides the persistent sidebar on a portrait tablet, which
  `DashboardLayout.tsx`'s own comment already names as "a plausible salon
  device." Pulling the breakpoint to `md:` (768px) means that device always
  sees the full labelled nav without a "Menu" tap.
- It never trades label legibility for density — the tightening happens in
  inter-item spacing, not in type size or touch-target height, so it doesn't
  create a new AA risk to fix later.
- It requires no new dependency (unlike B and E, which need an icon library
  the repo doesn't have) and no new active-state logic to keep in sync
  (unlike E's two-tier treatment), keeping implementation risk close to
  Variant A's while actually fixing A's one real gap.
- Dropping the divider before Reports/AI Assistant is a small, deliberate
  simplification in the same spirit as Phase 1's flattening — kept only
  because it costs nothing and there's no evidence the divider does useful
  work once the primary/secondary rows already differ in opacity.

## Judgment calls made in this run (flagged explicitly, as requested)

1. **Skipped AI image-mockup generation** and worked at the structural/CSS
   level instead. The `design-shotgun` binary was available
   (`DESIGN_READY: ~/.claude/skills/gstack/design/dist/design`), but a nav
   shell redesign is an interaction/structure problem, not a mood-board
   problem, and there was no human reviewer for a comparison board anyway.
2. **Reconciled two device framings.** `docs/PRD.md` §3 frames the owner's
   primary device as a phone ("the day's schedule in one glance on a phone");
   the task brief and `docs/superpowers/specs/2026-08-11-calendar-rebuild-design.md`
   frame it as a salon tablet left open overnight. Treated these as two real
   surfaces rather than picking one: phone stays served by the mobile drawer,
   tablet by the persistent sidebar — which is why the breakpoint fix (not a
   mobile-drawer redesign) is the lever Variant D pulls.
3. **Rejected icon-only/collapsible-rail treatments (B, E) partly on an
   inferred usability risk, not a literal WCAG success-criterion citation** —
   tooltip-based label disclosure doesn't work on a touchscreen without
   hover, which is a real gap for the stated primary device even though it
   isn't a named WCAG 2.2 SC by itself.
4. **Adjusted Variant D's density spec to respect DESIGN.md's type-size floor**
   ("Never below 14px for anything a customer must read to book") even though
   that rule is written for customer-facing booking copy, not owner-dashboard
   chrome. Extending it to sidebar labels was a conservative default in the
   absence of an explicit carve-out, rather than shipping a variant that
   would need a follow-up fix.
5. **Picked one winner outright** rather than proposing a hybrid of two
   variants, per the task's instruction — Variant D is written to already
   absorb the one useful idea from Variant A (its low-risk, minimal-change
   philosophy) rather than presenting a separate blended sixth option.
