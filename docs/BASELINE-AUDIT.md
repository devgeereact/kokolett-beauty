# Baseline Audit — Docs vs. Code (Phase 0, Task 1)

Date: 2026-08-13
Scope: reconcile `docs/PRD.md` and `docs/ARCHITECTURE.md` against the actual mounted
routes (`src/App.tsx`, `src/lib/routes.ts`) and the code those routes render. Read-only;
no source file was modified to produce this report, and the DB/RLS was not touched
(out of scope per the task brief — `docs/SCHEMA.md` claims are treated as context only).

Every row below is grounded in a file this session actually read. Line numbers refer to
the file state at commit `acc7117` (current `main` tip at the time of this audit).

---

## 1. Route inventory

Source of truth read: `src/App.tsx` (mount list) cross-checked against `src/lib/routes.ts`
(route constants) and `src/components/dashboard/DashboardLayout.tsx` (sidebar `entries`,
`src/components/dashboard/DashboardLayout.tsx:40-50`, and header links, `:174-188` /
`:91-98`).

| Path | Component | Status | Reachable from nav? |
| --- | --- | --- | --- |
| `/` | `HomePage` | live | Yes — `SiteShell` wordmark/home link (`src/components/public/SiteShell.tsx:44-49`) |
| `/book` | `BookPage` | live | Yes — `HomePage` hero/CTA (`src/pages/HomePage.tsx:66-71,123-128,223-228`), `SiteShell` header + footer |
| `/request-availability` | `RequestAvailabilityPage` | live | Yes — `HomePage:229-234`, `SiteShell:219-226` |
| `/subscribe` | `SubscribePage` | live | **No in-app link.** Only referenced as an external URL string shown in `SettingsPage` for the owner to copy elsewhere (`src/pages/dashboard/SettingsPage.tsx:208`); by the page's own doc comment it is meant to be "pasted somewhere: an Instagram bio…" (`src/pages/SubscribePage.tsx:11-14`) |
| `/access/:token` | `MyBookingsPage` | live | No — reached only via a magic-link email, by design. **Hard-coded path string** in `App.tsx:57`, not `routes.customer.access(token)` |
| `/my` | `MyBookingsPage` | live | Yes — `SiteShell:31`, `HomePage:72-77` |
| `/my/appointments` | `MyBookingsPage` (same component, no distinct behaviour) | live | No in-app link targets this path specifically (only `routes.customer.home` = `/my` is linked); `MyBookingsPage` does not branch on `location.pathname` (checked, no `useLocation` in the file) |
| `/privacy` | `PrivacyPage` | live | Yes — `SiteShell:245-247` |
| `/booking-policy` | `BookingPolicyPage` | live | Yes — `SiteShell:227-234` |
| `/terms` | `TermsPage` | live | Yes — `SiteShell:248-250` |
| `/login` | `LoginPage` | live | Yes — `SiteShell:251-253` ("Salon sign in"). **Hard-coded path string** in `App.tsx:65`, `ProtectedRoute.tsx:32`, `SiteShell.tsx:251`, not `routes.auth.login` |
| `/reset-password` | `ResetPasswordPage` | live | No in-app link — reached only via the password-reset email `LoginPage` sends (`src/pages/LoginPage.tsx:61-71`) |
| `/dashboard` | `TodayPage` | live | Yes — sidebar "Today" (`DashboardLayout.tsx:41`) |
| `/dashboard/approvals` | `ApprovalsPage` | live | **Not in sidebar.** Reachable only via the "Awaiting approval" stat card on `TodayPage` (`src/pages/dashboard/TodayPage.tsx:145-150`) |
| `/dashboard/appointments` | `AppointmentsPage` | live | Yes — sidebar "Appointments" (`DashboardLayout.tsx:43`) |
| `/dashboard/requests` | `AppointmentsPage` (a tab, `RequestsPanel`) | live | Yes — sidebar "Requests" (`DashboardLayout.tsx:44`) |
| `/dashboard/customers` | `CustomersPage` | live | Yes — sidebar "Customers" (`DashboardLayout.tsx:45`) |
| `/dashboard/appointment` | `AppointmentTypePage` | live (194-line real page) | **No — orphaned.** Zero references to `routes.owner.appointmentType` or the literal path anywhere outside `App.tsx`'s own mount (checked with `grep -rn` across `src/`) |
| `/dashboard/services` | `ServiceMenuPage` | live | Yes — sidebar "Services" (`DashboardLayout.tsx:46`) |
| `/dashboard/settings` | `SettingsPage` | live | Yes — sidebar "Settings" (`DashboardLayout.tsx:49`) |
| `/dashboard/calendar` | `CalendarPage` | live | Yes — sidebar "Calendar" (`DashboardLayout.tsx:42`) |
| `/dashboard/weekly` | `WeeklyDefaultPage` | live (468-line real page) | **No — orphaned.** Zero references to `routes.owner.weeklyDefault` or the literal path anywhere outside `App.tsx`'s own mount (checked with `grep -rn` across `src/`, including `CalendarPage.tsx`) |
| `/dashboard/assistant` | `AssistantPage` | live — **real page, not a redirect** | Yes — sidebar "AI Assistant" (`DashboardLayout.tsx:48`) |
| `/dashboard/reports` | `ReportsPage` | live — **real page, not a redirect** | Yes — sidebar "Reports" (`DashboardLayout.tsx:47`) |
| `/dashboard/notifications` | `NotificationsPage` | live | **Not in sidebar.** Reachable via the header bell icon in `DashboardLayout.tsx:174-188` |
| `/dashboard/profile` | `ProfilePage` | live | **Not in sidebar.** Reachable via the account/email link in `DashboardLayout.tsx:91-98` |
| `*` (catch-all) | `NotFoundPage` | live (real 404 page, 16 lines) | n/a |

