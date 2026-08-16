# Design System — Kokolett Beauty UK

| | |
|---|---|
| **Version** | 1.0.0 |
| **Status** | Stable |
| **Owner** | *[name — a system without an owner drifts]* |
| **Applies to** | `src/index.css`, `tailwind.config.ts`, `src/components/ui/*` |
| **Last reviewed** | *[date]* |

Values live in `src/index.css` as CSS custom properties. `tailwind.config.ts` maps them to
utilities and nothing else. **A component never contains a raw colour, radius, shadow or
z-index value** — and as of 1.0.0 that is enforced by the config rather than requested by
this document (§11).

Sections marked **RULE** are normative and blocking at review. Everything else is rationale.

---

## 1. Direction

Warm, calm, unfussy. A terracotta accent against cool neutral greys — the warmth carries the
salon's personality, the greys keep the owner's dashboard legible during a twelve-hour day.
Content sits on white cards floating just above a soft grey ground.

The marketing site leans editorial: generous whitespace, serif headings, large photography.
The dashboard leans utilitarian: dense, scannable, sans throughout. Same tokens, different
rhythm.

---

## 2. Token architecture

### 2.1 Storage format

Colour tokens are stored as **space-separated sRGB channels**, not hex:

```css
--primary: 194 77 44;   /* not #c24d2c */
```

The config wraps them as `rgb(var(--primary) / <alpha-value>)`, which restores Tailwind's
opacity modifiers — `bg-primary/50`, `border-foreground/10` and `bg-overlay/40` all work.
Storing hex is what previously forced ad-hoc `color-mix()` in component CSS for every
translucent fill.

**RULE** — When adding a colour token, add the channel triplet with the hex in a trailing
comment. Never add a hex-valued colour custom property.

### 2.2 Naming

`--{role}` and `--{role}-foreground` for anything that carries text on top of itself.
`--status-*` for text/icon colours. `--tint-*` for the derived pale backgrounds.
Role names describe *purpose*, never appearance: there is no `--orange` or `--grey-100`.

### 2.3 Fills and text are different jobs

This is the rule that most of §3 exists to serve.

| | Contrast requirement | Tokens |
|---|---|---|
| **Fill** carrying a label | 3:1 vs adjacent surface; its `-foreground` ≥ 4.5:1 on it | `primary`, `secondary`, `destructive`, `accent` |
| **Text / icon** on a light surface | ≥ 4.5:1 against its own background | `foreground`, `muted-foreground`, `status-*` |
| **Identity** | ≥ 3:1 only (large text and non-text UI) | `brand`, `ring` |

**RULE** — Never use a `status-*` token as a background. Never use `brand` behind text
smaller than 24px. Never use `primary` as body text on a light surface.

---

## 3. Colour

### 3.1 Light

| Token | Hex | Use |
|---|---|---|
| `background` | `#e8ebed` | Page ground |
| `foreground` | `#333333` | Body text — 10.6:1 |
| `card` / `-foreground` | `#ffffff` / `#333333` | Cards, panels, sheets |
| `popover` / `-foreground` | `#ffffff` / `#333333` | Menus, dialogs |
| `brand` | `#e05d38` | Identity: display ≥24px, marketing, focus ring |
| `primary` / `-foreground` | `#c24d2c` / `#ffffff` | Primary action — 4.78:1 |
| `secondary` / `-foreground` | `#f3f4f6` / `#4b5563` | Secondary action — 6.9:1 |
| `muted` / `-foreground` | `#f1f3f5` / `#5b6370` | Recessed surfaces, hint text — 5.45:1 |
| `accent` / `-foreground` | `#f6e6e0` / `#8a3a1f` | Selection, menu hover — 6.4:1 |
| `destructive` / `-foreground` | `#dc2626` / `#ffffff` | Cancel, delete — 4.83:1 |
| `border` | `#dcdfe2` | Hairlines |
| `input` | `#f4f5f7` | Field fill |
| `ring` | `#e05d38` | Focus ring — 3.63:1 (non-text, passes 1.4.11) |

### 3.2 Dark

| Token | Hex |
|---|---|
| `background` | `#1c2433` |
| `foreground` | `#e5e5e5` |
| `card` / `-foreground` | `#2a3040` / `#e5e5e5` |
| `popover` / `-foreground` | `#262b38` / `#e5e5e5` |
| `brand` | `#e05d38` |
| `primary` / `-foreground` | `#f0805e` / `#1a1f2b` |
| `secondary` / `-foreground` | `#2a303e` / `#e5e5e5` |
| `muted` / `-foreground` | `#232936` / `#a3a3a3` |
| `accent` / `-foreground` | `#3b2a23` / `#f6cbb8` |
| `destructive` / `-foreground` | `#f87171` / `#1a1f2b` |
| `border` / `input` | `#3d4354` |
| `ring` | `#e05d38` |

