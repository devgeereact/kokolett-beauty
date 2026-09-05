# Design System — Kokolett Beauty UK

|                |                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Version**    | 1.0.0                                                                                                    |
| **Status**     | Stable                                                                                                   |
| **Source**     | This file is the reference. Values live in `src/index.css`; `tailwind.config.ts` maps them to utilities. |
| **Applies to** | `src/index.css`, `tailwind.config.ts`, `src/components/ui/*`                                             |

Values live in `src/index.css` as CSS custom properties. `tailwind.config.ts` maps them to
utilities and nothing else. **A component never contains a raw colour, radius, shadow or
z-index value** — and that is enforced by the config rather than requested by this document
(§11).

**Build wiring, since Tailwind 4.** `src/index.css` starts with `@import 'tailwindcss'`
rather than the old `@tailwind base/components/utilities` trio, and pulls the config in
explicitly with `@config '../tailwind.config.ts'`. Tailwind 4 is CSS-first by default, but
this design system is a closed set that this document describes section by section, so the
config file stays the single source of truth instead of being forked into a `@theme` block.
`darkMode: 'class'` no longer comes from the config either — the `.dark` variant is declared
in `src/index.css` with `@custom-variant`. PostCSS loads `@tailwindcss/postcss`; plain
`tailwindcss` as a PostCSS plugin now throws. Autoprefixer is gone, its job absorbed by
Tailwind's own Lightning CSS pass.

Sections marked **RULE** are normative and blocking at review. Everything else is rationale.

§1–§13 are the visual token system. §15 is app-shell mechanics that are not visual tokens
(scroll architecture, control heights, sidebar and drawer widths).

There used to be a `design-token/` folder described here as "the locked reference", kept in
sync with this file by hand. It was not in sync: 252 lines of this document, 121 of
`tailwind.config.ts` and 161 of `src/index.css` differed from their supposed source, and
because the folder sat outside `tsconfig.json` it was also the direct cause of a lint failure
that kept CI red. A reference that has drifted from the thing it references is worse than no
reference, so it was deleted and this file took its place.

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
--primary: 194 77 44; /* not #c24d2c */
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
Role names describe _purpose_, never appearance: there is no `--orange` or `--grey-100`.

### 2.3 Fills and text are different jobs

This is the rule that most of §3 exists to serve.

|                                    | Contrast requirement                                     | Tokens                                          |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| **Fill** carrying a label          | 3:1 vs adjacent surface; its `-foreground` ≥ 4.5:1 on it | `primary`, `secondary`, `destructive`, `accent` |
| **Text / icon** on a light surface | ≥ 4.5:1 against its own background                       | `foreground`, `muted-foreground`, `status-*`    |
| **Terracotta text below 24px**     | ≥ 4.5:1 against its own background                       | `brand-ink`                                     |
| **Identity**                       | ≥ 3:1 only (large text and non-text UI)                  | `brand`, `ring`                                 |

**RULE** — Never use a `status-*` token as a background. Never use `brand` behind text
smaller than 24px. Never use `primary` as body text on a light surface.

### 2.4 `brand-ink`: terracotta at small sizes

Added 2026-09-05, after an axe sweep found nine WCAG 1.4.3 failures on the public
pages. Every one was the rule above being broken rather than a palette that needed
retuning: six marketing eyebrow labels used `text-brand` at 12px (3.03:1 on the page
background), two inline links used `text-primary` at 14px (3.99:1), and the hero
stat labels used `text-primary-foreground/80` on `bg-primary` (3.62:1, because an
opacity modifier on a foreground token drops it below the threshold the token was
chosen to meet).

`--brand-ink` is the same hue, darkened in light mode and lifted in dark, until it
holds on the worst surface it lands on: **6.48:1** on `--background` and **7.76:1** on
`--card` in light, **10.49:1** on `--background` in dark. Nothing about the salon's
identity changes; `--brand` and `--primary` are untouched and still do their own jobs.

- `brand` is display type, 24px and up, marketing, and the focus ring.
- `primary` is any fill that carries a text label.
- `brand-ink` is terracotta TEXT small enough that 4.5:1 applies.