**Declared in `src/lib/routes.ts` but not mounted anywhere in `App.tsx`:**

| Constant | Path | Finding |
| --- | --- | --- |
| `routes.public.about` | `/about` | No page, no route. Unused constant (`grep -rn "routes.public.about" src/` → 0 hits outside `routes.ts`) |
| `routes.public.services` | `/services` | No page, no route. **But it is used** as an outbound `href` in `ServiceMenuPage.tsx:159` ("View on website") — clicking it hits `NotFoundPage`. Dead link. |
| `routes.public.gallery` | `/gallery` | No page, no route. Unused constant |
| `routes.public.testimonials` | `/testimonials` | No page, no route. Unused constant |
| `routes.public.faqs` | `/faqs` | No page, no route. Unused constant |
| `routes.public.contact` | `/contact` | No page, no route. Unused constant |
| `routes.customer.appointment(reference)` | `/my/appointments/:reference` | Function itself is never called anywhere in `src/` (`grep -rn "routes.customer.appointment("` → 0 hits). No route mounted. |
| `routes.owner.customer(id)` | `/dashboard/customers/:id` | Function itself is never called anywhere in `src/` (`grep -rn "routes.owner.customer("` → 0 hits). No route mounted. `CustomersPage.tsx` shows customer detail via in-page `selected` state (`src/pages/dashboard/CustomersPage.tsx:30,183-287`), not routing. |

**Route-inventory verdict:** `src/lib/routes.ts` and `src/App.tsx` do **not** fully agree.
Eight constants in `routes.ts` have no matching mounted route, one of them (`/services`)
is an active dead link, and two components (`AppointmentTypePage`, `WeeklyDefaultPage`)
are fully built but reachable by nobody except someone typing the URL.

---

## 2. PRD reconciliation

Source: `docs/PRD.md`.

