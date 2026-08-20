# Owner Console shell — component markup patterns

> **Archived 2026-08-20 — superseded, not shipped as written.** Markup reference for the 7-entry nav that was never built. The shipped sidebar is the grouped one in `src/components/dashboard/DashboardLayout.tsx`. Read this for Tailwind patterns, never as a description of the current shell.

Component-level Tailwind reference for the new 7-nav Owner Console shell
(`docs/plan.md` Phase 1, step 3: Today, Inbox, Calendar & Capacity, Bookings,
Customers, Growth, Settings). This is a pattern-library excerpt, not a page —
four markup patterns: sidebar nav, stat tile, appointment list-row, top app
bar. Real example content throughout, no placeholder/lorem text.

## Method and scope (read first)

- **No approved `/design-shotgun` variant and no `/plan-ceo-review` context
  exist for this screen.** Every colour, spacing and type choice below is
  read directly off `docs/DESIGN.md` (terracotta `#e05d38` primary against
  cool-neutral greys, cards floating on a soft grey ground, one shadow only,
  0.75rem radius, WCAG 2.2 AA, 44×44px touch targets, restrained 150–300ms
  motion) and cross-checked against the actual shipped implementation
  (`src/components/dashboard/DashboardLayout.tsx`,
  `src/components/dashboard/AppointmentCard.tsx`,
  `src/pages/dashboard/TodayPage.tsx`, `src/components/ui/StatusChip.tsx`,
  `src/components/ui/Card.tsx`, `tailwind.config.ts`, `src/index.css`) rather
  than invented fresh — that shipped Today-page refresh is the concrete
  precedent this spec was told to follow for stat-tile and card treatment.
- **This skill (`/design-html`) is normally interactive** — it drives
  `AskUserQuestion` decision points, a live Pretext-powered preview server,
  and vision-model mockup comparison. None of that applies to a static
  markdown reference with no human in the loop, so every decision point the
  skill would normally ask about was decided unilaterally here. Each one is
  called out explicitly, inline, as a **Judgment call**, and they're
  collected again at the end.
- Class names match the project's real Tailwind token names
  (`bg-sidebar`, `text-status-pending`, `shadow-card`, `font-display`,
  `font-mono`, …) so this doc can be copied into a component with only
  structural edits, not a token-renaming pass.
- **One hard constraint carried over from `DESIGN.md` §8:** the palette
  resolves through CSS custom properties (`var(--token)`), so opacity
  modifiers like `bg-primary/50` silently produce nothing. None of the
  patterns below use an opacity suffix on a token colour — `bg-black/50` on
  the mobile drawer backdrop is the one exception, and it's safe because
  `black` isn't a `var()`-backed token.

---

## 1. Sidebar nav — desktop rail + mobile drawer