The regression guard is `e2e/marketing-site.spec.ts`, which now runs axe over every
public route under **both** colour schemes (`playwright.config.ts`). It only ever ran
in light mode before, which is how a second failure went unnoticed: the dark
`--muted-foreground` was tuned against `--card` but is also every field placeholder's
colour on `--input`, where it measured 3.91:1. It is now `#b4b4b4`, 4.76:1 on the worst
surface and still clearly below `--foreground`.

### 2.4a The dashboard, measured for the first time

The twenty dashboard screens had never had an accessibility check of any kind: they
sit behind the secret sign-in gate, so no automated run had ever reached them. Driven
through a real signed-in browser on 2026-09-05, **every one of them failed**, roughly
fifty violations from six causes, all of them the same two mistakes repeated:

**An opacity modifier on a foreground token.** `text-sidebar-foreground/60` on the
nav section headings is 60% of `#333333` over `#dddfe2`, which is `#777879` and
3.31:1 at 12px. Twenty-one instances, on every screen, because it is chrome. This is
the third time this exact trap has bitten (the hero stat labels and the dark
placeholders were the first two), so it is now a real token, `--sidebar-muted`, that
an opacity modifier cannot silently re-tint. The calendar's outside-month days were
the same shape: `--muted-foreground` at `opacity-50` composites to `#adb1b8`, 2.15:1,
the worst ratio anywhere in the app.

**Status text that was tuned against `--card` but is used on its own tint.** Every
`--status-*` token is documented as clearing 4.5:1 "on card and on its tint". They
cleared it on card and missed on the tint, in both themes and in opposite directions:
in light, pending 4.25, confirmed 4.37, cancelled 4.16 and no-show 4.01; in dark,
no-show 3.66, in-service 3.63, cancelled 3.78 and confirmed 3.81. Reducing
`--tint-mix` does not fix it (at 6% the worst light pairing is still 4.45:1 and the
tint has stopped reading as a tint), so the text moved instead: darker in light,
lighter in dark, hue and saturation unchanged. `TONE_TEXT.primary` in `src/lib/tone.ts`
also moved from `primary` to `brand-ink`, since it renders on `--tint-brand`.

All twenty screens are now clean in both themes. This is browser evidence against the
built `dist/` under the real CSP, not a static read.

### 2.5 The scale is enforced by a gate, not by Tailwind

`tailwind.config.ts` declares `colors`, `screens`, `fontSize`, `borderRadius`,
`boxShadow` and `zIndex` at theme level rather than inside `extend`, with a comment
saying `sm`, `xl` and `2xl` "are removed so nobody invents a range the system doesn't
define". Measured against the compiled stylesheet on 2026-09-05, that is only half
true under Tailwind v4:

- `colors`, `fontSize` and `boxShadow` ARE replaced. A name outside the scale emits
  nothing at all, silently: `text-7xl` rendered the 404 numeral at the inherited 16px
  instead of 72px, `from-black/70` left the Contact page's photo caption sitting on
  the photograph with no scrim, and `shadow-sm` gave the selected template-preview
  segment no elevation. None of the three failed a build, a lint, a type check or an
  axe run.
- `screens` is NOT replaced. `sm:` resolved at v4's own 640px, an undeclared fifth
  breakpoint, in seven files.
- `zIndex` is NOT replaced either: `z-<number>` is a bare-value utility with no theme
  lookup, so `z-10` resolved regardless of the named scale.

`npm run lint:classes` (`scripts/check-dead-classes.py`, a CI step that runs after the
build) now catches all of it: classes that produce no CSS, breakpoint variants the
config does not declare, and bare numeric `z-` values. Arbitrary values like
`text-[11px]` are still only caught by review.

---

## 3. Colour

### 3.1 Light

| Token                         | Hex                   | Use                                            |
| ----------------------------- | --------------------- | ---------------------------------------------- |
| `background`                  | `#e8ebed`             | Page ground                                    |
| `foreground`                  | `#333333`             | Body text — 10.6:1                             |
| `card` / `-foreground`        | `#ffffff` / `#333333` | Cards, panels, sheets                          |
| `popover` / `-foreground`     | `#ffffff` / `#333333` | Menus, dialogs                                 |
| `brand`                       | `#e05d38`             | Identity: display ≥24px, marketing, focus ring |
| `primary` / `-foreground`     | `#c24d2c` / `#ffffff` | Primary action — 4.78:1                        |
| `secondary` / `-foreground`   | `#f3f4f6` / `#4b5563` | Secondary action — 6.9:1                       |
| `muted` / `-foreground`       | `#f1f3f5` / `#5b6370` | Recessed surfaces, hint text — 5.45:1          |
| `accent` / `-foreground`      | `#f6e6e0` / `#8a3a1f` | Selection, menu hover — 6.4:1                  |
| `destructive` / `-foreground` | `#dc2626` / `#ffffff` | Cancel, delete — 4.83:1                        |
| `border`                      | `#dcdfe2`             | Hairlines                                      |
| `input`                       | `#f4f5f7`             | Field fill                                     |
| `ring`                        | `#e05d38`             | Focus ring — 3.63:1 (non-text, passes 1.4.11)  |

