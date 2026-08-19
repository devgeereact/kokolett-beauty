# Kokolett Beauty — Design-Match Loop Prompt

Paste the block below into `/loop`. Swap `<SCREEN>` and `<REF>` per screen.

## Screens with a design reference

Every screen below has a mockup PNG in `docs/design/` to match pixel-for-pixel.
Verified 2026-08-14 against the shipped nav (`src/components/dashboard/DashboardLayout.tsx`)
and `src/lib/routes.ts` — every reference image maps 1:1 to a nav row or sub-route, no
ambiguity left.

| `<SCREEN>`            | `<REF>`                                 | Target page                       | Route                                                             | state                                                                                           |
| --------------------- | --------------------------------------- | --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| dashboard             | `docs/design/dashboard.png`             | `TodayPage.tsx`                   | `/dashboard`                                                      | done — see `docs/design/.loop/dashboard-log.md`                                                 |
| calendar              | `docs/design/calendar.png`              | `CalendarPage.tsx`                | `/dashboard/calendar`                                             | done — see `docs/design/.loop/calendar-log.md`                                                  |
| appointments          | `docs/design/appointment.png`           | `AppointmentsPage.tsx`            | `/dashboard/appointments`                                         | done — see `docs/design/.loop/appointment-log.md`                                               |
| approvals             | `docs/design/approval.png`              | `InboxPage.tsx` (`tab=approvals`) | `/dashboard/inbox?tab=approvals`                                  | done — see `docs/design/.loop/approval-log.md`                                                  |
| availability-requests | `docs/design/availability-request.png`  | `InboxPage.tsx` (`tab=requests`)  | `/dashboard/inbox?tab=requests`                                   | done — see `docs/design/.loop/availability-request-log.md`                                      |
| customers             | `docs/design/customer.png`              | `CustomersPage.tsx`               | `/dashboard/customers`                                            | done (card grid, not list — owner request) — see `docs/design/.loop/customer-log.md`            |
| services              | `docs/design/service.png`               | `ServiceMenuPage.tsx`             | `/dashboard/services`                                             | done (cards, already built that way — owner confirmed) — see `docs/design/.loop/service-log.md` |
| availability          | `docs/design/avalability.png`           | `WeeklyDefaultPage.tsx`           | `/dashboard/weekly`                                               | done — see `docs/design/.loop/availability-log.md`                                              |
| reports               | `docs/design/reports.png`               | `ReportsPage.tsx`                 | `/dashboard/reports`                                              | done — see `docs/design/.loop/reports-log.md`                                                   |
| assistant             | `docs/design/ai.png`                    | `AssistantPage.tsx`               | `/dashboard/assistant` — advisory only, no business-data mutation | done — see `docs/design/.loop/assistant-log.md`                                                 |
| notifications         | `docs/design/notification.png`          | `NotificationsPage.tsx`           | `/dashboard/notifications`                                        | done — see `docs/design/.loop/notification-log.md`                                              |
| email                 | `docs/design/email.png`                 | `EmailPage.tsx`                   | `/dashboard/email`                                                | done — see `docs/design/.loop/email-log.md`                                                     |
| templates             | `docs/design/templetes.png`             | `TemplatesPage.tsx`               | `/dashboard/templates`                                            | done — see `docs/design/.loop/templates-log.md`                                                 |
| template editor       | `docs/design/Email-Template-Editor.png` | `TemplateEditorPage.tsx`          | `/dashboard/templates/:key/edit`                                  | done — see `docs/design/.loop/templates-log.md`                                                 |
| settings              | `docs/design/settings.png`              | `SettingsPage.tsx`                | `/dashboard/settings`                                             | done — see `docs/design/.loop/settings-log.md`                                                  |

`AppointmentTypePage.tsx` (service length and price) has no reference image
and no direct nav row by design (reached only via `CalendarCapacityTabs`'s
in-page switcher from Calendar) — not in this list, don't build it against a
reference that doesn't exist.

`docs/design/logo.png` is a brand asset reference, not a screen — use it only
to verify the logo/wordmark rendering wherever it appears (header, auth,
marketing).

---

| app shell (sidebar · top bar · header) | already shipped — `docs/planning/owner-console-rebuild-plan.md`, merged to `main`. This loop is purely per-screen content. |
| tokens only | `docs/design/design-system.png` + `docs/design/design-token.png` |

## The prompt

ONE SCREEN AT A TIME.

PICK A SCREEN AND BUILD

Build the **<SCREEN>** screen so it visually matches `<REF>` as closely as possible.

### Ground rules (read before writing code)

