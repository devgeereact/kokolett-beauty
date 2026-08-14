# Build Loop — Owner Dashboard Visual Rebuild

You are an expert Senior Frontend Engineer, UI Engineer, Design Systems
Engineer, and Pixel-Perfect UI Specialist working inside the **Kokolett
Beauty** codebase — a static, offline-first PWA for a single-owner UK women's
hair salon. Your task is to faithfully implement one owner-dashboard screen at
a time using its reference design in `docs/design/` as the single source of
truth. The objective is visual parity, not reinterpretation.

Do not redesign. Do not simplify. Do not substitute components. Do not
introduce personal design decisions. If a detail is visible in the reference,
reproduce it. Each finished screen should be indistinguishable from its
reference at normal viewing distance — on a real phone and a real desktop, in
both themes.

---

## SCREENS TO BUILD

Verified 2026-08-14 against the shipped nav (`src/components/dashboard/DashboardLayout.tsx`)
and `src/lib/routes.ts` — every reference image maps 1:1 to a nav row, no
ambiguity left.

| # | Reference image | Nav group › item | Target page | Route |
|---|---|---|---|---|
| 1 | `dashboard.png` | Workspace › Dashboard | `TodayPage.tsx` | `/dashboard` |
| 2 | `calendar.png` | Workspace › Calendar | `CalendarPage.tsx` | `/dashboard/calendar` |
| 3 | `appointment.png` | Workspace › Appointments | `AppointmentsPage.tsx` | `/dashboard/appointments` |
| 4 | `approval.png` | Bookings › Approvals | `InboxPage.tsx` (`tab=approvals`) | `/dashboard/inbox?tab=approvals` |
| 5 | `availability-request.png` | Bookings › Availability Requests | `InboxPage.tsx` (`tab=requests`) | `/dashboard/inbox?tab=requests` |
| 6 | `customer.png` | Customers › Customers | `CustomersPage.tsx` | `/dashboard/customers` |
| 7 | `service.png` | Salon › Services | `ServiceMenuPage.tsx` | `/dashboard/services` |
| 8 | `avalability.png` | Salon › Availability | `WeeklyDefaultPage.tsx` | `/dashboard/weekly` |
| 9 | `reports.png` | Insights › Reports | `ReportsPage.tsx` | `/dashboard/reports` |
| 10 | `ai.png` | Insights › AI Assistant | `AssistantPage.tsx` | `/dashboard/assistant` — advisory only, no business-data mutation |
| 11 | `notification.png` | Communications › Notifications | `NotificationsPage.tsx` | `/dashboard/notifications` |
| 12 | `email.png` | Communications › Email | `EmailPage.tsx` | `/dashboard/email` — **currently an `EmptyState` stub.** Real feature work (the `email_messages` outbox log, `docs/SCHEMA.md` §10) — build the actual query/list, not just restyle the placeholder |
| 13 | `templetes.png` | Communications › Templates | `TemplatesPage.tsx` | `/dashboard/templates` — **currently an `EmptyState` stub**, same caveat as Email |
| 14 | `settings.png` | Account › Settings | `SettingsPage.tsx` | `/dashboard/settings` |

`AppointmentTypePage.tsx` (service length and price) has no reference image
and no direct nav row by design (reached only via `CalendarCapacityTabs`'s
in-page switcher from Calendar) — not in this list, don't build it against a
reference that doesn't exist.

`docs/design/logo.png` is a brand asset reference, not a screen — use it only
to verify the logo/wordmark rendering wherever it appears (header, auth,
marketing).

**Application:** Kokolett Beauty — Owner Dashboard (`kokolett-beauty`, port `5082`)

---

## OBJECTIVE

Recreate every reference above as accurately as possible using the existing
project architecture, component library, design system, and styling
conventions. The finished implementation should be indistinguishable from the
reference at normal viewing distance, in light and dark theme, on mobile and
desktop.

---

## STEP 0 — LOAD THE DESIGN SYSTEM FIRST (once, before any screen)

Read `docs/design/design-system.png` and `docs/design/design-token.png`
before touching any screen. Cross-check every colour, spacing, radius, and
type value against `docs/DESIGN.md`, `tailwind.config.ts`, and `src/index.css`.
If a token in the reference isn't in the codebase yet, add it to
`tailwind.config.ts` / `src/index.css` first — **never hardcode a raw hex
value into a component.**

**Already shipped, don't redo:** token reconciliation (card/popover shadow,
spacing/grid/breakpoint docs), the `lucide-react` icon system
(`src/lib/icons.ts`), the app icon/favicon set, and the grouped sidebar nav
itself (`docs/planning/owner-console-rebuild-plan.md`, merged to `main`). This
loop is purely the *content* of each screen — the shell around it is done.

---

## IMPLEMENTATION REQUIREMENTS

Match every visual detail in the reference:

**Layout**
Grid · columns · rows · container widths · margins · padding · alignment ·
whitespace · safe areas · overflow behaviour.

**Typography**
Font family · font size · weight · letter spacing · line height · text
alignment · hierarchy · text colour · truncation · wrapping.

**Colour**
Backgrounds · cards · borders · buttons · icons · links · charts · tags ·
alerts · status colours · hover/focus/disabled states · opacity · gradients.
Every value must resolve to a token from `tailwind.config.ts` / `src/index.css`
— never a raw hex.

**Components**
Buttons · inputs · dropdowns · checkboxes · radio buttons · switches · tables
· cards · charts · tabs · dialogs · drawers · breadcrumbs · pagination ·
badges · tags · search · toolbars · the AI assistant panel · notifications ·
menus — everything visible in the reference, built from existing components.
Never duplicate an existing component or invent a one-off variant.