### 3.2 Dark

| Token                         | Hex                   |
| ----------------------------- | --------------------- |
| `background`                  | `#1c2433`             |
| `foreground`                  | `#e5e5e5`             |
| `card` / `-foreground`        | `#2a3040` / `#e5e5e5` |
| `popover` / `-foreground`     | `#262b38` / `#e5e5e5` |
| `brand`                       | `#e05d38`             |
| `primary` / `-foreground`     | `#f0805e` / `#1a1f2b` |
| `secondary` / `-foreground`   | `#2a303e` / `#e5e5e5` |
| `muted` / `-foreground`       | `#232936` / `#a3a3a3` |
| `accent` / `-foreground`      | `#3b2a23` / `#f6cbb8` |
| `destructive` / `-foreground` | `#f87171` / `#1a1f2b` |
| `border` / `input`            | `#3d4354`             |
| `ring`                        | `#e05d38`             |

**RULE** — In dark mode, saturated fills go _lighter_ and take a _dark_ foreground. This is
not a stylistic preference: a terracotta dark enough to hold white text at 4.5:1 falls below
3:1 against `card`, so white-on-orange cannot pass AA on a dark ground. `primary-foreground`
is `#1a1f2b` in dark for that reason.

Note `muted` sits _below_ `card` in dark and _below_ `card` but _above_ `background` in
light, so the `subtle` Card variant reads as recessed in both themes.

### 3.3 Appointment status

Text and icon colours. Every value clears 4.5:1 on both `card` and its own tint, in both
themes, because these appear at 12–14px inside pills.

| Status       | Light     | Dark      |
| ------------ | --------- | --------- |
| `pending`    | `#b45309` | `#f59e0b` |
| `confirmed`  | `#2563eb` | `#60a5fa` |
| `in-service` | `#7c3aed` | `#a78bfa` |
| `completed`  | `#047857` | `#34d399` |
| `cancelled`  | `#6b7280` | `#9ca3af` |
| `no-show`    | `#dc2626` | `#f87171` |

The `AppointmentStatus` enum has seven members and the palette has six. The mapping is
explicit, not conventional — see the `TONE_BY_STATUS` map in §9.1.

**RULE** — Colour never carries status alone. Every chip, pill and calendar block also
carries a text label.

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

| Role                        | Family         | Weights                        |
| --------------------------- | -------------- | ------------------------------ |
| UI, body                    | Inter          | 400 / 500 / 600                |
| Display, marketing headings | Source Serif 4 | 400 / 600, optical sizing 8–60 |
| Numerals, references, times | JetBrains Mono | 400                            |

Requested from `index.html`, **not** with an `@import` in `src/index.css`, and cached by
the service worker (StaleWhileRevalidate). An `@import` cannot begin until the
stylesheet containing it has itself downloaded and parsed, so the fonts sat at the end
of a serial chain on every cold load. `index.html` carries the `preconnect`, a
`preload` and the `<link rel="stylesheet">`, which start as soon as the HTML is parsed.
`src/index.css` opens with a comment saying exactly this; the sentence here described
the arrangement that replaced it.

The two font origins also appear in **both** `font-src` and `connect-src` in the CSP,
and both are load-bearing: the service worker runtime-caches Google Fonts, and a
`fetch()` from a service worker is governed by `connect-src`, not `font-src`.

Scale — line-height is baked into each step in `tailwind.config.ts`, so §4 is enforced rather
than remembered:

| Class       | Size | Line-height |
| ----------- | ---- | ----------- |
| `text-xs`   | 12px | 16px        |
| `text-sm`   | 14px | 20px        |
| `text-base` | 16px | 1.6         |
| `text-lg`   | 18px | 1.6         |
| `text-xl`   | 20px | 1.3         |
| `text-2xl`  | 24px | 1.2         |
| `text-3xl`  | 30px | 1.2         |
| `text-4xl`  | 36px | 1.2         |
| `text-5xl`  | 48px | 1.05        |
| `text-6xl`  | 72px | 1           |

**RULE** — Nothing a customer must read to complete a booking may be below 14px.
`text-xs` is for dashboard metadata only. `text-5xl`/`text-6xl` (added 2026-08) are
for marketing hero headlines only — never the booking flow, never dashboard chrome.

`font-display` is removed — it was an alias for `font-serif`. Use `font-serif`.

---

## 5. Layout

### 5.1 Spacing

Tailwind's default 4px scale, unmodified: `4 8 12 16 20 24 32 40 48 64 80 96`.

- Marketing section rhythm: `py-16` mobile, `py-24` desktop.
- Dashboard density: `p-4` cards, `gap-3` lists.
- Every primary scroll region carries `.scroll-bottom-gap` (24px, 32px ≥1024px) so the last
  row never sits flush to the viewport edge. Applied once at `DashboardLayout`'s `<main>`.

### 5.2 Grid

12 columns, 1440px max width, 24px gutter — available as `.layout-grid`. `max-w-content` is
the same 1440px cap for non-grid containers; `max-w-page` is the app-shell alias for the same
value (§15).

### 5.3 Breakpoints

Mobile-first, four ranges, three breakpoints:

| Name    | Range       | Class    |
| ------- | ----------- | -------- |
| mobile  | 0–767px     | _(base)_ |
| tablet  | 768–1023px  | `md:`    |
| desktop | 1024–1439px | `lg:`    |
| wide    | 1440px+     | `wide:`  |

**RULE** — `sm:`, `xl:` and `2xl:` no longer resolve. If a layout needs a range this table
doesn't define, that's a design conversation, not a config edit.

Reference device widths (not breakpoints): 375, 414, 768, 1024, 1440.

---

## 6. Shape, elevation, stacking

### 6.1 Radius

Four visible steps: `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 12px`,
`--radius-xl 16px`. `rounded` with no suffix resolves to `md`. `rounded-2xl` collapses onto
`xl`; `rounded-3xl` no longer resolves. `rounded-full` is the plain 9999px pill.

- Cards, modals, popovers → `rounded-xl`
- Buttons and most controls → `rounded-md` / `rounded-lg`
- Badge, StatusPill, StatusChip → `rounded-full`

### 6.2 Elevation

Three tiers, chosen by how far a surface floats above the page:

| Token            | Value         | Used by                                                                         |
| ---------------- | ------------- | ------------------------------------------------------------------------------- |
| `shadow-card`    | `0 1px 3px`   | Default Card — normal document flow                                             |
| `shadow-popover` | `0 4px 10px`  | Dropdowns, row/tab menus, notification popover, DatePicker, toasts, PWA banners |
| `shadow-modal`   | `0 10px 30px` | Modal, ConfirmDialog, QuickActionLauncher — anything blocking the page          |

Shadow alpha is tokenised per theme (`--shadow-a1..a3`) and rises sharply in dark mode,
because 10% black is effectively invisible on `#1c2433`.

Card variants: `default` (bordered + `shadow-card`), `subtle` (flat `bg-muted`, no shadow,
for a nested region), `accent` (flat `bg-tint-brand`, for a highlighted callout).

### 6.3 Stacking

One scale. Arbitrary z-index values and Tailwind's `z-10`/`z-50` no longer resolve.

`z-base 0` · `z-sticky 20` (page/table headers, local overlaps like the calendar's now-line
and focus states) · `z-dropdown 40` (menus, DatePicker) · `z-sidebar 50` · `z-overlay 60` ·
`z-drawer 70` (mobile nav) · `z-modal 80` (Modal, QuickActionLauncher) ·
`z-layer-popover 90` (ConfirmDialog, which must paint above the Modal that opened it;
NotificationBellPopover) · `z-toast 100`.

_Naming note:_ the stacking token is `z-layer-popover`, not `z-popover`, because
`shadow-popover` means "dropdown-height surface" while this layer means "above a modal".
Two different concepts should not share a name.

