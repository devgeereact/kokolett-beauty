# Owner Console Rebuild — Tokens, Icons, App Icon & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile `docs/design/design-token.png` against the shipped token set, add an
icon system, replace the placeholder app icon/favicon with the real Kokolett mark from
`docs/design/logo.png`, and rebuild `DashboardLayout`'s navigation onto the grouped IA
supplied by the owner — the prep pass `docs/design/build-loop.md`'s per-screen rebuild
depends on.

**Architecture:** Token/shadow fixes land in `tailwind.config.ts` (two concrete value
corrections, no palette change — colours already match hex-for-hex). Icons come from a
new `lucide-react` dependency, first used in the sidebar. The app icon is cropped from
the existing `logo.png` lockup with Python/Pillow into the square PWA/favicon set already
wired in `vite.config.ts`. Navigation moves from a flat 7+2 list to seven labelled groups,
keeping the tablet breakpoint fix from `owner-console-nav-breakpoint-decision.md` and the
already-shipped Inbox tab consolidation (no route un-merge).

**Tech Stack:** React Router v6, Tailwind 3.4 (CSS-custom-property tokens), `lucide-react`
(new dependency), Python3/Pillow for one-time icon cropping (no new JS dependency),
Vitest, `tsc --noEmit`.

**Spec:** `docs/design/design-system.png`, `docs/design/design-token.png`,
`docs/design/logo.png`; supersedes the "flat, ungrouped nav" verdict in
`docs/planning/owner-console-nav-breakpoint-decision.md` (keeps that doc's `md:` tablet
breakpoint fix); extends `docs/planning/owner-console-visual-refresh-brief.md` §5.1;
user-supplied nav hierarchy (verbatim, in chat) is reproduced in full in §0 below.

## 0. New navigation hierarchy (source of truth for Task 6)

```
WORKSPACE      Dashboard · Calendar · Appointments
BOOKINGS       Approvals · Availability Requests
CUSTOMERS      Customers
SALON          Services · Availability
INSIGHTS       Reports · AI Assistant
COMMUNICATIONS Notifications · Email · Templates
ACCOUNT        Settings
```

## Global Constraints

- No raw hex value in a component — tokens only (`docs/DESIGN.md`, `CLAUDE.md`).
- TypeScript strict, explicit return types on functions and hooks.
- NativeWind/Tailwind classes only, tokens from `tailwind.config.ts`.
- British English copy.
- 44×44px touch targets, WCAG 2.2 AA, colour never carries status alone.
- One card shadow today → this plan adds exactly one more (`popover`), no third.
- Breakpoints per `design-token.png`'s BREAKPOINTS panel: mobile <768px, tablet
  768–1023px, desktop 1024–1439px, wide 1440px+ — supersedes the sidebar's current
  `lg:` (1024px) visibility gate.
- `npm run build` (`tsc --noEmit && vite build`) and `npm test` must pass after every task.

## Judgment calls made in this plan (flagged per this project's own convention)

1. **Grouped nav supersedes Variant D's "flat, no groups" verdict.** The owner's
   explicit list in §0 is newer and more specific than the earlier headless design
   review. Variant D's _other_ finding — the `lg:`→`md:` breakpoint gap that drops the
   persistent sidebar on a portrait salon tablet — is independent of flat-vs-grouped and
   is kept (Task 6).
2. **Approvals and Availability Requests are not rebuilt as separate pages.**
   `/dashboard/inbox` already owns both queues behind a `?tab=` param, with permanent
   redirects from the old separate routes (`src/App.tsx:77-84`,
   `src/pages/dashboard/InboxPage.tsx:40-41`). The two new nav rows deep-link into the
   existing tabs (`inbox?tab=approvals`, `inbox?tab=requests`). Un-merging would regress
   already-shipped, deliberate consolidation work.
3. **"Availability" (SALON) and "Availability Requests" (BOOKINGS) are two different,
   already-real things**, not a duplicate: Availability = the owner's own opening-hours
   pattern (`WeeklyDefaultPage.tsx`, `routes.owner.weeklyDefault`, reached directly).
   Availability Requests = customer enquiries submitted when nothing was open (Inbox's
   `requests` tab).