**RULE** — In dark mode, saturated fills go *lighter* and take a *dark* foreground. This is
not a stylistic preference: a terracotta dark enough to hold white text at 4.5:1 falls below
3:1 against `card`, so white-on-orange cannot pass AA on a dark ground. `primary-foreground`
is `#1a1f2b` in dark for that reason.

Note `muted` sits *below* `card` in dark and *below* `card` but *above* `background` in
light, so the `subtle` Card variant reads as recessed in both themes.

### 3.3 Appointment status

Text and icon colours. Every value clears 4.5:1 on both `card` and its own tint, in both
themes, because these appear at 12–14px inside pills.

| Status | Light | Dark |
|---|---|---|
| `pending` | `#b45309` | `#f59e0b` |
| `confirmed` | `#2563eb` | `#60a5fa` |
| `in-service` | `#7c3aed` | `#a78bfa` |
| `completed` | `#047857` | `#34d399` |
| `cancelled` | `#6b7280` | `#9ca3af` |
| `no-show` | `#dc2626` | `#f87171` |

The `AppointmentStatus` enum has seven members and the palette has six. The mapping is
explicit, not conventional — see the `TONE_BY_STATUS` map in §9.1.

**RULE** — Colour never carries status alone. Every chip, pill and calendar block also
carries a text label. Roughly 1 in 12 men has a colour vision deficiency, and the owner's
calendar is the one screen where a misread costs money.

**RULE** — Blue belongs to `confirmed`. `accent` is warm precisely so that a selected time
slot and a confirmed appointment can never be confused on the calendar.

### 3.4 Tints

Every status colour has a pale-background counterpart: `tint-pending`, `tint-confirmed`,
`tint-in-service`, `tint-completed`, `tint-cancelled`, `tint-no-show`, plus `tint-brand` and
`tint-chart-1..5`. Each is:

```css
color-mix(in srgb, rgb(var(--status-x)) var(--tint-mix), rgb(var(--card)))
```

`--tint-mix` is **12% in light, 18% in dark** — one number, so tints are reproducible rather
than hand-picked, and a palette change propagates automatically.

Tints are the background half of the "pale tint + saturated text" pairing used wherever a
small element must read as coloured without shouting: status pills, badges, stat tile icons,
countdown chips.

**Tint vs alpha** — use `bg-tint-*` for opaque chips, because the result is predictable over
any parent surface. Use `bg-status-*/12` only for hover and scrim effects where the parent
is known to be `card`.

### 3.5 Charts

`chart-1 #86a7c8` · `chart-2 #eea591` · `chart-3 #5a7ca6` · `chart-4 #466494` ·
`chart-5 #334c82`. Dark `chart-2` lifts to `#e6a08f`.

**RULE** — Reports consume these in declared order. No ad-hoc chart colours. Series must
also be distinguishable without colour (label, pattern or direct annotation).

### 3.6 Sidebar

The owner dashboard shell has its own ramp so it reads as chrome rather than content:
`sidebar` `#dddfe2` (light) / `#2a303f` (dark), with matching `-foreground`, `-primary`,
`-accent`, `-border` and `-ring`.

---

## 4. Typography

| Role | Family | Weights |
|---|---|---|
| UI, body | Inter | 400 / 500 / 600 |
| Display, marketing headings | Source Serif 4 | 400 / 600, optical sizing 8–60 |
| Numerals, references, times | JetBrains Mono | 400 |

Loaded from Google Fonts in `index.html` with `preconnect` and `display=swap`, cached by the
service worker (StaleWhileRevalidate).

Scale — line-height is baked into each step in `tailwind.config.ts`, so §4 is enforced rather
than remembered:

| Class | Size | Line-height |
|---|---|---|
| `text-xs` | 12px | 16px |
| `text-sm` | 14px | 20px |
| `text-base` | 16px | 1.6 |
| `text-lg` | 18px | 1.6 |
| `text-xl` | 20px | 1.3 |
| `text-2xl` | 24px | 1.2 |
| `text-3xl` | 30px | 1.2 |
| `text-4xl` | 36px | 1.2 |

**RULE** — Nothing a customer must read to complete a booking may be below 14px.
`text-xs` is for dashboard metadata only. There is no step above `text-4xl`.

`font-display` was an alias for `font-serif`; it has been removed. Use `font-serif`.