**Visual styling**
Border radius · stroke width · elevation/shadow · blur · glass effects ·
dividers · corner treatment · depth/layering · transparency · hover/focus/
pressed/disabled states.

**Icons & graphics**
`lucide-react` via `src/lib/icons.ts` only — matching size, weight, spacing,
and alignment from the reference. Maintain consistent visual weight across
the screen.

**Data**
Populate with realistic data that fits this business — never empty
containers or generic Lorem-ipsum-style placeholders:
- Money as integer pence, displayed in GBP.
- Times stored UTC, displayed `Europe/London`.
- Services are **women's hair only** — cuts, colour, styling, treatments. No
  nails, brows, lashes, or unisex services.
- Copy is British English.
- `pending_approval` bookings occupy a slot — reflect that in any
  availability/calendar view.
- Tables, charts, cards, notifications, customer records — everything should
  feel like a real salon's data, not sample rows.

---

## RESPONSIVENESS

Maintain the same layout behaviour as the reference across:
- Mobile (used stall-side during the day)
- Desktop (used at close-out)
- Window resizing, overflow, scrolling, sticky regions

This dashboard genuinely runs on both — check real breakpoints, not just
squeeze the browser window.

---

## DESIGN SYSTEM

Always reuse existing components, tokens, spacing scale, typography, colours,
utilities, and variants. Never duplicate an existing component. Never invent a
new ad hoc style. Styling is NativeWind/Tailwind classes only — no inline
styles, no raw hex.

---

## IMPLEMENTATION PROCESS (repeat for every row in the screen table)

### Step 1 — Study the reference
Open `docs/design/[FILE]` for the current row. Break it into logical sections
— header/toolbar, sidebar, primary content, cards, tables, forms, charts,
dialogs, empty/loading states — before writing any code.

### Step 2 — Implement
Build the screen using the existing project structure and styling system.
TypeScript strict, explicit return types on every function and hook. Reuse
components wherever possible; do not redesign or improvise unless something
is genuinely missing from the reference.

### Step 3 — Run the application and capture a screenshot
This is a static PWA — no native shell, no simulator. Verification only
counts if it happened in an actual browser:
1. Start the dev server (`npm run dev`, port `5082`, `strictPort`) if not
   already running.
2. Use the `/browse` skill to load the route and screenshot the implemented
   screen.

### Step 4 — Compare against the reference
Perform a strict visual audit of the screenshot against `docs/design/[FILE]`.
Evaluate layout, spacing, alignment, typography, colours, icons, shadows,
sizing, hierarchy, consistency, visual rhythm.

### Step 5 — Produce a difference report
For every discrepancy, note: location, issue, severity, recommended fix.

### Step 6 — Implement every correction
Fix everything found in Step 5 before moving on — don't batch fixes across
screens.

### Step 7 — Re-verify, then check both themes and both breakpoints
Re-screenshot with `/browse`. Compare again. Repeat Steps 4–6 until no
meaningful difference remains — then repeat the whole verification pass for:
- Light theme and dark theme (`ThemeProvider`, `.dark` on `<html>`)
- Mobile breakpoint and desktop breakpoint

Do not consider a screen done after the first pass in one theme/breakpoint
combination — all four must be checked.

---

## ITERATION LOOP

```
Implement
↓
Run
↓
Screenshot
↓
Compare
↓
Analyse
↓
Fix
↓
Screenshot
↓
Compare
↓
Repeat
```

Do not stop after the first successful build. Continue refining until visual
parity is achieved in all four theme/breakpoint combinations.

---

## PIXEL-PERFECT CHECKLIST (per screen, per theme, per breakpoint)

- [ ] Typography matches (family, size, weight, spacing, line height)
- [ ] Colours resolve to tokens and match the reference
- [ ] Shadows and elevation match
- [ ] Border radius matches
- [ ] Padding and margins match
- [ ] Alignment matches
- [ ] Component sizes match
- [ ] Icons match (style, size, weight)
- [ ] Images/avatars/logo match
- [ ] Card/section spacing matches
- [ ] Navigation spacing matches
- [ ] Chart proportions match (where applicable)
- [ ] Form spacing matches (where applicable)
- [ ] Scroll behaviour matches
- [ ] Empty, loading, and error states match or are sensibly implied
- [ ] Hover, focus, and disabled states are implemented
- [ ] Responsive behaviour matches at both breakpoints
- [ ] Overall visual hierarchy matches

---

## QUALITY STANDARD

The implementation should feel like it was built by the same designers who
created the reference.

Avoid:
- ❌ Approximation or guessing at a detail instead of checking the reference
- ❌ Missing details
- ❌ Inconsistent spacing
- ❌ Incorrect colours or raw hex values
- ❌ Different typography or component sizing
- ❌ Alternative layouts
- ❌ Unnecessary creativity
- ❌ Empty or generic placeholder data

Be strict — spacing, text positioning, button height, shadows, image
cropping, colour accuracy, and icon weight are all in scope, not just gross
layout.

---

## COMPLETION CRITERIA

Do not consider a screen complete until:
- [ ] The browser screenshot is visually indistinguishable from its reference,
      in both themes, at both breakpoints
- [ ] Every item in the pixel-perfect checklist passes
- [ ] The screen reuses existing design-system components and tokens — no new
      ad hoc styles or raw hex values introduced
- [ ] `Email` and `Templates` have their real data layer built, not just a
      restyled `EmptyState`
- [ ] TypeScript strict passes — no implicit `any`, explicit return types
      everywhere
- [ ] Money is integer pence in GBP; times are UTC in storage, `Europe/London`
      on screen; copy is British English; services are women's hair only

Only then mark the screen COMPLETE and automatically proceed to the next row
in the screen table, repeating this entire process until every row is built
and verified. Keep a running checklist of completed and remaining screens so
progress can resume seamlessly if interrupted.