4. **Appointment type** (the salon's one service's length & price,
   `routes.owner.appointmentType`) has no line in §0. It gets no new nav row — it stays
   reachable exactly as today, via the Calendar page's own `CalendarCapacityTabs`
   switcher (Schedule / Appointment type / Weekly hours), which this plan leaves
   untouched. Calendar's `activePaths` is corrected in Task 6 to stop also claiming
   `weeklyDefault` as active, now that Availability owns that page as its own direct nav
   row (leaving both active simultaneously would double-highlight the sidebar).
5. **Icons are a genuinely new requirement**, not an invention: `design-token.png` ships
   a dedicated 24×24, 2px-stroke outline icon set, and the repo has no icon library today
   (`grep` of `package.json` confirms) — the exact gap
   `owner-console-nav-breakpoint-decision.md` flagged as a real cost for icon-based nav
   variants. `lucide-react` matches the token sheet's spec exactly (24×24, 2px stroke,
   outline default), is tree-shakeable, MIT-licensed, and is the standard Tailwind
   pairing. Used for primary nav rows only (Task 3/6); group headers stay text-only
   small-caps — structural labels, not actionable rows.
6. **`boxShadow.card`** in `tailwind.config.ts` (`0 1px 3px rgb(0 0 0 / 0.1)`, one layer)
   doesn't match `design-token.png`'s two-layer card shadow. Task 1 corrects the value —
   still one shadow for cards, just the right one. A second, distinct `popover` shadow is
   added for the token sheet's Level 2 (menus/dropdowns) — an addition beyond
   `docs/DESIGN.md`'s current "one shadow only" line, called out explicitly rather than
   silently expanding the shadow system.
7. **Colour tokens were cross-checked hex-for-hex** against `src/index.css` — light mode
   matches exactly (`--primary: #e05d38`, `--accent: #d6e4f0`, `--background: #e8ebed`,
   etc.), dark mode matches on every value legible at source resolution. **No colour
   token changes in this plan.**
8. **Email and Templates (COMMUNICATIONS) have no existing pages.** `docs/SCHEMA.md` §10
   confirms a real `email_messages` outbox table (`template`, `to_email`, `subject`,
   `payload`) already exists, so "Email" is a real, schema-backed future feature (a
   delivery log), not invented. Task 5 adds the route and a real `EmptyState`-based page
   for both — not a TODO comment, a committed page using the project's own empty-state
   primitive — so the nav never 404s. The actual outbox-log/template-list query UI is
   explicitly out of scope here: building full data-backed UI for two new features
   belongs in its own plan (fed by `docs/design/email.png` / `templetes.png` once
   written), not folded into a token/nav prep pass.
9. **`CalendarCapacityTabs` is left untouched.** It now offers a second path into
   Calendar/Appointment-type/Availability alongside their new direct nav rows. That's a
   harmless redundancy (same destinations, two doors), not a conflict — ripping out
   working in-page navigation belongs to a later cleanup pass once real usage of the new
   grouped nav is observed, not to this prep plan.
10. **Nav active-state for Approvals/Availability Requests only lights up on an explicit
    `?tab=` match.** A bare `/dashboard/inbox` (no query string) picks a default tab
    dynamically inside `InboxPage` itself (whichever queue is non-empty) — the nav can't
    predict that without duplicating the logic, so a bare-URL visit shows neither row as
    active. Flagged as a small, acceptable UX gap rather than silently guessing wrong.
11. **App icon reuses the exact lockup already shown top-left of `design-system.png`**
    (the Kokolett mark on a dark-navy card) rather than inventing a new treatment.
    Sampling that tile's background lands on `#1e2433`/`#202433` — within compression
    noise of the app's own already-shipped `--background` dark-mode token, `#1c2433`
    (`src/index.css:75`). Task 4 uses that exact existing token, not a new hex.

---

## Task 1: Fix the card shadow, add a popover shadow

**Files:**

- Modify: `tailwind.config.ts:88-90`

**Interfaces:**

- Produces: `shadow-card` (corrected value), `shadow-popover` (new) — Tailwind utility
  classes any component can use going forward.

