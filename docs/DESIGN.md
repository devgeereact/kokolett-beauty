# Design System — Kokolett Beauty UK

Tokens live in `src/index.css` as CSS custom properties and are mapped to Tailwind
utilities in `tailwind.config.ts`. Never write a raw hex value in a component.

---

## 1. Direction

Warm, calm, unfussy. A terracotta accent against cool neutral greys — the warmth
carries the salon's personality, the greys keep the owner's dashboard legible during a
twelve-hour day. Content sits on white cards floating just above a soft grey ground.

The marketing site leans editorial: generous whitespace, serif headings, large
photography. The dashboard leans utilitarian: dense, scannable, sans throughout. Same
tokens, different rhythm.

## 2. Theme

**Default is `system`.** The user's OS preference decides, and the choice is
overridable to explicit light or dark. `ThemeProvider` writes `.dark` onto
`<html>` and stores the _preference_ (not the resolved value) under
`kokolett-theme`, so a user on `system` keeps following the OS after a restart.

## 3. Colour tokens

### Light

| Token                                    | Hex                   | Use                         |
| ---------------------------------------- | --------------------- | --------------------------- |
| `background`                             | `#e8ebed`             | Page ground                 |
| `foreground`                             | `#333333`             | Body text                   |
| `card` / `card-foreground`               | `#ffffff` / `#333333` | Cards, panels, sheets       |
| `popover` / `popover-foreground`         | `#ffffff` / `#333333` | Menus, dialogs              |
| `primary` / `primary-foreground`         | `#e05d38` / `#ffffff` | Primary action, brand       |
| `secondary` / `secondary-foreground`     | `#f3f4f6` / `#4b5563` | Secondary action            |
| `muted` / `muted-foreground`             | `#f9fafb` / `#6b7280` | Subdued surfaces, hint text |
| `accent` / `accent-foreground`           | `#d6e4f0` / `#1e3a8a` | Highlights, selected slot   |
| `destructive` / `destructive-foreground` | `#ef4444` / `#ffffff` | Cancel, delete              |
| `border`                                 | `#dcdfe2`             | Hairlines                   |
| `input`                                  | `#f4f5f7`             | Field fill                  |
| `ring`                                   | `#e05d38`             | Focus ring                  |

### Dark

| Token                                    | Hex                   |
| ---------------------------------------- | --------------------- |
| `background`                             | `#1c2433`             |
| `foreground`                             | `#e5e5e5`             |
| `card` / `card-foreground`               | `#2a3040` / `#e5e5e5` |
| `popover` / `popover-foreground`         | `#262b38` / `#e5e5e5` |
| `primary` / `primary-foreground`         | `#e05d38` / `#ffffff` |
| `secondary` / `secondary-foreground`     | `#2a303e` / `#e5e5e5` |
| `muted` / `muted-foreground`             | `#2a303e` / `#a3a3a3` |
| `accent` / `accent-foreground`           | `#2a3656` / `#bfdbfe` |
| `destructive` / `destructive-foreground` | `#ef4444` / `#ffffff` |
| `border` / `input`                       | `#3d4354`             |
| `ring`                                   | `#e05d38`             |

### Charts

`chart-1` `#86a7c8` · `chart-2` `#eea591` · `chart-3` `#5a7ca6` ·
`chart-4` `#466494` · `chart-5` `#334c82`
(dark `chart-2` shifts to `#e6a08f`). Reports use these in order; do not introduce
ad-hoc chart colours.

### Sidebar

The owner dashboard shell has its own ramp so it reads as chrome rather than content:
`sidebar` `#dddfe2` / `#2a303f`, with matching `-foreground`, `-primary`, `-accent`,
`-border` and `-ring` tokens.

### Appointment status

Status colour is load-bearing on the calendar, so it is tokenised rather than
improvised:

| Status                   | Light     | Dark      |
| ------------------------ | --------- | --------- |
| `pending_approval`       | `#d97706` | `#f59e0b` |
| `confirmed`              | `#2563eb` | `#60a5fa` |
| `in_service`             | `#7c3aed` | `#a78bfa` |
| `completed`              | `#059669` | `#34d399` |
| `cancelled` / `rejected` | `#6b7280` | `#9ca3af` |
| `no_show`                | `#dc2626` | `#f87171` |

Colour never carries status alone — every chip also has a text label, because roughly
1 in 12 men has a colour vision deficiency and the owner's calendar is the one screen
where a misread is expensive.

