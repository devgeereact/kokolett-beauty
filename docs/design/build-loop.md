# Build Loop — Owner Dashboard Visual Rebuild

Rebuild every dashboard screen to closely match the reference designs in
`docs/design/`. This is a static PWA (no native shell, no simulator) — verification
happens in a real browser via the `/browse` skill.

## 0. Load design system first (once, before any screen)

Read `@docs/design/design-system.png` and `@docs/design/design-token.png` before
touching any screen. Cross-check every colour, spacing, radius, and type value
against `docs/DESIGN.md`, `tailwind.config.ts`, and `src/index.css`. If a token in
the reference isn't in the codebase yet, add it to `tailwind.config.ts` /
`src/index.css` first — don't hardcode a raw hex value into a component.

`@docs/design/logo.png` is a brand asset reference, not a screen — use it only to
verify the logo/wordmark rendering wherever it appears (header, auth, marketing).

## 1. Screen list

For each row: confirm the target page component is actually the right match
before implementing (grep `src/pages/dashboard/` — some reference files map to
more than one candidate page, noted below). Work top to bottom.

| # | Reference image | Target page (verify first) | Notes |
|---|---|---|---|
| 1 | `dashboard.png` | `src/pages/dashboard/TodayPage.tsx` | Command-center / today view |
| 2 | `calendar.png` | `src/pages/dashboard/CalendarPage.tsx` | |
| 3 | `availability.png` | `src/pages/dashboard/WeeklyDefaultPage.tsx` | Compare against `avalability.png` too — likely the same screen, duplicate/typo filename. Confirm which is current before using both. |
| 4 | `appointment.png` | `src/pages/dashboard/AppointmentsPage.tsx` | Could also be `AppointmentTypePage.tsx` — confirm which the reference actually shows (list view vs. type/duration config) |
| 5 | `approval.png` | Approval queue — check `AppointmentsPage.tsx` / `InboxPage.tsx` | `pending_approval` requests view per booking policy (docs/SCHEMA.md §11) |
| 6 | `customer.png` | `src/pages/dashboard/CustomersPage.tsx` | |
| 7 | `service.png` | `src/pages/dashboard/ServiceMenuPage.tsx` | |
| 8 | `reports.png` | `src/pages/dashboard/ReportsPage.tsx` | |
| 9 | `settings.png` | `src/pages/dashboard/SettingsPage.tsx` | |
| 10 | `notification.png` | `src/pages/dashboard/NotificationsPage.tsx` | |
| 11 | `ai.png` | `src/pages/dashboard/AssistantPage.tsx` | Advisory only — no business-data mutation |
| 12 | `email.png` | Check `InboxPage.tsx` vs. a transactional email surface | Confirm target before implementing |
| 13 | `templetes.png` | Email/message templates — check `SettingsPage.tsx` or `InboxPage.tsx` | No dedicated route found yet; confirm where templates actually live before building |

## 2. Per-screen procedure (repeat for every row above)

Build the [SCREEN NAME] screen by closely recreating the UI from
`@docs/design/[FILE]`.

Match as accurately as possible:
* Layout and spacing
* Typography, font sizes, and font weights
* Colors and gradients
* Button styles
* Input fields
* Border radius
* Shadows and depth
* Icons and imagery
* Alignment and padding
* Overall visual hierarchy

Use the existing project structure and styling system — NativeWind/Tailwind classes
only, tokens from step 0. TypeScript strict, explicit return types. Do not redesign
or improvise unless something is missing from the reference.

Verify in the real browser:
1. Start the dev server (`npm run dev`, port 5082) if not already running.
2. Use the `/browse` skill to load the route and screenshot the implemented screen.
3. Compare that screenshot against the reference image.

Then iterate:
1. Identify all visual differences.
2. Update the implementation.
3. Re-screenshot with `/browse`.
4. Compare again.
5. Repeat until implementation is visually as close to the reference as possible.

Check both light and dark theme (`ThemeProvider`, `.dark` on `<html>`), and both
mobile and desktop breakpoints — this dashboard is used on a phone during the day
and a desktop at close-out.

Be strict with the comparison: spacing, text positioning, button height, shadows,
image cropping, color accuracy, icon weight.

Do not stop after the first implementation of a screen. Keep refining until the
browser screenshot and the reference design look nearly identical, then move to the
next row in the table.

## 3. Done condition

Every row in the screen list has a browser screenshot that's visually
indistinguishable from its reference image, in both themes, at both breakpoints.