- [ ] **Step 1: Update the `boxShadow` block**

```ts
// tailwind.config.ts — replace the existing boxShadow block:
      boxShadow: {
        card: '0 2px 8px rgb(17 24 39 / 0.06), 0 1px 2px rgb(17 24 39 / 0.04)',
        popover: '0 6px 24px rgb(17 24 39 / 0.08), 0 2px 6px rgb(17 24 39 / 0.08)',
      },
```

- [ ] **Step 2: Rebuild and confirm no visual break**

Run: `npm run dev` then open any card-bearing page (e.g. `/dashboard`) via the `/browse`
skill and confirm the card shadow still reads as a single soft shadow, just slightly
softer/more diffuse than before.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "fix(design): correct card shadow value, add popover elevation tier"
```

---

## Task 2: Document the new tokens in `docs/DESIGN.md`

**Files:**

- Modify: `docs/DESIGN.md`

- [ ] **Step 1: Add a spacing/grid/breakpoints section**

Add a new numbered section (after the existing radius section) documenting, verbatim
from `design-token.png`:

```markdown
## X. Spacing, grid, breakpoints

**Spacing** is an 8-point scale: `0 4 8 12 16 24 32 48 64 80` (px) — Tailwind's default
scale already satisfies this; no config change, documented for reference.

**Grid:** 12 columns, max width 1440px, 24px gutter.

**Layout containers:** mobile 375px, mobile-large 414px, tablet 768px, desktop 1024px,
wide 1440px.

**Breakpoints (mobile-first):** mobile 0–767px, tablet 768–1023px, desktop
1024–1439px, wide 1440px+.
```

- [ ] **Step 2: Update the elevation section**

Find the line stating "one shadow, `shadow-card`. No new shadow values proposed" and
replace with:

```markdown
**Elevation:** two shadows. `shadow-card` (`shadow-card` utility) for cards and panels;
`shadow-popover` for menus, dropdowns, and popovers — a deliberate, singular addition
beyond the card shadow, not an open-ended shadow system.
```

- [ ] **Step 3: Add an icon system section**

```markdown
## X. Icons