## 4. Typography

| Role                        | Family             | Notes                              |
| --------------------------- | ------------------ | ---------------------------------- |
| UI, body                    | **Inter**          | 400 / 500 / 600                    |
| Display, marketing headings | **Source Serif 4** | 400 / 600, optical sizing 8–60     |
| Numerals, references, code  | **JetBrains Mono** | 400 — booking references and times |

Loaded from Google Fonts in `index.html` with `preconnect` and `display=swap`, and
cached by the service worker (`StaleWhileRevalidate`).

Scale: `text-xs` 12 · `text-sm` 14 · `text-base` 16 · `text-lg` 18 · `text-xl` 20 ·
`text-2xl` 24 · `text-3xl` 30 · `text-4xl` 36. Body line-height 1.6; headings 1.2.
Never below 14px for anything a customer must read to book.

## 5. Shape, spacing, elevation

- **Radius** — `--radius: 0.75rem`. `rounded-lg` is the default; `rounded-md` and
  `rounded-sm` step down; `rounded-xl` / `rounded-2xl` step up for hero cards.
- **Spacing** — Tailwind's 4px scale. Section rhythm on the marketing site is
  `py-16` mobile / `py-24` desktop. Dashboard density is `p-4` cards, `gap-3` lists.
- **Elevation** — two shadows. `shadow-card` (`0 2px 8px rgb(17 24 39 / 0.06), 0 1px 2px
  rgb(17 24 39 / 0.04)`) for cards and panels; `shadow-popover` (`0 6px 24px
  rgb(17 24 39 / 0.08), 0 2px 6px rgb(17 24 39 / 0.08)`) for menus, dropdowns, and
  popovers — a deliberate, singular addition beyond the card shadow, not an open-ended
  shadow system. Depth otherwise comes from card/ground contrast, not from stacking
  further shadows.

## 6. Motion

Restrained. 150–300ms, `ease-out`. `animate-fade-up` for content entering on scroll,
opacity-only transitions for state changes. Slot selection and calendar drag get
immediate feedback with no easing delay — perceived responsiveness beats polish there.

`prefers-reduced-motion: reduce` collapses all animation globally in `index.css`.
That rule is not optional and must not be overridden per component.

## 7. Accessibility — WCAG 2.2 AA

- Contrast: body text ≥ 4.5:1, large text ≥ 3:1. Note `primary #e05d38` on white is
  ~3.4:1 — **acceptable for large text and UI components, not for body copy**. Primary
  buttons therefore use white text on the terracotta fill, never terracotta text on
  white for paragraphs.
- Visible focus on everything interactive; the global `:focus-visible` ring is defined
  once in `index.css` and must not be removed.
- Touch targets ≥ 44×44px, which sets the minimum size of a time-slot button.
- The booking flow is fully keyboard-operable, including the date grid (arrow keys)
  and slot list.
- Every form field has a real `<label>`; errors are announced via `aria-live` and
  described by `aria-describedby`, never signalled by red border alone.
- The calendar is a table with proper headers, plus an agenda list as the accessible
  alternative to drag-and-drop.

## 8. Tailwind version note

The supplied palette used Tailwind v4 `@theme inline` syntax. This project is pinned to
**Tailwind 3.4**, so the tokens are declared as CSS custom properties in
`src/index.css` and referenced as `var(--token)` from `tailwind.config.ts`. Values and
names are unchanged.

One consequence: colour opacity modifiers (`bg-primary/50`) do **not** work against
`var()` colours. Where a translucent fill is needed, add an explicit token or use
`color-mix()` in a component class.

## 9. Spacing, grid, breakpoints

**Spacing** is an 8-point scale: `0 4 8 12 16 24 32 48 64 80` (px) — Tailwind's default
scale already satisfies this; no config change, documented for reference.

**Grid:** 12 columns, max width 1440px, 24px gutter.

**Layout containers:** mobile 375px, mobile-large 414px, tablet 768px, desktop 1024px,
wide 1440px.

**Breakpoints (mobile-first):** mobile 0–767px, tablet 768–1023px, desktop
1024–1439px, wide 1440px+.

## 10. Icons

`lucide-react` — 24×24px grid, 2px stroke, outline style. Used for primary sidebar nav
rows (`src/lib/icons.ts`). Import icons individually
(`import { Calendar } from 'lucide-react'`) so unused icons are tree-shaken; never
`import * as Icons`.