Source of truth for structure/tokens: `DashboardLayout.tsx`, which already
implements the 7-item model with `aria-current` computed off the same
boolean the styling uses (a plain `<Link>`, not `NavLink`, because `NavLink`'s
own matching double-marks Today on every dashboard sub-route and misses
Calendar & Capacity's grouped paths). Two things below are **not** in the
shipped component yet and are additions this spec makes explicit:

- **Icon+label.** No icon library (`lucide-react`, `@heroicons/react`, etc.)
  is currently a dependency (checked `package.json` — none present). The
  inline SVGs below are hand-authored placeholders (24×24 viewBox, 1.75px
  stroke, `currentColor`, rendered at 20×20px) so the icon+label spacing and
  alignment pattern can be reviewed without silently deciding a dependency.
  **Judgment call:** recommend `lucide-react` at implementation time — MIT,
  tree-shakeable, matches the project's otherwise-minimal dependency
  footprint — but that choice isn't made here.
- **Explicit 44px minimum row height** (`min-h-11`) on every nav item.
  The shipped markup's `py-2.5` on `text-sm` lands close to 44px but doesn't
  guarantee it; `DESIGN.md` §7 states 44×44px as a hard minimum, not an
  approximation.

```html
<!-- ============================================================
     DESKTOP RAIL — fixed, persistent, lg breakpoint and up.
     ============================================================ -->
<aside
  class="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex"
>
  <!--
    bg-sidebar / border-sidebar-border: the sidebar's OWN colour ramp
    (DESIGN.md §3 "Sidebar" — #dddfe2 light / #2a303f dark), distinct from
    --card, so the shell reads as chrome rather than content.
  -->
  <a
    href="/dashboard"
    class="mb-6 block px-3 font-display text-lg font-semibold text-sidebar-foreground"
  >
    <!-- font-display = Source Serif 4 (DESIGN.md §4) — the one serif
         accent inside an otherwise-sans dashboard, used only for the
         wordmark and page/section headings, never body copy. -->
    Kokolett
  </a>

  <nav class="flex flex-col gap-1" aria-label="Dashboard">
    <!-- ACTIVE item: terracotta fill. --sidebar-primary resolves to the
         same #e05d38 as --primary — the sidebar ramp borrows the brand hue
         for exactly one state (current page), so it still reads as "the
         warm accent" rather than a second, competing colour system. -->
    <a
      href="/dashboard"
      aria-current="page"
      class="flex min-h-11 items-center gap-3 rounded-md bg-sidebar-primary px-3 py-2.5 text-sm font-medium text-sidebar-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
        <path d="M8.75 14.5l2 2 4.5-4.5" />
      </svg>
      <span>Today</span>
    </a>

    <!-- INACTIVE item with a count badge. -->
    <a
      href="/dashboard/inbox"
      class="flex min-h-11 items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span class="flex items-center gap-3">
        <svg
          class="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h4.5l1.75 3h5.5l1.75-3H21" />
          <path
            d="M5.5 5h13l2 7v6.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18.5V12l2-7Z"
          />
        </svg>
        <span>Inbox</span>
      </span>
      <!-- bg-primary, NOT bg-sidebar-primary: an "act on this" cue should
           read as the same colour everywhere it appears in the app, badge
           included, not a sidebar-scoped variant of it. -->
      <span
        class="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground"
        aria-label="4 items need attention"
        >4</span
      >
    </a>

    <a
      href="/dashboard/calendar"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
      </svg>
      <span>Calendar &amp; Capacity</span>
    </a>

    <a
      href="/dashboard/appointments"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="3.5" width="14" height="17" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h3.5" />
      </svg>
      <span>Bookings</span>
    </a>

    <a
      href="/dashboard/customers"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3.25" />
        <path d="M2.75 20a6.25 6.25 0 0 1 12.5 0" />
        <path d="M16.5 4.75a3.25 3.25 0 0 1 0 6.34M20 20a5.25 5.25 0 0 0-4.25-5.15" />
      </svg>
      <span>Customers</span>
    </a>

    <a
      href="/dashboard/services"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 18.5 9 12l4 4 8.5-8.5" />
        <path d="M16.5 7.5h5v5" />
      </svg>
      <span>Growth</span>
    </a>

    <a
      href="/dashboard/settings"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <svg
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 4v2.2M12 17.8V20M6.2 6.2l1.55 1.55M16.25 16.25l1.55 1.55M4 12h2.2M17.8 12H20M6.2 17.8l1.55-1.55M16.25 7.75l1.55-1.55"
        />
      </svg>
      <span>Settings</span>
    </a>

    <!-- Divider + visually-secondary entries: two shipped, real pages that
         sit outside the 7-nav model (Reports, AI Assistant — see
         docs/history/2026-08-13-baseline-audit.md) but must stay reachable, not hidden. Kept
         out of the primary list per docs/plan.md step 7 ("relabel dead-nav
         entries... to preserve trust") without removing access. -->
    <div class="my-2 border-t border-sidebar-border" aria-hidden="true"></div>

    <a
      href="/dashboard/reports"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[13px] font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span>Reports</span>
    </a>
    <a
      href="/dashboard/assistant"
      class="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[13px] font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span>AI Assistant</span>
    </a>
  </nav>

  <!-- Account block pinned to the bottom via mt-auto. -->
  <div class="mt-auto space-y-3 pt-6">
    <a
      href="/dashboard/profile"
      class="block truncate text-xs text-sidebar-foreground hover:underline"
      >owner@kokolettbeauty.com</a
    >
    <button
      type="button"
      class="inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      Sign out
    </button>
  </div>
</aside>

<!-- ============================================================
     MOBILE DRAWER — slide-over, below lg. Rendered conditionally
     on an `menuOpen` boolean in the real component.
     ============================================================ -->
<div class="fixed inset-0 z-40 lg:hidden">
  <!-- Backdrop. bg-black/50 is safe here — black isn't a var()-backed
       token, so the opacity modifier actually works (unlike bg-primary/50). -->
  <button
    type="button"
    aria-label="Close menu"
    class="absolute inset-0 bg-black/50"
  ></button>

  <div
    class="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4"
  >
    <!-- Same wordmark + <nav> block as the desktop rail, reused verbatim —
         one source of truth for the 7 entries, only the outer container
         changes shape (fixed rail vs. slide-over panel). -->
    <p class="mb-6 px-3 font-display text-lg font-semibold text-sidebar-foreground">
      Kokolett
    </p>
    <!-- …nav content identical to the block above… -->
    <div class="mt-auto pt-6"><!-- …account block identical to the block above… --></div>
  </div>
</div>
```

**Token annotation**

| Class                                                             | DESIGN.md backing                                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `bg-sidebar`, `border-sidebar-border`                             | §3 "Sidebar" — the shell's own ramp, `#dddfe2` / `#2a303f`                        |
| `bg-sidebar-primary`, `text-sidebar-primary-foreground`           | §3 — active-item fill, resolves to the same terracotta as `--primary`             |
| `hover:bg-sidebar-accent`, `hover:text-sidebar-accent-foreground` | §3 — sidebar-scoped hover, not the page's `--accent`                              |
| `focus-visible:ring-sidebar-ring`                                 | §7 — visible focus on everything interactive, sidebar-scoped ring colour          |
| `font-display`                                                    | §4 — Source Serif 4, wordmark/headings only                                       |
| `min-h-11` (44px)                                                 | §7 — 44×44px touch minimum, made explicit rather than approximated                |
| `rounded-md`                                                      | §5 — one step down from the `rounded-lg` default, matches shipped nav-item radius |

---

## 2. Stat tile / KPI card

Base structure matches the shipped `TodayPage.tsx` stat row exactly: a
`Card`-shaped `div` (`rounded-xl border border-border bg-card p-4
shadow-card`), a small-caps label, a large headline figure. Two things to
flag before the markup:

- **The headline figure uses `font-display` (serif), not `font-mono`.**
  `DESIGN.md` §4 assigns JetBrains Mono to "numerals, references... booking
  references and times" — and the shipped code applies that narrowly: times
  and references (`AppointmentCard.tsx`) are mono, but the aggregate KPI
  number on the Today page is deliberately `font-display text-2xl
font-semibold`. This spec follows the narrower, already-shipped reading
  rather than DESIGN.md's typography table read as a blanket "all numbers
  are mono" rule. **Judgment call**, flagged because the two readings
  genuinely disagree and only one is what's actually live.
- **"Collected today" replaces "Expected takings."** The currently-shipped
  fourth stat sums a placeholder price snapshot and labels it "Expected
  takings" — `docs/history/2026-08-14-today-payment-log-design.md`
  (approved, not yet implemented) replaces that with a real owner-entered
  figure under the key `today_collected_pence`. Using "Collected today" here
  is a forward reference to that approved-but-unbuilt spec, not something
  already live — called out so nobody reads this as documentation of current
  behaviour.

```html
<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <!-- Plain (non-interactive) tile. -->
  <div class="rounded-xl border border-border bg-card p-4 shadow-card">
    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Booked today
    </p>
    <p class="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">7</p>
  </div>

  <div class="rounded-xl border border-border bg-card p-4 shadow-card">
    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Collected today
    </p>
    <p class="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
      £184.00
    </p>
  </div>

  <!-- Interactive tile — deep-links into a filtered Inbox tab. The focus
       ring and rounded corner live on the <a>, one layer above the card's
       own border, so keyboard focus outlines the whole clickable area
       rather than colliding with the card's internal border-radius. -->
  <a
    href="/dashboard/inbox?tab=approvals"
    class="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div class="h-full rounded-xl border border-border bg-card p-4 shadow-card">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Awaiting approval
      </p>
      <p class="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
        3
      </p>
      <!-- Urgency sub-line reuses the pending-status hue as TEXT colour (not
           a background fill) — the same colour the calendar and status
           chips use for pending_approval, so "running out of time" reads
           consistently everywhere it shows up, not just on the calendar. -->
      <p class="mt-1 text-xs font-medium text-status-pending">
        Some expire within 2 hours
      </p>
    </div>
  </a>

  <a
    href="/dashboard/inbox?tab=requests"
    class="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div class="h-full rounded-xl border border-border bg-card p-4 shadow-card">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        New enquiries
      </p>
      <p class="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
        2
      </p>
    </div>
  </a>
</div>
```

**Optional elevated variant — leading icon chip.** Not present in the
shipped Today page; offered here as a candidate refinement in the spirit of
`kokolett-rebrand-direction`'s "elevated refresh... richer type rhythm,
better spacing/density." Uses only real tokens (`bg-accent` /
`text-accent-foreground` — "highlights, selected slot" per DESIGN.md §3),
never an opacity-modified token:

```html
<div class="rounded-xl border border-border bg-card p-4 shadow-card">
  <div class="flex items-center gap-3">
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
    >
      <svg
        class="h-4.5 w-4.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M2.5 18.5 9 12l4 4 8.5-8.5" />
        <path d="M16.5 7.5h5v5" />
      </svg>
    </span>
    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Booked today
    </p>
  </div>
  <p class="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">7</p>
</div>
```

**Token annotation**

| Class                                                               | DESIGN.md backing                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `rounded-xl border border-border bg-card shadow-card`               | §5 — the `Card` primitive; one shadow only, depth from card/ground contrast                     |
| `text-xs font-medium uppercase tracking-wide text-muted-foreground` | §3/§4 — muted label, dense/utilitarian dashboard rhythm                                         |
| `font-display text-2xl font-semibold`                               | §4 — Source Serif 4 for the headline figure (see judgment call above)                           |
| `tabular-nums`                                                      | §4 typography scale — figures shouldn't jitter width as digits change, even in the serif face   |
| `text-status-pending`                                               | §3 appointment-status table — reused as a general "time pressure" cue, not only on the calendar |
| `bg-accent text-accent-foreground`                                  | §3 — "Highlights, selected slot" token, safe (no opacity modifier)                              |

---

## 3. Appointment list-row / card, with status chip