All overlay backdrops use `.overlay-backdrop`, driven by `--overlay` and `--overlay-alpha`,
rather than each surface picking its own darkness. This is unrelated to the photo scrims
below — backdrops sit behind modals/drawers/dropdowns, not behind text on a photo.

### 6.4 Photo scrims

Text over a full-bleed photo always uses `text-hero-fg` (and its opacity variants) — the
only sanctioned white-on-photo color, since it sits on the photo's own scrim rather than a
themed surface (`src/index.css`). Two scrim shapes, chosen by how much of the photo the
text can land on:

- **Full-bleed wash** (`HeroCarousel`'s `SCRIM`) — a diagonal gradient darkening the whole
  image, never fully transparent anywhere. Used where text can roam across a tall hero.
- **Bottom-anchored gradient** (`PhotoCard`'s `PHOTO_SCRIM`) — darkens only the bottom band
  under the text, staying light over the rest of the card so the photography still reads
  full-bleed. Also never fades to fully transparent — a `to-transparent` gradient looks fine
  over a dark photo but leaves text unreadable over a bright one.

Either way: never let a scrim's stop reach 0% opacity anywhere text can land.

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
  pending: 'bg-tint-pending text-status-pending',
  confirmed: 'bg-tint-confirmed text-status-confirmed',
  'in-service': 'bg-tint-in-service text-status-in-service',
  completed: 'bg-tint-completed text-status-completed',
  cancelled: 'bg-tint-cancelled text-status-cancelled',
  'no-show': 'bg-tint-no-show text-status-no-show',
  brand: 'bg-tint-brand text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

/** Seven enum members, six palettes. The collapse is explicit, not implied. */
export const TONE_BY_STATUS: Record<AppointmentStatus, Tone> = {
  pending_approval: 'pending',
  confirmed: 'confirmed',
  in_service: 'in-service',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled', // shares cancelled's palette; label distinguishes
  no_show: 'no-show',
};
```

**RULE** — Never write `bg-tint-* text-status-*` inline in a screen. Go through `Tone`.

### 9.2 Components

| Component                   | Purpose                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatTile`                  | Dashboard headline number: tinted icon square, bold value, muted label. Any "N pending / N this week" stat row.                               |
| `Badge`                     | Short tinted pill for a fact about a row that is _not_ its `AppointmentStatus` — "First-time customer", "Needs approval · 11h 24m remaining". |
| `StatusPill` / `StatusChip` | Keyed by the `AppointmentStatus` enum via `TONE_BY_STATUS`. The only components allowed to render status colour.                              |
| `CountdownChip`             | Boxed two-line deadline (`formatCountdown` value / "remaining") for a list row.                                                               |

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
- **2.5.8 Target size** — minimum 24×24 by the standard. **On customer-facing
  surfaces this system uses 44×44** (`min-h-touch` / `min-w-touch`): the booking flow,
  the public header nav, time slots, form fields and every public CTA. Those are used
  once, in a hurry, on a phone, by someone who has never seen the interface before.

  **The owner dashboard runs at 36–40px by design and is not held to 44.** Its controls
  come from `--control-height-sm` (36), `--control-height` (40) and `--nav-item-height`
  (40) — see §15.2 — because density is what makes a tool you use all day workable, and
  the owner is a practised user on a known interface. Measured at tablet width, 79 of
  101 dashboard controls sit under 44×44; all of them clear the 24×24 the standard
  actually requires. `--control-height-lg` (44) exists for the dashboard controls that
  do want the floor, and the calendar's view switcher uses it.

  One dashboard control is deliberately left short: the Week/Day calendar's open-slot
  blocks, 37×37 on an iPad in landscape. The axis is fixed at 08:00–20:00, so twelve
  hour rows share a grid that fits the viewport rather than scrolling — 512px, 42.7px
  a row. Reaching 44 means moving both dimensions at once: roughly 72px more grid for
  the height (a block is 8.33% of the body, so extra height buys very little), and
  collapsing the 320px details rail for the width, which there is no breakpoint
  between `lg` and `wide` to do. `src/lib/calendar.ts` carries the measurements.

  Say which surface you are on before quoting a number from this section.
  Time slots, form fields and the booking submit all meet it on every width.
  **The month grid meets it on height only.** Seven 44px cells need 308px, and a
  320–390px viewport has less than that once the page gutter and card padding are
  taken, so `Calendar` at `size="lg"` floors the day button's height at 44 and lets
  width follow the column: 32px at 320, 42px at 390, over 44 from about 400 up.
  The shortfall is covered by 2.5.8's spacing exception — 46px between centres
  against a 24px requirement — and closing it properly would mean a different
  layout for the smallest phones, not a bigger number here.

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

| Rule                           | Mechanism                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| No raw colours                 | `theme.colors` replaces the default palette. `bg-red-500`, `text-white` produce nothing. |
| No arbitrary z-index           | `theme.zIndex` replaces defaults. `z-50` produces nothing.                               |
| Three shadow tiers             | `theme.boxShadow` replaces defaults. `shadow-lg` produces nothing.                       |
| Radius scale is closed         | `theme.borderRadius` replaces defaults. `rounded-3xl` produces nothing.                  |
| Type scale carries line-height | `theme.fontSize` replaces defaults.                                                      |
| Only four layout ranges        | `theme.screens` replaces defaults.                                                       |

**Still not machine-enforced** — arbitrary values (`bg-[#ff0000]`, `z-[999]`, `text-[11px]`).
Add `eslint-plugin-tailwindcss` with `no-arbitrary-value` to close this. Until then it is a
review item.

**Review checklist for any UI PR**

1. No hex, rgb or arbitrary bracket values in a component.
2. Status colour goes through `Tone`, never inline.
3. New interactive fill: measured against its foreground _and_ its neighbour, both themes.
4. `:focus-visible` intact; nothing overrides reduced motion.
5. Any new token added to `src/index.css` **and** documented here in the same PR.

---

## 12. Known issues and roadmap

- ~~**Tailwind 3.4 pin.**~~ Resolved 2026-08-20: the app is on Tailwind 4. Tokens stay
  custom properties referenced from `tailwind.config.ts` via `@config`, rather than moving
  into `@theme inline`, so this document and the config do not become two sources of truth
  for the same values. Verified as a visual no-op — computed styles across 500 elements on
  two pages were identical before and after.
- **`color-mix()` support.** Tints require Chrome 111+ / Safari 16.2+ / Firefox 113+. Below
  that, tinted backgrounds fall back to transparent — the saturated text still renders
  legibly on `card`, so this degrades safely, but it is a known limit.
- **No NativeWind path.** `color-mix()`, `box-shadow`, `:focus-visible`,
  `prefers-reduced-motion` and the custom utilities are all web-only. If Expo becomes real,
  it needs its own token bridge.

---

## 13. Changelog

### 1.0.0

Adopted the closed token system, replacing the prior ad-hoc set (hex-only custom
properties, two-tier shadow scale, `success`/`warning`/`info` colours that were declared but
unused, Tailwind's default `sm`/`xl`/`2xl` breakpoints left active alongside the documented
four-range scale).

**What changed in the app to adopt it:**

- `tailwind.config.ts` and `src/index.css` rewritten to the closed `colors` / `screens` /
  `fontSize` / `borderRadius` / `boxShadow` / `zIndex` theme keys,
  merged with the app's own non-visual shell mechanics (control heights, sidebar/drawer
  widths, page gutters — §15) which stay on `extend`.
- `bg-tint-primary` renamed to `bg-tint-brand` throughout (matches the `Tone.brand` mapping
  in §9.1, which was already exactly `bg-tint-brand text-primary`).
- `shadow-overlay` (the old two-tier scale) split across the new three-tier scale per
  component: `shadow-popover` for dropdowns/menus/toasts/PWA banners, `shadow-modal` for
  Modal/ConfirmDialog/Drawer/QuickActionLauncher.
- `z-popover` renamed to `z-layer-popover`; the two stray `z-10` local-stacking usages
  (calendar now-line, month-grid focus) remapped onto the closed scale (`z-base`/`z-sticky`).
- `text-white` (Avatar's placeholder-tile icon) replaced with `text-primary-foreground`.
- `font-display` (a duplicate alias for `font-serif`) swept to `font-serif` everywhere.
- `sm:`/`xl:`/`2xl:` swept from every component onto the closed `md:`/`lg:`/`wide:` scale.
- `Card` and the popover/modal/dropdown/toast primitives (`ConfirmDialog`, `DatePicker`,
  `NotificationBellPopover`, row-menu dropdowns, `Toast`, `UpdatePrompt`/`InstallPrompt`,
  `QuickActionLauncher`) moved from `rounded-md` to `rounded-xl` per §6.1's "cards, modals,
  popovers" rule.
- `success`/`warning`/`info` colour tokens dropped (declared but never consumed; not part of
  the design system).

---

## 14. See also

`src/index.css` for the values themselves, `tailwind.config.ts` for how they become
utilities. §15 below covers this app's shell mechanics, which are not visual tokens.

---

## 15. Application shell (app-specific, not a design-system token)

This section covers layout mechanics that are not visual tokens — they live in
`tailwind.config.ts`'s `extend` block and `src/index.css`'s
`:root` alongside the token layer, not inside the closed scales in §5–§6.

### 15.1 Scroll architecture

**The browser viewport itself never scrolls.** `DashboardLayout` renders a fixed shell via
three shared utility classes (`src/index.css` → `@layer components`):

- `.koko-app` — `flex h-dvh min-h-0 overflow-hidden`, the outermost row: sidebar next to the
  content column.
- `.koko-content` — `min-h-0 flex-1 overflow-hidden`, the column beside the sidebar: header,
  then the scroll region.
- `.koko-scroll` — `h-full overflow-y-auto overscroll-contain`, applied to `<main>`. This is
  the one scroll region for the *page content*.

The sidebar (`--sidebar-width` 240px, `--sidebar-collapsed-width` 72px) is a real flex
sibling, not a `fixed`-positioned overlay. The header targets `--header-height` (64px) via
`min-h-header`, not a hard cap. The mobile nav slide-over is a **sibling** of `.koko-app`,
not nested inside it: `.koko-app` is `overflow-hidden`, which clips a `position: fixed`
descendant in every major browser — the same reason `Modal`/`ConfirmDialog`/
`QuickActionLauncher` portal to `document.body` instead of rendering in place.

**The sidebar nav list gets its own scroll region too, deliberately (2026-08-31).** It was
originally built to render statically — wordmark, every nav row, and the account footer
fitting one viewport with no scroll of its own — but that assumption held only while the nav
was short. By six section groups (Workspace/Bookings/Customers/Salon/Insights/Communications/
Account) and ~20 items, the nav's own content (1074px measured) no longer fit a common
~720px-tall laptop viewport (651px available once the wordmark and account footer are
subtracted), and there was no scrollbar anywhere to reach the items pushed below the fold —
System Health, Broadcasts and Audit Log were simply unreachable. `DashboardLayout`'s `<aside>`
is now three flex children: the wordmark (`shrink-0`, pinned top), the nav list
(`min-h-0 flex-1 overflow-y-auto`, the new second scroll region), and the account footer
(`mt-auto shrink-0`, pinned bottom). This is scoped to the nav column only — it does not
reintroduce the "drift, double-scroll, or pagination looking detached" failure mode `.koko-
scroll` exists to prevent in the *content* area, since the two scroll regions are visually and
functionally independent (a user scrolls one or the other, never both at once).

### 15.2 Sizing tokens

Not part of the design system's visual scale, but shared across the shell so nothing
re-derives them: `--control-height-sm` 36px, `--control-height` 40px, `--control-height-lg`
44px, `--nav-item-height` 40px, `--header-height` 64px, `--sidebar-width` 240px,
`--sidebar-collapsed-width` 72px, `--drawer-width` 400px, `--page-gutter` 24px,
`--content-max-width` 1440px, `--content-bottom-gap` 24px.

**Overlay widths** — `Modal`/`Drawer` never take an ad-hoc `max-w-*`; they pick one of the
`maxWidth` tokens: `modal-sm` 400px, `modal-md` 520px (the `Modal` default), `modal-lg` 720px
(multi-step editors), `drawer-sm` 360px, `drawer-md` 400px (the `Drawer` default),
`drawer-lg` 480px. Popovers cap at `max-w-popover` (360px, notification bell).

### 15.3 Buttons and inputs

One `Button` component (`components/ui/Button.tsx`), variants not separate components:
`primary`, `secondary`, `ghost`, `destructive`. Heights are the control tokens above (`sm`
36px, `md` 40px default, `lg` 44px). Icon-only buttons keep a 44×44px hit target even when
the visible icon is smaller (`min-h-touch min-w-touch`), independent of the visible glyph
size.

`Field`/`Input`/`Select`/`Textarea` (`components/ui/Field.tsx`) share one `CONTROL` class:
`border-border`, `bg-input`. Error state is driven by `aria-invalid` (set automatically by
`Field`'s `error` prop, never a separate style prop) rather than colour alone.

### 15.4 Overlay primitives

Every popup in the app is one of these — a screen must never hand-roll its own
modal/drawer/toast chrome:

- **`Modal`** (`components/ui/Modal.tsx`) — centred, `modal-md` default width, portal +
  focus trap + Escape-to-close.
- **`Drawer`** (`components/ui/Drawer.tsx`) — off-canvas, anchored to the right edge, same
  portal/focus-trap/Escape wiring, `drawer-md` default width.
- **`ConfirmDialog`** (`components/ui/ConfirmDialog.tsx`) — replaces `window.confirm()`;
  renders above `Modal` (`z-layer-popover` vs `z-modal`) since several call sites nest one
  inside the other.
- **`Pagination`** (`components/ui/Pagination.tsx`) — the one shared pagination footer.
- **`ToastStack`** (`components/ui/Toast.tsx`) — mounted once by `ToastProvider`; nothing
  else renders a toast directly.

### 15.4b Interaction primitives (2026-08-31)

Four more shared components, added the same night the pages below stopped hand-rolling
the equivalent markup themselves. Not yet adopted everywhere that could use them —
each was wired into at least one real consumer, not left as unused scaffolding, but a
full app-wide migration is separate, larger work (`docs/KOKO_GAP.md`'s P3 checklist).

- **`Dropdown`** (`components/ui/Dropdown.tsx`) — trigger + popover menu, closes on
  outside pointerdown or Escape. In use: `AppointmentRowMenu.tsx`,
  `CustomerDetailPanel.tsx`'s More options menu.
- **`Tabs`** (`components/ui/Tabs.tsx`) — the underline tab bar (active tab gets a
  coloured bottom border). In use: `CustomerDetailPanel.tsx`,
  `TemplateEditorPage.tsx`'s Email/Mobile preview toggle.
- **`Tooltip`** (`components/ui/Tooltip.tsx`) — shows on hover *and* focus (the native
  `title` attribute it replaces is keyboard-invisible), announced via
  `aria-describedby`. Wraps its child rather than rendering its own trigger, so it can
  attach to any existing element without changing that element's semantics — but that
  means it introduces its own `position: relative` wrapper, which silently breaks a
  child that already depends on a specific `relative` ancestor for its own
  `position: absolute` offsets (caught once, on the sidebar collapse toggle, before
  shipping — moved to `NextWeeksGlanceCard.tsx`'s day-glance dots instead, which has no
  such conflict).
- **`DataTable`** (`components/ui/DataTable.tsx`) — sticky header, optional row
  grouping with a full-width divider row, row click. In use: `AppointmentsTable.tsx`.
  Deliberately not used for the Customers grid, which moved from a table to cards per
  an explicit prior owner request (`CustomerCard.tsx`'s own comment) — a generic table
  primitive is the wrong fit there regardless of how flexible it is.

### 15.5 Marketing vs dashboard

Marketing: Source Serif 4 headings, large photography, generous whitespace, `rounded-xl`
(16px) cards, editorial composition.

Dashboard: dense information, `rounded-xl` (16px) cards, `--page-gutter` (24px), compact
controls, clear hierarchy. **RULE.** Source Serif 4 for headings and for display
numerals; Inter for body text, labels, tables and every control.

This section said "Dashboard: Inter throughout" until 2026-08-31, and it was never
true. The page `<h1>` in `DashboardLayout`, all sixteen settings card headings and 55
of the 62 card headings were already serif. The seven exceptions were all on the Today
page, and one of them sat directly beside a serif-headed card in the same grid row.
They were brought into line rather than the other 55 being changed, because the
majority convention was also the one the page title already used.

Display numerals stay serif too, and deliberately: `GlanceGrid`'s headline figures are
sized to match the Bookings overview stats beside them, which is a cross-card
relationship that only holds if both use the same face.

Both share the same colours, borders, spacing scale, interaction states, accessibility
rules, radius language and motion language — that is how two different experiences come from
one product instead of two.
