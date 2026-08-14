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

**Already shipped, don't redo:** the token reconciliation (card/popover shadow,
spacing/grid/breakpoint docs), the `lucide-react` icon system
(`src/lib/icons.ts`), the app icon/favicon set, and the grouped sidebar nav itself
(`docs/planning/owner-console-rebuild-plan.md`, merged to `main`). This loop is
purely the *content* of each screen — the shell around it is done.

`@docs/design/logo.png` is a brand asset reference, not a screen — use it only to
verify the logo/wordmark rendering wherever it appears (header, auth, marketing).

## 1. Screen list

Verified 2026-08-14 against the shipped nav (`src/components/dashboard/
DashboardLayout.tsx`) and `src/lib/routes.ts` — every reference image now maps
1:1 to a nav row, no ambiguity left. `AppointmentTypePage.tsx` (service length
and price) has no reference image and no direct nav row by design (reached only
via `CalendarCapacityTabs`'s in-page switcher from Calendar) — not in this list.

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
| 12 | `email.png` | Communications › Email | `EmailPage.tsx` | `/dashboard/email` — **currently an `EmptyState` stub.** This row is real feature work (the `email_messages` outbox log, docs/SCHEMA.md §10), not pure visual polish — build the actual query/list, not just restyle the placeholder. |
| 13 | `templetes.png` | Communications › Templates | `TemplatesPage.tsx` | `/dashboard/templates` — **currently an `EmptyState` stub**, same caveat as Email: real read-only template-list UI, not just a restyle. |
| 14 | `settings.png` | Account › Settings | `SettingsPage.tsx` | `/dashboard/settings` |

`avalability.png` is the only availability image that exists (filename typo, kept
as-is — do not create/expect a correctly-spelled duplicate). Not to be confused
with row 5, `availability-request.png`, which is a different, correctly-named
file for a different screen.

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