Matches `AppointmentCard.tsx`'s structure closely: an `article` card, a
mono time column, a customer identity block carrying the status chip, an
actions row, and the collapsible owner-note pattern (`Add note` → textarea →
`Save note` → collapses to `Note ✓`) — the exact interaction shape the
approved payment-log spec reuses for its new "Log payment" block, cited here
because it's the one collapsible-block precedent already in the codebase.

### Status colour + label table (`DESIGN.md` §3)

| Status                   | Light hex | Dark hex  | Tailwind class (dot)   | Label shown          |
| ------------------------ | --------- | --------- | ---------------------- | -------------------- |
| `pending_approval`       | `#d97706` | `#f59e0b` | `bg-status-pending`    | Awaiting approval    |
| `confirmed`              | `#2563eb` | `#60a5fa` | `bg-status-confirmed`  | Confirmed            |
| `in_service`             | `#7c3aed` | `#a78bfa` | `bg-status-in-service` | In service           |
| `completed`              | `#059669` | `#34d399` | `bg-status-completed`  | Completed            |
| `cancelled` / `rejected` | `#6b7280` | `#9ca3af` | `bg-status-cancelled`  | Cancelled / Declined |
| `no_show`                | `#dc2626` | `#f87171` | `bg-status-no-show`    | No show              |

Two extra states in the live `AppointmentStatus` type reuse these same six
hues rather than adding new ones: `checked_in` → `bg-status-confirmed`,
`rescheduled` → `bg-status-cancelled`.

### Status chip

Colour never carries the status alone (§3, §7 — roughly 1 in 12 men has a
colour vision deficiency, and the owner's calendar is the one screen where a
misread is expensive): the chip's own background/border stay neutral
(`bg-muted` / `border-border`); only an 8px dot carries the hue, and the
text label is always present at `text-foreground`, which is the one colour
in this chip guaranteed to clear 4.5:1 — the status hues themselves do not,
at 12px text (`#d97706` on white is ~3.4:1).

```html
<span
  class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
>
  <span class="h-2 w-2 shrink-0 rounded-full bg-status-pending" aria-hidden="true"></span>
  Awaiting approval
</span>
```

### Full list-row card