`lucide-react` — 24×24px grid, 2px stroke, outline style, matching
`docs/design/design-token.png`'s ICONS panel. Used for primary sidebar nav rows.
Import icons individually (`import { Calendar } from 'lucide-react'`) so unused icons
are tree-shaken; never `import * as Icons`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/DESIGN.md
git commit -m "docs(design): record spacing/grid/breakpoint tokens, popover shadow, icon system"
```

---

## Task 3: Add the icon dependency and a nav icon map

**Files:**

- Modify: `package.json` (dependency)
- Create: `src/lib/icons.ts`

**Interfaces:**

- Produces: `NAV_ICONS`, a `Record<string, LucideIcon>` keyed by nav label, consumed by
  Task 6's `DashboardLayout.tsx`.

- [ ] **Step 1: Install**

Run: `npm install lucide-react`

- [ ] **Step 2: Create the icon map**

```ts
// src/lib/icons.ts
/**
 * One place to check which Lucide icon a sidebar row uses, keyed by its exact
 * nav label (docs/planning/owner-console-rebuild-plan.md §0).
 */
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  CheckCircle2,
  CalendarClock,
  Users,
  Scissors,
  Clock,
  BarChart3,
  Sparkles,
  Bell,
  Mail,
  FileText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Calendar,
  Appointments: ClipboardList,
  Approvals: CheckCircle2,
  'Availability Requests': CalendarClock,
  Customers: Users,
  Services: Scissors,
  Availability: Clock,
  Reports: BarChart3,
  'AI Assistant': Sparkles,
  Notifications: Bell,
  Email: Mail,
  Templates: FileText,
  Settings,
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: no TypeScript errors (unused-import check will fail if any icon name above is
wrong — that's the signal the import list is correct).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/icons.ts
git commit -m "feat(design): add lucide-react and a labelled nav icon map"
```

---

## Task 4: Regenerate the app icon set from `docs/design/logo.png`

**Files:**

- Create/overwrite: `public/icons/pwa-512.png`, `public/icons/pwa-192.png`,
  `public/icons/pwa-maskable-512.png`, `public/icons/favicon-32.png`
- Delete: `public/favicon.svg` (generic scaffold placeholder — near-black background,
  unrelated green/indigo mark, confirmed unrelated to the Kokolett brand)
- Modify: `index.html:5` (favicon link), `vite.config.ts:49` (`includeAssets`)

**Interfaces:**

- Produces: the four PNGs above, already wired into `vite.config.ts`'s existing
  `VitePWA` manifest (`icons: [...]`, lines 61-68) and `index.html`'s
  `apple-touch-icon` link (line 13) — neither needs further changes, both already
  point at `icons/pwa-192.png` / `icons/pwa-512.png` / `icons/pwa-maskable-512.png`.

- [ ] **Step 1: Generate the icon set**

The mark (hair silhouette + face, excluding the "Kokolett Beauty UK" wordmark) sits at
pixel bounds `(45, 30, 787, 698)` inside `docs/design/logo.png` (2172×724px,
verified by scanning the alpha channel for the transparent gap before the wordmark
starts at column 787). The background colour is the app's own existing dark-mode
`--background` token, `#1c2433` (`src/index.css:75`) — the same navy already used behind
the "Kokolett" lockup shown top-left in `docs/design/design-system.png`.

```python
# scripts/generate-icons.py — run once, then delete or leave for future re-runs
from PIL import Image

SRC = "docs/design/logo.png"
BG = (28, 36, 51, 255)  # #1c2433
MARK_BOX = (45, 30, 787, 698)

def build_icon(size: int, mark_fraction: float, out_path: str) -> None:
    canvas = Image.new("RGBA", (size, size), BG)
    mark = Image.open(SRC).convert("RGBA").crop(MARK_BOX)
    mark_w = int(size * mark_fraction)
    mark_h = int(mark_w * mark.height / mark.width)
    mark = mark.resize((mark_w, mark_h), Image.LANCZOS)
    canvas.paste(mark, ((size - mark_w) // 2, (size - mark_h) // 2), mark)
    canvas.convert("RGB").save(out_path)

build_icon(512, 0.78, "public/icons/pwa-512.png")       # standard, ~11% margin
build_icon(192, 0.78, "public/icons/pwa-192.png")       # standard + apple-touch-icon
build_icon(512, 0.60, "public/icons/pwa-maskable-512.png")  # maskable safe zone, ~20% margin
build_icon(32, 0.82, "public/icons/favicon-32.png")     # favicon, simpler at small size
```

Run: `python3 scripts/generate-icons.py`

- [ ] **Step 2: Verify each output**

Read back all four PNGs (e.g. via the Read tool or Preview) and confirm: square canvas,
navy background fills edge-to-edge with no transparency (required for `purpose:
maskable` and for `apple-touch-icon`, which iOS renders with its own rounding and will
show any transparent corner as black), mark centred, no visible clipping of the hair
silhouette's outer strands within the maskable variant's safe zone.

- [ ] **Step 3: Rewire the favicon**

```html
<!-- index.html:5 — replace -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<!-- with -->
<link rel="icon" type="image/png" href="/icons/favicon-32.png" />
```

```ts
// vite.config.ts:49 — replace
includeAssets: ['favicon.svg', 'offline.html', 'icons/*.png'],
// with
includeAssets: ['offline.html', 'icons/*.png'],
```

- [ ] **Step 4: Remove the stale placeholder**

```bash
rm public/favicon.svg
```

- [ ] **Step 5: Build and visually confirm**

Run: `npm run build && npm run dev`, then use the `/browse` skill to load `/` and check
the browser tab icon, and load `/dashboard` on a simulated mobile viewport to sanity
check `apple-touch-icon` isn't broken (no direct way to preview apple-touch-icon in a
desktop browser tab — confirm via `curl -I http://localhost:5082/icons/pwa-192.png`
returning `200` and `Content-Type: image/png` as the practical check).

- [ ] **Step 6: Commit**

```bash
git add public/icons index.html vite.config.ts scripts/generate-icons.py
git rm public/favicon.svg
git commit -m "feat(design): replace placeholder app icon/favicon with the Kokolett mark"
```