---

## 5. Layout

### 5.1 Spacing

Tailwind's default 4px scale, unmodified: `4 8 12 16 20 24 32 40 48 64 80 96`.
There is one scale and this is it. *(1.0.0 removed a conflicting "8-point scale" that
appeared in a second section and disagreed with this one.)*

- Marketing section rhythm: `py-16` mobile, `py-24` desktop.
- Dashboard density: `p-4` cards, `gap-3` lists.
- Every primary scroll region carries `.scroll-bottom-gap` (24px, 32px ≥1024px) so the last
  row never sits flush to the viewport edge. Applied once at `DashboardLayout`'s `<main>`.

### 5.2 Grid

12 columns, 1440px max width, 24px gutter — available as `.layout-grid`, so nobody
re-derives the wrapper. `max-w-content` is the same 1440px cap for non-grid containers.

### 5.3 Breakpoints

Mobile-first, four ranges, three breakpoints:

| Name | Range | Class |
|---|---|---|
| mobile | 0–767px | *(base)* |
| tablet | 768–1023px | `md:` |
| desktop | 1024–1439px | `lg:` |
| wide | 1440px+ | `wide:` |

**RULE** — `sm:`, `xl:` and `2xl:` no longer resolve. If a layout needs a range this table
doesn't define, that's a design conversation, not a config edit.

Reference device widths (not breakpoints): 375, 414, 768, 1024, 1440.

---

## 6. Shape, elevation, stacking

### 6.1 Radius

Four visible steps: `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 12px`,
`--radius-xl 16px`. `rounded` with no suffix resolves to `md`. `rounded-2xl` collapses onto
`xl`; `rounded-3xl` no longer resolves. `rounded-full` is the plain 9999px pill.

*(1.0.0 dropped `--radius-xs: 1px` — it was indistinguishable from square and a holdover
from the earlier flat treatment.)*

- Cards, modals, popovers → `rounded-xl`
- Buttons and most controls → `rounded-md` / `rounded-lg`
- Badge, StatusPill, StatusChip → `rounded-full`

### 6.2 Elevation

Three tiers, chosen by how far a surface floats above the page:

| Token | Value | Used by |
|---|---|---|
| `shadow-card` | `0 1px 3px` | Default Card — normal document flow |
| `shadow-popover` | `0 4px 10px` | Dropdowns, row/tab menus, notification popover, DatePicker, toasts, PWA banners |
| `shadow-modal` | `0 10px 30px` | Modal, ConfirmDialog, QuickActionLauncher — anything blocking the page |

Shadow alpha is tokenised per theme (`--shadow-a1..a3`) and rises sharply in dark mode,
because 10% black is effectively invisible on `#1c2433`.

Card variants: `default` (bordered + `shadow-card`), `subtle` (flat `bg-muted`, no shadow,
for a nested region), `accent` (flat `bg-tint-brand`, for a highlighted callout).

### 6.3 Stacking

One scale. Arbitrary z-index values and Tailwind's `z-10`/`z-50` no longer resolve.

`z-base 0` · `z-sticky 20` (page/table headers) · `z-dropdown 40` (menus, DatePicker) ·
`z-sidebar 50` · `z-overlay 60` · `z-drawer 70` (mobile nav) · `z-modal 80` (Modal,
QuickActionLauncher) · `z-layer-popover 90` (ConfirmDialog, which must paint above the Modal
that opened it; NotificationBellPopover) · `z-toast 100`.

*Naming note:* the stacking token is `z-layer-popover`, not `z-popover`, because
`shadow-popover` means "dropdown-height surface" while this layer means "above a modal".
Two different concepts should not share a name.

All overlay backdrops use `.overlay-backdrop`, driven by `--overlay` and `--overlay-alpha`,
rather than each surface picking its own darkness.

---

## 7. Motion

Restrained. Named durations: `duration-fast` 150ms, `duration` 200ms, `duration-slow` 300ms.
Default easing is `ease-out` (`cubic-bezier(0, 0, 0.2, 1)`) and is the config default, so
`transition` alone is already correct.

- `animate-fade-up` for content entering on scroll.
- Opacity-only transitions for state changes.
- Slot selection and calendar drag get immediate feedback with no easing delay — perceived
  responsiveness beats polish there.

**RULE** — `prefers-reduced-motion: reduce` collapses all animation globally in `index.css`.
That rule is not optional and must not be overridden per component.

---

## 8. Icons

`lucide-react` — 24×24 grid, 2px stroke, outline. Used for primary sidebar nav rows
(`src/lib/icons.ts`).