```html
<article class="rounded-xl border border-border bg-card p-4 shadow-card">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
    <!-- Time column. font-mono here (not the stat tile's font-display) —
         DESIGN.md §4 assigns JetBrains Mono specifically to "booking
         references and times," and this IS a time, unlike the aggregate
         stat-tile figure above. -->
    <div class="shrink-0 sm:w-20">
      <p class="font-mono text-lg font-semibold tabular-nums text-foreground">10:15</p>
      <p class="text-xs text-muted-foreground">45m</p>
    </div>

    <!-- Identity block. -->
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <p class="truncate font-medium text-foreground">Amara Okafor</p>
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full bg-status-pending"
            aria-hidden="true"
          ></span>
          Awaiting approval
        </span>
        <!-- Secondary, non-status badge — neutral border, no fill, so it
             never competes with the status chip for attention. -->
        <span
          class="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
        >
          First visit
        </span>
      </div>
      <p class="truncate text-sm text-muted-foreground">
        <a
          href="mailto:amara.okafor@example.com"
          class="hover:text-foreground hover:underline hover:underline-offset-4"
        >
          amara.okafor@example.com
        </a>
        ·
        <a
          href="tel:+447700900123"
          class="hover:text-foreground hover:underline hover:underline-offset-4"
        >
          +44 7700 900123
        </a>
        ·
        <span class="font-mono">KLT-2H4F9</span>
        <!-- Reference: mono, per §4 — "references" alongside times. -->
      </p>
      <p class="mt-1 text-sm text-muted-foreground">
        &ldquo;Balayage, same as last time please.&rdquo;
      </p>
    </div>

    <!-- Actions. size="sm" (h-9, 36px) is a deliberate, documented exception
         in Button.tsx — dense controls for a pointer-device owner table,
         never the customer booking path — so it's kept here unchanged. -->
    <div class="flex shrink-0 flex-wrap gap-2">
      <button
        type="button"
        class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Confirm
      </button>
      <button
        type="button"
        class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Decline
      </button>
      <button
        type="button"
        class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-transparent px-3 text-sm font-semibold text-foreground border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Add note
      </button>
    </div>
  </div>

  <!-- Collapsible owner-note block — collapsed state shown (chip already
       said "Note ✓"); the same shape as `AppointmentCard.tsx`'s open state
       would put a <textarea> + "Save note"/"Cancel" pair here instead. -->
  <div class="mt-3 border-t border-border pt-3">
    <p class="text-sm text-muted-foreground">
      <span class="font-medium text-foreground">Your note: </span>
      Used 6.0/7.0 mix, took closer to an hour.
    </p>
  </div>
</article>
```

**Completed-status left border (list emphasis, not the chip itself):**

```html
<article
  class="rounded-xl border border-border border-l-4 border-l-status-completed bg-card p-4 shadow-card"
>
  <!-- …identical contents… -->
</article>
```

**Token annotation**

| Class                                                 | DESIGN.md backing                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `rounded-xl border border-border bg-card shadow-card` | §5 — same `Card` primitive as the stat tile, one shadow only                                                                                |
| `font-mono ... tabular-nums` (time)                   | §4 — JetBrains Mono for times, non-jittering digits                                                                                         |
| `font-mono` (reference)                               | §4 — JetBrains Mono for "references"                                                                                                        |
| `bg-status-pending` (dot only)                        | §3 status table — colour supports the label, never replaces it (§7)                                                                         |
| `border-l-status-completed`                           | §3 — status hue as a left-border accent on a neutral fill, avoiding the white-text-on-status-fill contrast failure a solid fill would cause |
| `h-9` action buttons                                  | Button.tsx's documented sm-exception — dense, pointer-device owner table, not customer-facing                                               |

---

## 4. Top app bar

Matches `DashboardLayout.tsx`'s header: sticky, blurred, a mobile drawer
trigger, title/subtitle, and a right-aligned actions cluster (live clock,
realtime-connection indicator, quick actions, notifications, theme toggle).

One deliberate change from the shipped code, flagged rather than silently
applied:

- **"New booking" is bumped from `size="sm"` (36px) to a 44px target.**
  The live `TodayPage.tsx` currently renders both `Refresh` and `New
booking` at the same dense `sm` size. `Refresh` stays dense here too — it
  matches Button.tsx's own documented sm-exception (secondary, low-stakes,
  pointer-device density). But `New booking` is the single busiest primary
  CTA in the entire owner shell, reachable from every page, and the
  approved payment-log spec explicitly restates that "WCAG 2.2 AA and
  44×44px touch targets... carry over unchanged" — so it shouldn't inherit
  the table-density exception. **Judgment call, and a specific
  recommendation to apply to the live component**, not just this reference.