| PRD claim | File(s) checked | Verdict |
| --- | --- | --- |
| §7 "Marketing site — Home, About, Services, Gallery, Testimonials, FAQs, Contact, Privacy, Booking Policy, Terms" | `src/pages/HomePage.tsx` (full read), `src/components/public/SiteShell.tsx` (full read) | **Partial/stale.** Home, a Services section (`HomePage.tsx:138` `id="services"`), Privacy, Booking Policy and Terms are real. Testimonials is loosely covered by a Google-reviews block (`src/components/public/Reviews.tsx`) embedded on Home, not a separate page. About, Gallery, FAQs and Contact do not exist as pages *or* as sections — `HomePage.tsx` has exactly five `<section>`s (hero, next-available, services, how-it-works, closing CTA) and none of them is About/Gallery/FAQ/Contact content. |
| §4.2 "Availability Request … owner inbox … new / awaiting response / converted / declined states, filtering, priority indicators, one-click 'offer this slot'" | `src/components/dashboard/RequestsPanel.tsx` (full read), `src/services/requestService.ts` | **Partial.** One-click offer exists (`offerSlotToRequest`, imported at `RequestsPanel.tsx:11`) and the four states exist in the DB enum (`src/types/index.ts:31` `AvailabilityRequestStatus`). But there is no status filter control and no "priority" field/indicator anywhere in `RequestsPanel.tsx` or `requestService.ts` (`grep -n "priority"` → 0 hits in both files) — the panel only ever shows the open queue. |
| §7 "Owner dashboard — … approvals queue …" | `src/pages/dashboard/ApprovalsPage.tsx`, `src/components/dashboard/DashboardLayout.tsx:40-50` | **Partial.** The page is real and functional, but it is not one of the 9 sidebar entries — only reachable via a stat card on Today. `DashboardLayout`'s `badges` prop accepts `{ approvals?: number; requests?: number }` (`DashboardLayout.tsx:34`) and `TodayPage` passes `badges={{ approvals: …, requests: … }}` (`src/pages/dashboard/TodayPage.tsx:159-162`), but the `entries` array only wires `badge: badges?.requests` onto the "Requests" entry (`DashboardLayout.tsx:44`) — `badges.approvals` is accepted and silently dropped. |
| §7 "AI assistant (advisory only) — matches cancellations to waiting requests, flags under-utilised days, surfaces repeatedly requested unavailable windows, recommends opening-hours changes, drafts customer replies. Output is a recommendation with status `pending`." | `src/pages/dashboard/AssistantPage.tsx` (full read), `src/services/assistantService.ts` (partial read), `src/lib/insights.ts` (partial read) | **Matches the behavioural contract, differs on mechanism.** Eight real advisory modules exist (`AssistantPage.tsx:14-22`: conflicts, reschedule, email drafting, messages, analytics, trends, repeat customers, cancellation risk), computed from real appointment/customer/availability data, and nothing auto-executes (`AssistantPage.tsx:27-29` doc comment). But there is no `status: pending` recommendation object anywhere — see Architecture §6b below for the mechanism gap. |
| §7 "Reports — revenue, bookings, returning-customer rate, cancellation rate, no-show rate, popular services, peak hours, review requests, trends" | `src/pages/dashboard/ReportsPage.tsx` (132 lines, exists), `src/services/reportsService.ts` (exists) | **Appears to match** — real page wired to real data (consistent with commit `3d8a11f "Build the Reports page: day-of-week/peak-hour charts, top customers"`). Not verified metric-by-metric against the page body — flagged as a doubt below. |
| §7 Email automation list (booking held/confirmed/declined, reminder, rescheduled, cancelled, completed, review request, availability request received/offer — "all retried on failure") | `supabase/functions/send-emails` (directory exists, not read in depth), `src/hooks/useInngestDispatch.ts` (exists) | **Not fully verified** — Edge Function body was not read for this task (out of scope: server-side email content). Client-side dispatch plumbing exists. Flagged as a doubt. |
| §11 "Out of scope for V1" (multiple stylists, deposits, SMS, WhatsApp, POS, etc.) | Repo-wide `grep` for `staff_id`, SMS/payment SDKs — none found incidentally during this audit | **Consistent** with what was observed, though not exhaustively grepped for this task. |
| *(not in PRD at all)* mailing-list subscribe feature | `src/pages/SubscribePage.tsx` (full read), `src/services/subscriberService.ts` | **Reverse drift** — a real, shipped feature (`routes.public.subscribe`, mounted `App.tsx:55`) is not mentioned anywhere in `docs/PRD.md`. |

---

## 3. Architecture reconciliation

Source: `docs/ARCHITECTURE.md`.