**RULE** — Import icons individually (`import { Calendar } from 'lucide-react'`) so unused
icons are tree-shaken. Never `import * as Icons`.

---

## 9. Shared components

### 9.1 Tone

`Tone` is the single mapping from a semantic state to its tint/text pair. One map means a
token rename or a new tone changes in one place.

`src/lib/tone.ts`:

```ts
export type Tone =
  | 'pending'
  | 'confirmed'
  | 'in-service'
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | 'brand'
  | 'neutral';

/**
 * Class strings MUST be complete literals. Tailwind's extractor is static —
 * `bg-tint-${tone}` compiles in dev and silently produces no CSS in prod.
 */
export const TONE_CLASSES: Record<Tone, string> = {
  pending:      'bg-tint-pending text-status-pending',
  confirmed:    'bg-tint-confirmed text-status-confirmed',
  'in-service': 'bg-tint-in-service text-status-in-service',
  completed:    'bg-tint-completed text-status-completed',
  cancelled:    'bg-tint-cancelled text-status-cancelled',
  'no-show':    'bg-tint-no-show text-status-no-show',
  brand:        'bg-tint-brand text-primary',
  neutral:      'bg-muted text-muted-foreground',
};

/** Seven enum members, six palettes. The collapse is explicit, not implied. */
export const TONE_BY_STATUS: Record<AppointmentStatus, Tone> = {
  pending_approval: 'pending',
  confirmed:        'confirmed',
  in_service:       'in-service',
  completed:        'completed',
  cancelled:        'cancelled',
  rejected:         'cancelled', // shares cancelled's palette; label distinguishes
  no_show:          'no-show',
};
```

**RULE** — Never write `bg-tint-* text-status-*` inline in a screen. Go through `Tone`.
*(1.0.0 fixed a `Tone` union that omitted `in-service` and `no-show`, forcing the calendar —
the highest-stakes screen — to bypass this map.)*

### 9.2 Components

| Component | Purpose |
|---|---|
| `StatTile` | Dashboard headline number: tinted icon square, bold value, muted label. Any "N pending / N this week" stat row. |
| `Badge` | Short tinted pill for a fact about a row that is *not* its `AppointmentStatus` — "First-time customer", "Needs approval · 11h 24m remaining". |
| `StatusPill` / `StatusChip` | Keyed by the `AppointmentStatus` enum via `TONE_BY_STATUS`. The only components allowed to render status colour. |
| `CountdownChip` | Boxed two-line deadline (`formatCountdown` value / "remaining") for a list row. |

Default tone is `neutral`. Not every tile needs to be orange.

---

## 10. Accessibility — WCAG 2.2 AA

- **1.4.3 Contrast** — body ≥ 4.5:1, large text ≥ 3:1. Every pairing in §3 is measured, not
  assumed. Button labels count as normal text; this is why `primary` is `#c24d2c` and not
  the brand terracotta.
- **1.4.11 Non-text contrast** — the focus ring, field borders and chart series all clear
  3:1 against their neighbours.
- **1.4.1 Use of colour** — status always carries a label (§3.3).
- **2.4.7 / 2.4.11 Focus visible and not obscured** — the `:focus-visible` ring is defined
  once in `index.css` and must not be removed. `scroll-padding-top` clears the sticky header
  so a tabbed-to element never lands underneath it.
- **2.5.8 Target size** — minimum 24×24 by the standard; this system uses **44×44**
  (`min-h-touch` / `min-w-touch`), which sets the minimum size of a time-slot button.
- **2.1.1 Keyboard** — the booking flow is fully keyboard-operable, including the date grid
  (arrow keys) and slot list.
- **3.3.1 / 3.3.2 Errors and labels** — every field has a real `<label>`; errors are
  announced via `aria-live` and linked with `aria-describedby`, never signalled by red
  border alone.
- **3.3.7 Redundant entry** — a returning customer's details are pre-filled, not re-asked.
- **1.3.1 Structure** — the calendar is a `<table>` with proper headers, plus an agenda list
  as the accessible alternative to drag-and-drop.

---

## 11. Enforcement

What the config now guarantees rather than requests:

| Rule | Mechanism |
|---|---|
| No raw colours | `theme.colors` replaces the default palette. `bg-red-500`, `text-white` produce nothing. |
| No arbitrary z-index | `theme.zIndex` replaces defaults. `z-50` produces nothing. |
| Three shadow tiers | `theme.boxShadow` replaces defaults. `shadow-lg` produces nothing. |
| Radius scale is closed | `theme.borderRadius` replaces defaults. `rounded-3xl` produces nothing. |
| Type scale carries line-height | `theme.fontSize` replaces defaults. |
| Only four layout ranges | `theme.screens` replaces defaults. |