---

## Task 5: Add Email and Templates routes and stub pages

**Files:**

- Modify: `src/lib/routes.ts:53-58` (owner route block)
- Create: `src/pages/dashboard/EmailPage.tsx`
- Create: `src/pages/dashboard/TemplatesPage.tsx`
- Modify: `src/App.tsx` (register both routes, mirroring the existing `owner(<X />)`
  pattern at e.g. `src/App.tsx:108-111`)

**Interfaces:**

- Consumes: `DashboardLayout` (`title`, `subtitle` props), `EmptyState`
  (`src/components/ui/States.tsx:34-42`, props `title`, `description`, `action`).
- Produces: `routes.owner.email` (`/dashboard/email`), `routes.owner.templates`
  (`/dashboard/templates`) — consumed by Task 6's nav entries.

- [ ] **Step 1: Add the two routes**

```ts
// src/lib/routes.ts — inside the `owner` object, after `notifications:`
    notifications: '/dashboard/notifications',
    /** Delivery log for the email_messages outbox (docs/SCHEMA.md §10). */
    email: '/dashboard/email',
    /** Named transactional email templates referenced by email_messages.template. */
    templates: '/dashboard/templates',
    profile: '/dashboard/profile',
```

- [ ] **Step 2: Create the Email stub page**

```tsx
// src/pages/dashboard/EmailPage.tsx
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { EmptyState } from '@/components/ui/States';

export function EmailPage(): JSX.Element {
  return (
    <DashboardLayout title="Email" subtitle="Every message the salon has sent">
      <EmptyState
        title="Email log is coming soon"
        description="This will list every booking confirmation, reminder, and owner notification sent from the outbox, with delivery status."
      />
    </DashboardLayout>
  );
}
```

- [ ] **Step 3: Create the Templates stub page**

```tsx
// src/pages/dashboard/TemplatesPage.tsx
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { EmptyState } from '@/components/ui/States';

export function TemplatesPage(): JSX.Element {
  return (
    <DashboardLayout
      title="Templates"
      subtitle="The wording behind every automated email"
    >
      <EmptyState
        title="Template previews are coming soon"
        description="This will show the fixed set of transactional email templates the outbox sends from, read-only."
      />
    </DashboardLayout>
  );
}
```

- [ ] **Step 4: Register both routes**

```tsx
// src/App.tsx — add alongside the existing owner routes (e.g. after notifications, ~line 111)
              <Route path={routes.owner.email} element={owner(<EmailPage />)} />
              <Route path={routes.owner.templates} element={owner(<TemplatesPage />)} />
```

Add the two imports at the top of `src/App.tsx` alongside the other dashboard page
imports.

- [ ] **Step 5: Typecheck and test**

Run: `npm run build && npm test`
Expected: PASS, no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routes.ts src/pages/dashboard/EmailPage.tsx src/pages/dashboard/TemplatesPage.tsx src/App.tsx
git commit -m "feat(dashboard): add Email and Templates routes with empty-state stub pages"
```

---

## Task 6: Rebuild `DashboardLayout.tsx` onto the grouped nav

**Files:**

- Modify: `src/components/dashboard/DashboardLayout.tsx` (full nav section,
  `:11-130`)
- Modify: `src/pages/dashboard/TodayPage.tsx:177-182` (`badges` prop)
- Modify: `src/pages/dashboard/InboxPage.tsx:185` (`badges` prop)

**Interfaces:**

- Consumes: `NAV_ICONS` from `src/lib/icons.ts` (Task 3), `routes.owner.email` /
  `routes.owner.templates` (Task 5).
- Produces: `DashboardLayout`'s `badges` prop changes shape from `{ inbox?: number }` to
  `{ approvals?: number; requests?: number }` — both call sites updated in this task.

- [ ] **Step 1: Replace the `NavEntry` model and `isEntryActive` with a grouped, tab-aware version**

```tsx
// src/components/dashboard/DashboardLayout.tsx — replace lines 11-30
import type { LucideIcon } from 'lucide-react';
import { NAV_ICONS } from '@/lib/icons';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rendered as a count beside the label; omitted when zero. */
  badge?: number;
  /**
   * Extra paths that also count as "active" for this entry, for a single nav
   * item that fronts more than one route — Calendar also owns Appointment
   * type (`CalendarCapacityTabs`'s in-page switcher). Availability
   * (`weeklyDefault`) is deliberately NOT included here even though it's
   * also reachable from that switcher — it has its own direct nav row under
   * Salon, and including it here would double-highlight the sidebar.
   */
  activePaths?: string[];
  /**
   * For entries that deep-link into Inbox's `?tab=` param (Approvals,
   * Availability Requests) rather than owning a distinct route.
   */
  matchTab?: 'approvals' | 'requests';
}