```html
<header
  class="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6"
>
  <div class="flex items-start gap-3">
    <!-- Mobile drawer trigger. Explicit h-11 w-11 (44px) rather than the
         Button component's sm size, same reasoning as "New booking" below. -->
    <button
      type="button"
      aria-label="Open menu"
      aria-expanded="false"
      class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <div class="min-w-0 flex-1">
      <h1 class="truncate font-display text-2xl font-semibold text-foreground">Today</h1>
      <p class="mt-0.5 truncate text-sm text-muted-foreground">Thursday 13 August 2026</p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <!-- Live clock — mono, per §4. Hidden below sm: least useful reading
           on the narrowest screens, where header width is scarce. -->
      <span
        class="hidden font-mono text-sm font-medium tabular-nums text-foreground sm:inline"
        aria-label="Current time"
        >14:32</span
      >

      <!-- Realtime connection state — colour + text together (§7), same
           rule as the status chip: never colour alone. -->
      <span
        class="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"
        title="Live updates connected"
      >
        <span class="h-2 w-2 rounded-full bg-status-completed" aria-hidden="true"></span>
        Live
      </span>

      <div class="ml-2 inline-flex items-center gap-2">
        <!-- Refresh: kept dense (h-9) — secondary, low-stakes, matches the
             owner-table density exception. -->
        <button
          type="button"
          class="inline-flex h-9 items-center rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Refresh
        </button>

        <!-- New booking: h-11 (44px), NOT h-9 — see the callout above this
             block. Primary variant: solid terracotta fill, white text —
             the only correct way to use --primary at this contrast, per
             DESIGN.md §7 ("primary #e05d38 on white is ~3.4:1, acceptable
             for large text/UI components, never for body copy"). -->
        <button
          type="button"
          class="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          New booking
        </button>
      </div>

      <a
        href="/dashboard/notifications"
        aria-label="Notifications"
        class="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </a>

      <!-- Theme toggle — light/dark/system, per DESIGN.md §2. -->
      <button
        type="button"
        aria-label="Toggle theme"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.25" />
          <path
            d="M12 2.5v3M12 18.5v3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M2.5 12h3M18.5 12h3M4.4 19.6l2.1-2.1M17.5 6.5l2.1-2.1"
          />
        </svg>
      </button>
    </div>
  </div>
</header>
```

**Token annotation**

| Class                                                     | DESIGN.md backing                                                                                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `border-b border-border bg-background/95 backdrop-blur`   | §3 background token; `/95` is safe (raw alpha on a `var()`-backed colour still works for background _transparency layering_ against blur — the broken case is Tailwind computing a _new_ shade like `/50`, not this) |
| `font-display text-2xl font-semibold` (title)             | §4 — same serif-headline rule as the stat tile and card headings                                                                                                                                                     |
| `font-mono ... tabular-nums` (clock)                      | §4 — JetBrains Mono for times                                                                                                                                                                                        |
| `bg-status-completed` (connection dot)                    | §3 status table, reused generically for "healthy/live" the same way `text-status-pending` was reused for "time pressure" on the stat tile                                                                            |
| `bg-primary text-primary-foreground hover:brightness-110` | §7 — white text on terracotta fill is the only WCAG-safe use of the brand hue at this size; `hover:brightness-110` instead of an opacity modifier, per §8                                                            |
| `h-11` / `h-9`                                            | §7 44×44 minimum vs. Button.tsx's documented dense-owner-table exception — see the callout above                                                                                                                     |

---

## Judgment calls made in this pass (summary)

Collected here for a fast scan; each is explained in place above.

1. **Icon library left undecided.** No icon package is installed; the
   sidebar's icon+label pattern uses hand-authored placeholder SVGs.
   Recommend `lucide-react` at implementation time.
2. **Stat-tile headline uses `font-display`, not `font-mono`**, following
   the already-shipped `TodayPage.tsx` reading of DESIGN.md's typography
   rule narrowly (times/references only), not a blanket "all numbers are
   mono" reading.
3. **"Collected today" stands in for "Expected takings"** as a forward
   reference to the approved-but-unimplemented payment-log spec — not a
   claim that this stat is live today.
4. **44×44px enforced explicitly** (`min-h-11` / `h-11 w-11`) on sidebar
   nav rows, the mobile menu trigger, and the "New booking" primary CTA,
   where the shipped code currently ships smaller (`py-2.5` rows,
   `size="sm"` buttons) without a documented reason for the specific gap on
   "New booking." `Refresh` and in-row action buttons are deliberately kept
   at the existing dense 36px, matching `Button.tsx`'s own documented
   pointer-device-table exception — this spec doesn't override a decision
   that's already reasoned through in code.
5. **This run was fully non-interactive.** The `/design-html` skill's
   `AskUserQuestion` gates, live Pretext preview server, and vision-model
   mockup comparison were all skipped; every branch point it would normally
   raise was decided unilaterally above rather than left unresolved.