**Still not machine-enforced** — arbitrary values (`bg-[#ff0000]`, `z-[999]`). Add
`eslint-plugin-tailwindcss` with `no-arbitrary-value` to close this. Until then it is a
review item.

**Review checklist for any UI PR**

1. No hex, rgb or arbitrary bracket values in a component.
2. Status colour goes through `Tone`, never inline.
3. New interactive fill: measured against its foreground *and* its neighbour, both themes.
4. `:focus-visible` intact; nothing overrides reduced motion.
5. Any new token added to `index.css` **and** documented here in the same PR.

**Changing a token** — open a PR touching `index.css`, `tailwind.config.ts` and this file
together, with the measured contrast ratio in the description. Adding a token is a minor
version; changing or removing one is a major.

---

## 12. Known issues and roadmap

- **Tailwind 3.4 pin.** The supplied palette used Tailwind v4 `@theme inline`. This project
  is pinned to 3.4, so tokens are custom properties referenced from the config; names and
  intent are unchanged. *Migration trigger: when the app's other v4 blockers clear.
  Owner: [name]. Until then, do not use v4-only syntax.*
- **`color-mix()` support.** Tints require Chrome 111+ / Safari 16.2+ / Firefox 113+. Below
  that, tinted backgrounds fall back to transparent — the saturated text still renders
  legibly on `card`, so this degrades safely, but it is a known limit.
- **Removed breakpoints.** `sm:`, `xl:` and `2xl:` must be swept from existing markup.
- **Removed `text-white` / `text-black`.** Replace with `text-primary-foreground` etc.
- **No NativeWind path.** The previous config claimed the tree could be ported to Expo.
  `color-mix()`, `box-shadow`, `:focus-visible`, `prefers-reduced-motion` and the custom
  utilities are all web-only. If Expo becomes real, it needs its own token bridge — not a
  comment promising portability the code can't deliver.
- **PNG as spec.** `docs/design/new-design-guideline.png` is no longer normative. It can't be
  diffed or reviewed. Anything it defines that matters now lives in this file.

---

## 13. Changelog

### 1.0.0

**Contrast fixes (blocking AA failures).**

| Token | Was | Now | Reason |
|---|---|---|---|
| `primary` (light) | `#e05d38` | `#c24d2c` | White label was 3.63:1, not 4.5:1. `#e05d38` retained as `brand`. |
| `primary` (dark) | `#e05d38` / white fg | `#f0805e` / `#1a1f2b` | White-on-orange cannot pass AA on a dark ground at any lightness. |
| `destructive` (light) | `#ef4444` | `#dc2626` | White label was 3.76:1. |
| `destructive` (dark) | `#ef4444` / white fg | `#f87171` / `#1a1f2b` | Same reason as `primary`. |
| `status-pending` (light) | `#d97706` | `#b45309` | 3.18:1 as pill text. |
| `status-completed` (light) | `#059669` | `#047857` | 3.77:1 as pill text. |
| `muted-foreground` (light) | `#6b7280` | `#5b6370` | 4.35:1 on the new `muted`. |

**Structural fixes.**

- `muted` (light) `#f9fafb` → `#f1f3f5`: the old value was a 1.6% step off `card` (invisible)
  and *lighter* than `background`, so `Card variant="subtle"` read as raised.
- `muted` (dark) `#2a303e` → `#232936`: was byte-identical to `secondary`.
- `accent` `#d6e4f0`/`#1e3a8a` → `#f6e6e0`/`#8a3a1f`: the old blue collided with
  `status-confirmed` on the calendar, where selection and status appear together.
- `--radius-xs: 1px` removed.
- `font-display` removed (duplicate of `font-serif`).
- `Tone` extended to cover `in-service` and `no-show`; `TONE_BY_STATUS` added.
- Tint mix ratio specified (`--tint-mix`), previously unstated and unreproducible.
- Shadow alpha and overlay darkness tokenised; both were hardcoded.
- `z-popover` renamed `z-layer-popover` to stop colliding with `shadow-popover`.

**Documentation fixes.**

- §7's contrast reasoning was inverted (contrast is symmetric; flipping fg/bg changes
  nothing). Replaced with the fill-vs-text model in §2.3.
- The two contradictory spacing scales (§5 and §9 of the previous doc) merged into §5.1.
- Breakpoints, grid, type line-heights and touch targets are now implemented in the config
  rather than only described.
- Added version, owner, enforcement, review checklist, roadmap and this changelog.