interface NavGroup {
  label: string;
  items: NavEntry[];
}

/** Mirrors `NavLink`'s own non-`end` matching: exact, or a path segment below. */
function isEntryActive(entry: NavEntry, pathname: string, search: string): boolean {
  if (entry.matchTab) {
    return (
      pathname === routes.owner.inbox &&
      new URLSearchParams(search).get('tab') === entry.matchTab
    );
  }
  if (entry.activePaths) return entry.activePaths.includes(pathname);
  if (entry.to === routes.owner.dashboard) return pathname === entry.to;
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`);
}
```

- [ ] **Step 2: Replace the `badges` prop type and the flat `entries`/`secondaryEntries` with `navGroups`**

```tsx
// src/components/dashboard/DashboardLayout.tsx — replace the component's props type
// (badges?: { inbox?: number }) and the `entries`/`secondaryEntries` block (old lines
// 44-81) with:
  badges,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badges?: { approvals?: number; requests?: number };
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useSupabaseAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Grouped Owner Console nav (docs/planning/owner-console-rebuild-plan.md §0).
  const navGroups: NavGroup[] = [
    {
      label: 'Workspace',
      items: [
        { to: routes.owner.dashboard, label: 'Dashboard', icon: NAV_ICONS.Dashboard },
        {
          to: routes.owner.calendar,
          label: 'Calendar',
          icon: NAV_ICONS.Calendar,
          activePaths: [routes.owner.calendar, routes.owner.appointmentType],
        },
        { to: routes.owner.appointments, label: 'Appointments', icon: NAV_ICONS.Appointments },
      ],
    },
    {
      label: 'Bookings',
      items: [
        {
          to: `${routes.owner.inbox}?tab=approvals`,
          label: 'Approvals',
          icon: NAV_ICONS.Approvals,
          matchTab: 'approvals',
          badge: badges?.approvals,
        },
        {
          to: `${routes.owner.inbox}?tab=requests`,
          label: 'Availability Requests',
          icon: NAV_ICONS['Availability Requests'],
          matchTab: 'requests',
          badge: badges?.requests,
        },
      ],
    },
    {
      label: 'Customers',
      items: [{ to: routes.owner.customers, label: 'Customers', icon: NAV_ICONS.Customers }],
    },
    {
      label: 'Salon',
      items: [
        { to: routes.owner.serviceMenu, label: 'Services', icon: NAV_ICONS.Services },
        { to: routes.owner.weeklyDefault, label: 'Availability', icon: NAV_ICONS.Availability },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: routes.owner.reports, label: 'Reports', icon: NAV_ICONS.Reports },
        { to: routes.owner.assistant, label: 'AI Assistant', icon: NAV_ICONS['AI Assistant'] },
      ],
    },
    {
      label: 'Communications',
      items: [
        { to: routes.owner.notifications, label: 'Notifications', icon: NAV_ICONS.Notifications },
        { to: routes.owner.email, label: 'Email', icon: NAV_ICONS.Email },
        { to: routes.owner.templates, label: 'Templates', icon: NAV_ICONS.Templates },
      ],
    },
    {
      label: 'Account',
      items: [{ to: routes.owner.settings, label: 'Settings', icon: NAV_ICONS.Settings }],
    },
  ];
```

- [ ] **Step 3: Replace `renderEntry` and the `nav` block to render groups with icons**

```tsx
// src/components/dashboard/DashboardLayout.tsx — replace the old renderEntry (lines
// 83-122) and `nav` const (lines 124-130) with:
const renderEntry = (entry: NavEntry): JSX.Element => {
  const active = isEntryActive(entry, location.pathname, location.search);
  const Icon = entry.icon;
  return (
    // Plain `Link`, not `NavLink`: see the original rationale this replaces —
    // NavLink's own prefix matching can't express activePaths/matchTab grouping.
    <Link
      key={entry.to}
      to={entry.to}
      onClick={() => setMenuOpen(false)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2} />
      <span className="flex-1 truncate">{entry.label}</span>
      {entry.badge ? (
        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
          {entry.badge}
        </span>
      ) : null}
    </Link>
  );
};

const nav = (
  <nav className="flex flex-col gap-4" aria-label="Dashboard">
    {navGroups.map((group) => (
      <div key={group.label}>
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
          {group.label}
        </p>
        <div className="flex flex-col gap-1">{group.items.map(renderEntry)}</div>
      </div>
    ))}
  </nav>
);
```

- [ ] **Step 4: Move the breakpoint from `lg:` to `md:`**

```tsx
// src/components/dashboard/DashboardLayout.tsx — in the return block:
// - <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
// + <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">

// - <div className="fixed inset-0 z-40 lg:hidden">   (mobile slide-over wrapper)
// + <div className="fixed inset-0 z-40 md:hidden">

// - <Button variant="ghost" size="sm" className="lg:hidden" ...>Menu</Button>
// + <Button variant="ghost" size="sm" className="md:hidden" ...>Menu</Button>

// - <div className="lg:pl-60">
// + <div className="md:pl-60">
```

Grouped headers make each group taller than the old flat list; keep row padding
(`py-2.5`) unchanged — `design-token.png`'s spacing scale doesn't ask for a denser row,
and the groups themselves already add the visual rhythm the old single divider gave.

- [ ] **Step 5: Update the two `badges` call sites**

```tsx
// src/pages/dashboard/TodayPage.tsx:177-182 — replace
      badges={{
        inbox: (summary?.pending_approval_count ?? 0) + (summary?.new_request_count ?? 0),
      }}
// with
      badges={{
        approvals: summary?.pending_approval_count ?? 0,
        requests: summary?.new_request_count ?? 0,
      }}
```

```tsx
// src/pages/dashboard/InboxPage.tsx:185 — replace
      badges={{ inbox: effectiveApprovalsCount + effectiveRequestsCount }}
// with
      badges={{ approvals: effectiveApprovalsCount, requests: effectiveRequestsCount }}
```

- [ ] **Step 6: Typecheck, test, and manually verify in the browser**

Run: `npm run build && npm test`
Expected: PASS.

Then start the dev server and use the `/browse` skill to:

1. Load `/dashboard` — confirm seven labelled groups render, Dashboard row is active.
2. Click into Calendar, then Appointment type (via `CalendarCapacityTabs`) — confirm
   only the Calendar row highlights, never two rows at once.
3. Navigate to `/dashboard/inbox?tab=approvals` directly — confirm only the Approvals
   row is active; switch to `?tab=requests` — confirm only Availability Requests is
   active.
4. Resize to a 768–1023px (tablet/portrait-iPad) viewport — confirm the persistent
   sidebar is still visible (this is the breakpoint fix from Task 6 Step 4; below 768px
   it should switch to the "Menu" slide-over).
5. Toggle dark mode — confirm sidebar icons and group-header text remain legible against
   `--sidebar` dark tokens (no new colour was introduced, so this should already pass).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/DashboardLayout.tsx src/pages/dashboard/TodayPage.tsx src/pages/dashboard/InboxPage.tsx
git commit -m "feat(dashboard): rebuild sidebar nav onto the grouped Owner Console IA"
```

---

## Handoff to the per-screen rebuild

Once this plan ships, `docs/design/build-loop.md`'s screen list should be re-read against
the new routes this plan adds (`routes.owner.email`, `routes.owner.templates`) and the
corrected `activePaths` — its row mapping for "Availability" and "Appointment" predates
this plan's IA split and may need a one-line update, not a rewrite. That's the next
prompt to run, not part of this plan.