1. Read `CLAUDE.md`. It is binding. Notably: this is a **static, offline-first PWA** —
   **React + TypeScript strict + Vite**, styled with **NativeWind/Tailwind classes only**,
   tokens from `tailwind.config.ts` / `src/index.css` — no inline styles, no raw hex.
   Import app code with `@/…` (maps to `src/`). SDK setup lives in `src/lib`, data calls in
   `src/services`, reusable logic in `src/hooks`. **Booking writes go through
   `book_appointment()`** — never a direct client insert. `pending_approval` holds a slot —
   availability logic must treat it as occupied. Money is integer pence, displayed in GBP;
   time is stored UTC, shown `Europe/London`. Copy is British English. **Women's hair
   only** — no nails, brows, lashes, or unisex services. The AI assistant
   (`AssistantPage.tsx`) is advisory only and must never mutate business data.
2. **Tokens before pixels.** Before touching any screen, read `docs/design/design-system.png`
   and `docs/design/design-token.png` and cross-check every colour, spacing, radius, and
   type value against `docs/DESIGN.md` and `tailwind.config.ts`. Every value you use
   afterwards must resolve to a token — no raw hex, no arbitrary `padding: 13px`. If a
   reference value isn't in the codebase yet, add it to `tailwind.config.ts` /
   `src/index.css` first and note it in the log (below) as an inferred value.
3. **You may run the app for this task.** Reuse an already-running `npm run dev` (port
   `5082`, `strictPort`) if one exists; do not boot a second. This is a static PWA — no
   native shell, no simulator — verification only counts if it happened in a real browser.
   Use the `/browse` skill to load the route and screenshot the implemented screen.

### Match target

Layout · spacing · typography (family, size, weight, line height, letter spacing) ·
colours and status semantics (approvals/requests/booked/cancelled) · button styles and
heights · input fields · border radius · shadows and elevation · icons (`lucide-react` via
`src/lib/icons.ts` only, consistent size/weight/spacing) · alignment and padding · the
sidebar/top-bar chrome · tables, charts, cards, dialogs, empty/loading states · visual
hierarchy.

Populate every screen with realistic salon data — never empty containers or generic
Lorem-ipsum placeholders. Money in GBP pence, times in `Europe/London`, services are
women's hair only, `pending_approval` bookings shown as occupying a slot.

Do not redesign or improvise. Never duplicate an existing component or invent a one-off
variant — reuse what's already in the design system. If the reference is ambiguous or
something is missing from it, implement the closest reasonable thing **and log it**
rather than inventing a different layout.

### The loop

Each iteration:

1. Implement / refine the screen. TypeScript strict, explicit return types on every
   function and hook.
2. `npm run build` (catches TypeScript/build errors) — must be clean before you
   screenshot. A build error means the iteration is not done.
3. Start the dev server if not already running (`npm run dev`, port `5082`), then use the
   `/browse` skill to load the route and screenshot the implemented screen into
   `docs/design/.loop/<SCREEN>-<N>.png` (`<N>` = iteration number, starting at 1. Create
   `docs/design/.loop/` if absent).
4. **Read your own screenshot back** with the Read tool, side by side with `<REF>`. Do not
   trust the code — trust the pixels.
5. Write the diffs to `docs/design/.loop/<SCREEN>-log.md`, appending a section per
   iteration: what differed, what you changed, what is still off, what you deliberately
   inferred. Read this log at the start of every iteration so you do not re-fix the same
   thing or oscillate between two wrong values.
6. Repeat.

Be strict. Look for: text baseline and vertical centering, button height and horizontal
padding, gap between stacked elements, corner radius (4 vs 8 vs 12 is visible), shadow
spread and opacity, icon weight and size, exact font weight (500 vs 600 is visible),
tabular-nums on money/timestamps, and colour accuracy (sample the hex from both images, do
not eyeball it) — and confirm status colours match their semantic meaning consistently
across cards, badges, and calendar cells.

### Repeat for both themes and both breakpoints

Do not consider a screen done after the first pass in one theme/breakpoint combination.
Once Steps 1–6 converge, repeat the whole verification pass for:

- Light theme and dark theme
- Mobile breakpoint (used stall-side during the day) and desktop breakpoint (used at
  close-out) — check real breakpoints, not just a squeezed browser window

### Stop conditions — stop when ANY of these is true

- The screenshot and the reference are indistinguishable at a glance, in all four
  theme/breakpoint combinations, and the last two iterations produced no new fixable
  diffs.
- You have completed **8 iterations**.
- The remaining diffs are all things you cannot fix from code (e.g. the reference uses an
  asset you do not have, or a font not in the project).

On stop, output: a short list of what still differs and why, plus every value you
inferred rather than read from the design system. Then automatically proceed to the next
row in the screen table, repeating this entire process until every row is built and
verified. Keep a running checklist of completed and remaining screens so progress can
resume seamlessly if interrupted.