| ARCHITECTURE claim | File(s) checked | Verdict |
| --- | --- | --- |
| §2 directory layout, `services/` list: `serviceCatalogService`, `availabilityService`, `bookingService`, `appointmentService`, `customerService`, `availabilityRequestService`, `reportingService`, `aiAssistantService`, `notificationService` | `ls src/services/` (17 files) | **Stale.** Four are simply renamed in the real tree: `availabilityRequestService` → `requestService.ts`, `reportingService` → `reportsService.ts`, `aiAssistantService` → `assistantService.ts`, `notificationService` → `notificationsService.ts`. Eight more exist and are undocumented: `bookingSettingsService.ts`, `customerSessionService.ts`, `dashboardService.ts`, `profileService.ts`, `reviewService.ts`, `serviceMenuService.ts`, `settingsService.ts`, `subscriberService.ts`. |
| §3 routing table — public routes `/about`, `/gallery`, `/testimonials`, `/faqs`, `/contact`, `/services` · `/services/:slug`, `/book/:serviceSlug` | `src/App.tsx` (full read) | **Stale.** None of these are mounted routes (see §1 above). `/book/:serviceSlug` in particular does not exist — `BookPage` is only mounted at the bare `/book`. |
| §3 routing table — owner route `/dashboard/availability` "Hours, breaks, closures, booking rules" | `src/lib/routes.ts:46`, `src/App.tsx:87-90` | **Stale/renamed.** The actual mounted path is `/dashboard/weekly` (`routes.owner.weeklyDefault`), rendering `WeeklyDefaultPage`. No `/dashboard/availability` route exists at all. (This is also the orphaned route flagged in §1 — real, but unlinked from any nav.) |
| §3 routing table omits `/dashboard/appointment`, `/dashboard/notifications`, `/dashboard/profile` | `src/App.tsx:79-98` | These three routes exist and are mounted in the current app but are absent from ARCHITECTURE's table — the table is missing rows, not just wrong ones. |
| §3 "Every path is declared once in `src/lib/routes.ts` — nothing hard-codes a path string" | `src/App.tsx:57,65`, `src/components/ProtectedRoute.tsx:32`, `src/components/public/SiteShell.tsx:251` | **Contradicted.** `/access/:token` and `/login` are hard-coded string literals in `App.tsx`, and `/login` is separately hard-coded again in `ProtectedRoute.tsx` and `SiteShell.tsx` instead of using `routes.customer.access(...)` / `routes.auth.login`. |
| §3 "`ProtectedRoute` gates owner routes on Supabase session **and** `is_owner()`. A signed-in user who is not in `staff` gets a 403 view, not the dashboard." | `src/components/ProtectedRoute.tsx` (full read) | **Matches**, modulo wording: it's a client-side "No access" view (`ProtectedRoute.tsx:64-76`), not a literal HTTP 403, but the gating logic (`useSupabaseAuth` + `useIsOwner`) and the "sign in ≠ dashboard access" behaviour are as described. |
| §4 "Booking flow: `useBookingFlow` owns a single reducer for service → date → slot → details → review" | `src/hooks/` (`ls`, 22 files — no `useBookingFlow.ts`), `src/pages/BookPage.tsx:57-62` | **Stale.** No `useBookingFlow` hook exists anywhere in the repo (`grep -rln "useBookingFlow" src/` → 0 hits). `BookPage.tsx` manages the flow with five independent `useState` calls directly in the page component, not a reducer, and not in a hook. |
| §4 "`useRealtimeAppointments` subscribes to Postgres changes on `appointments`" | `src/hooks/useRealtimeAppointments.ts` (file exists; not read in depth) | File present as claimed — not fully verified internally, flagged as a light doubt. |
| §4 "Customer magic-link sessions … held in `useCustomerSession`" | `src/hooks/useCustomerSession.ts` (file exists) | **Matches.** |
| §6b AI boundary — "The assistant runs entirely in an Edge Function. It reads schedule and request data, produces recommendations, and writes them to `ai_recommendations` with status `pending`. It has no write access to `appointments`, `customers`, or `availability_*`." | `src/services/assistantService.ts` (partial read), `src/lib/insights.ts` (partial read), `ls supabase/functions/` (`_shared`, `calendar-feed`, `customer-access`, `owner-password-reset`, `send-emails`, `sync-reviews` — no AI function), `grep -rln "ai_recommendations" src/` → only `src/types/index.ts` and `src/types/database.types.ts` (generated types, unused) | **Major, load-bearing drift.** There is no Edge Function for AI. The advisory modules are computed live, client-side, by a pure deterministic/statistical TypeScript module (`src/lib/insights.ts`, doc comment at `:1-10`: "nothing in this file talks to Supabase, and nothing here mutates data") over data the dashboard already fetched via `assistantService.ts`. No code anywhere reads or writes `ai_recommendations`. The safety *property* ARCHITECTURE describes (advisory-only, no autonomous mutation) does hold in the real code — but the stated mechanism (LLM in an Edge Function, `pending`-status recommendation rows, structural write-boundary) does not exist. |
| §6a background-workflows table, row `ai/daily-insights` — `pg_cron` 06:00 — "Writes advisory rows to `ai_recommendations`" | Same as above | **Consistent with the same drift** — since nothing writes to `ai_recommendations`, this scheduled job's described effect does not happen in the application layer. Whether a `pg_cron` job actually exists in the database was **not checked** (DB inspection is out of scope for this task) — flagged as a doubt rather than a confirmed absence. |

---

## 4. Drift found — summary

The concrete discrepancies that matter for planning the next 6 phases:

1. **The plan's own assumption about `/dashboard/reports` and `/dashboard/assistant` being
   redirects is stale.** Both are fully built, real pages today (`ReportsPage`,
   `AssistantPage`, mounted at `src/App.tsx:92-93`), consistent with recent commits
   `3d8a11f` and `85f199a`. There is no `<Navigate>` anywhere in `App.tsx` (confirmed by
   grep) — no route in this app currently redirects to another.

2. **Two fully built dashboard pages are orphaned.** `/dashboard/appointment`
   (`AppointmentTypePage`, 194 lines) and `/dashboard/weekly` (`WeeklyDefaultPage`, 468
   lines) are mounted and functional but have zero inbound links anywhere in the
   codebase — no sidebar entry, no button, no cross-link from a related page (Services,
   Calendar, Settings). The only way to reach either is typing the URL. Any phase that
   assumes these features are discoverable by the owner is planning against a page
   nobody can find.

3. **The sidebar nav (9 entries) under-represents the mounted route set.** `Approvals`,
   `Appointment type`, `Weekly hours`, `Notifications` and `Profile` are all real,
   working pages that are absent from `DashboardLayout`'s `entries` array
   (`DashboardLayout.tsx:40-50`). Approvals and the two header items (Notifications,
   Profile) are reachable through secondary UI; the other two are not reachable at all
   (see #2).

4. **`routes.ts` and `App.tsx` disagree** — 8 route constants exist with no matching
   mounted route (`about`, `services`, `gallery`, `testimonials`, `faqs`, `contact`,
   `customer.appointment(ref)`, `owner.customer(id)`). One of them, `/services`, is
   actively linked from `ServiceMenuPage.tsx:159` ("View on website") and is a live dead
   link that 404s today.

5. **ARCHITECTURE.md's public routing table describes a multi-page marketing site
   (About/Gallery/Testimonials/FAQs/Contact/Services-detail) that was never built.** The
   real `HomePage` is a single scrolling page with five sections; none of those five
   marketing pages exist as either routes or in-page sections. This is the single
   biggest gap between the documented information architecture and the shipped site.

6. **The AI Assistant's real architecture is entirely different from what ARCHITECTURE.md
   describes.** No Edge Function, no LLM, no `ai_recommendations` table read/write
   anywhere in the app. It is a client-side, deterministic insights engine
   (`src/lib/insights.ts`) computed on page load from data the dashboard already has. The
   *product* promise (advisory-only, human-in-the-loop) holds; the *documented
   mechanism* (server-hosted, recommendation-queue-based, cron-scheduled) does not exist
   in code and should not be assumed by later phases.

7. **`services/` naming has drifted** — four services were renamed after
   ARCHITECTURE.md's directory listing was written, and eight newer services aren't
   listed at all. A later phase reading ARCHITECTURE.md to find "the availability
   request service" will look for a file that doesn't exist (`requestService.ts` is the
   real name).

8. **`useBookingFlow` (the reducer ARCHITECTURE.md attributes the booking flow's state
   management to) does not exist.** `BookPage.tsx` manages its own flow state locally
   with five separate `useState` hooks. Any phase planning to touch booking-flow state
   should expect to find it in the page component, not in a shared hook.

9. **Not every documented path is declared in `routes.ts` as claimed.** `/login` and
   `/access/:token` are hard-coded string literals in three separate files
   (`App.tsx`, `ProtectedRoute.tsx`, `SiteShell.tsx`) rather than routed through the
   `routes` constant, contradicting ARCHITECTURE.md's explicit claim that nothing
   hard-codes a path string.

10. **A shipped feature (the `/subscribe` mailing-list page) is undocumented in PRD.md**,
    and conversely **PRD's "priority indicators" and "filtering" for the availability
    request inbox are not implemented** in `RequestsPanel.tsx`. Drift runs in both
    directions — docs ahead of code in places, code ahead of docs in others.

### Doubts / not fully verified (flagged, not asserted)

- `ReportsPage.tsx` and `reportsService.ts` were confirmed to exist and be substantial,
  but individual metrics (returning-customer rate, no-show rate, etc.) were not checked
  line-by-line against the PRD's list.
- `supabase/functions/send-emails` was confirmed to exist but its body was not read —
  the "all branded, all logged, all retried on failure" claim in PRD §7 was not verified
  against its implementation.
- `useRealtimeAppointments.ts` was confirmed to exist but not read in depth.
- Whether a `pg_cron` job named `ai/daily-insights` still exists in the live database
  was not checked — DB inspection is explicitly out of scope for this task. Given that
  no application code reads or writes `ai_recommendations`, such a job (if it exists)
  would currently be a no-op from the app's perspective, but this was not confirmed
  against the database itself.
