# KOKO_GAP — Gap Analysis vs. the Transformation Brief

**Date:** 2026-08-29, updated through 2026-08-30 as P1/P2 items shipped (see §5's checked items for exact dates).
**Scope:** Verified against the actual codebase (frontend, Supabase schema, Edge Functions, cron, tests), not against what docs or the brief *claim* exists.

## 0. Framing

Kokolett Beauty stays a **single-owner salon operating system**, not a multi-tenant SaaS. This isn't a new decision made by this document — it's already settled in `docs/PRD.md:190` under "§10 Out of scope for V1," and this repo's schema, RLS, and every doc are already single-business shaped (no `tenant_id`, no organisation model anywhere).

`docs/GPT.md` is the original, unedited 901-line "Enterprise Product Transformation Prompt (→ multi-tenant SaaS)" — kept as an input artifact, not a plan the repo is executing. This document is its verified, single-owner-framed successor: every item below was checked against actual file:line evidence, not assumed complete because a page/table/function *sounds* like it exists.

## 1. Legend

| Status | Meaning |
|---|---|
| ✅ COMPLETE | Built, wired end-to-end, verified in code |
| 🟡 PARTIAL | Some of it exists; specific piece named as missing |
| 🔴 MISSING | Nothing found |
| ⚠️ BROKEN | Exists but doesn't work as intended |
| 🗑️ OBSOLETE | Exists in schema/code but is dead — confirmed unused |
| 🔍 NEEDS VERIFICATION | Couldn't confirm from static reading alone |

Columns: **Feature | Current implementation | Status | Evidence | What's missing | Risk | Impact | Dependencies | Recommended fix | Priority**

## 2. Already done — not gaps

The brief assumed several things were missing that are, in fact, built. Listed first so they aren't mistaken for surprises buried in the matrix below.

- **RLS test suite** — `supabase/tests/rls_test.sql` (457 lines, 49 assertions, anon/non-owner/owner × 22 tables, run in CI). Seeds every sensitive table before probing (a 2026-08-20 fix — a naive "anon sees 0 rows" test would pass vacuously on an empty table).
- **AI governance** (propose-only, owner-confirms, no autonomous writes) — `supabase/functions/ai-assistant-chat/index.ts`. `propose_booking`/`propose_email` end the model's turn and hand a proposal object to the client; no dispatcher branch executes either as a write. Runs under the caller's own JWT (not service role), so a non-owner gets a working chat that reads nothing. Tool results are fenced (`<<<RECORDS ... RECORDS>>>`) against prompt injection.
- **Approvals + Requests → Inbox merge** — `src/pages/dashboard/InboxPage.tsx`, tabbed. `/dashboard/approvals` and `/dashboard/requests` are intentional `<Navigate>` redirects (`src/lib/routes.ts:40-51`, `@deprecated` on the old constants) preserving old bookmarks.
- **`/subscribe`** — real feature (mailing-list opt-in, deliberately unlinked from nav for pasting into an Instagram bio), not a dead route.
- **PWA offline/update UX** — `src/components/UpdatePrompt.tsx` (autoUpdate, hourly poll, non-destructive "reload when ready" banner), `src/components/OfflineBanner.tsx` + `useOnlineStatus.ts`, `src/components/InstallPrompt.tsx`.
- **Security account card** — real MFA/TOTP (`supabase.auth.mfa.*`), password change, changeable secret-login slug — `src/components/dashboard/settings/AccountSecurityCard.tsx`, `0051_secret_owner_login.sql`.
- **GDPR erasure** — `eraseCustomer()` → `erase_customer_as_owner` RPC, reaches four tables (mailing list, enquiries, outbox, access tokens) per `0042`/`0044`.
- **Booking race protection** — GiST exclusion constraint (`appointments_no_overlap`, `0002_salon.sql:204-210`) stops same-slot double-booking; `pg_advisory_xact_lock(hashtext('book_day:'...))` (`0039_book_appointment_input_rules.sql:145`) stops the daily-capacity-cap race. Both quoted, both live in `book_appointment()`'s current definition. What's *not* done is an automated end-to-end test proving it (see §5 P1) — the DB-level protection itself is solid.
- **`book_appointment()` as sole write path** — confirmed by the RLS suite itself: anon direct INSERT into `appointments` raises `42501` (`rls_test.sql:408-410`).

## 3. Gap matrix

### Today / Owner dashboard
| Feature | Current implementation | Status | Evidence | What's missing | Risk | Impact | Priority |
|---|---|---|---|---|---|---|---|
| Today command centre | Glance grid, payment log, approvals/availability cards, schedule timeline, assistant insights | ✅ | `TodayPage.tsx` (480 lines) | — | — | — | — |
| Owner Action Queue | Combined Approvals+Requests queue, stats, detail panel | ✅ | `InboxPage.tsx` (403 lines) | — | — | — | — |
| Command palette (⌘K) | Search/jump launcher, tested | ✅ | `QuickActionLauncher.tsx:208-213,353` | — | — | — | — |
| System health / diagnostics page | `/dashboard/system-health` — pg_cron job status (via `cron.job_run_details`, already populated, no new logging needed), email queued/failed counts, Google reviews sync staleness, build version | ✅ | `supabase/migrations/0053_system_health.sql`, `src/pages/dashboard/SystemHealthPage.tsx` — verified live 2026-08-30 against production (real job history, non-owner correctly denied) | — | — | — | — |
| Application version display | Build-time git short SHA + timestamp, injected via Vite `define`, shown at the top of the System Health page | ✅ | `vite.config.ts`, `src/vite-env.d.ts` | — | — | — | — |
| Scheduled-job run monitoring | `system_health_summary()` reads `cron.job` + latest `cron.job_run_details` row per job — no new table | ✅ | Same migration as above | — | — | — | — |

### Calendar / Availability / Bookings
| Feature | Current implementation | Status | Evidence | What's missing | Risk | Priority |
|---|---|---|---|---|---|---|
| Calendar (day/week/month/agenda), drag-reschedule | Full views, `useAppointmentDrag.ts` (tested) | ✅ | `CalendarPage.tsx` (546 lines) | — | — | — |
| Weekly default template + closures | Repeating week generator + deliberate-closure fencing | ✅ | `WeeklyDefaultPage.tsx`, `weekly_template`/`day_decided` tables | — | — | — |
| Availability requests queue | Full queue, offer-slot flow | ✅ | Part of `InboxPage.tsx` | — | — | — |
| Booking engine (`book_appointment()`) | Sole write path, race-protected (see §2) | ✅ | `0039_book_appointment_input_rules.sql` | — | — | — |
| Booking-race E2E proof | Two-customer concurrent-booking test (`e2e/booking-race.spec.ts`), calls `book_appointment()` directly against the live project, asserts one winner + one `SLOT_TAKEN`, cleans up via owner sign-in + `set_appointment_status`/`delete_appointment_as_owner` | ✅ | `e2e/booking-race.spec.ts` — run live 2026-08-29 with `KOKO_OWNER_EMAIL`/`KOKO_DEV_PASSWORD` set, passed, cleanup ran with no errors | — | — | — |
| E2E test framework | Playwright installed and wired (`@playwright/test`, `playwright.config.ts`, `npm run test:e2e`), runs against a real `vite build && vite preview` | ✅ | `playwright.config.ts`, `e2e/marketing-site.spec.ts` (4 read-only smoke tests, passing) | Not yet wired into CI (`.github/workflows/ci.yml` untouched — needs a decision on whether CI gets its own Supabase test data/secrets before it can run the write-based race test) | Regressions still only caught locally, not in CI | P2 |
| Undo layer (cancellation/reschedule) | — | 🔴 | No "Undo · Ns" pattern found | Accidental cancellation is not reversible without redoing the booking | Low | P3 |

### Customers
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Customer CRM (profile, history, notes, marketing consent, erasure) | `CustomersPage.tsx` + `CustomerDetailPanel.tsx` | ✅ | 436 lines | — | — |
| Customer timeline | History shown as a flat list, not a timeline visualisation | 🟡 | No dedicated `Timeline` component; `ScheduleTimeline.tsx` is day-schedule-specific, not per-customer | Visual unified event history per customer | P3 |
| Customer communication preferences | Owner-side marketing-consent toggle only | 🟡 | `customerService.ts:121-131`, `CustomerDetailPanel.tsx:91-116` | No customer-facing self-service preference centre | P2 |
| GDPR data export (subject access) | `export_customer_data()` — customer profile, appointments, payments, emails, availability requests, mailing-list status, as JSON download from the Customers page ("Export data" menu item). Same table list `eraseCustomer()` touches, read instead of deleted. | ✅ | `supabase/migrations/0056_customer_data_export.sql`, `src/pages/dashboard/CustomersPage.tsx` — verified live 2026-08-30 against production (full package returned, non-owner denied, audit row carries no personal data) | — | — | — |

### Business (Services, Payments, Reports, Reviews, Marketing)
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Service menu / catalogue | Real, with duration/image/order/active | ✅ | `ServiceMenuPage.tsx` → `ServicesCatalogue.tsx` | — | — |
| Reports (revenue/trends, CSV export) | Real charts + export | ✅ | `ReportsPage.tsx` (409 lines) | — | — |
| Google reviews | Cached sync, cron-triggered | ✅ | `google_reviews`/`google_place_snapshot`, `sync-reviews` Edge Function | — | — |
| Payment logging | Append-only `logPayment()` → `log_payment` RPC | ✅ | `paymentService.ts:10-22`, `0027_payment_log.sql` | — | — |
| Payment reconciliation (missing-payment detection) | `PaymentReconciliationCard` on Today, listing completed appointments (30-day window) with `paid_pence` of 0 — reuses `appointments_detailed.paid_pence`, no new query/table needed | ✅ | `src/components/dashboard/today/PaymentReconciliationCard.tsx`, `listUnpaidCompletedAppointments`/`filterUnpaidCompleted` in `src/services/appointmentService.ts`, tested in `appointmentService.test.ts` | Links out to the Appointments list rather than a one-click "record payment" inline on the card itself | Low — the record-payment flow already exists on that page | — |
| Payment corrections | "Correction" = insert another payment row; no void/negative/linkage semantics | 🟡 | `payments` table, append-only, `amount_pence > 0` check | No way to mark one row as correcting another | P2 |
| Daily close / end-of-day workflow | `/dashboard/daily-close` — live preview of today's numbers (scheduled/completed/cancelled, collected, unpaid completed, pending requests, failed emails) via read-only `daily_close_summary()`; a "Close day" button calls `close_day()`, which recomputes fresh and logs a `day.closed` audit row. Reuses `audit_events` — no new table. Re-closable, not blocked. | ✅ | `supabase/migrations/0054_daily_close.sql`, `0055_daily_close_split_preview.sql`, `src/pages/dashboard/DailyClosePage.tsx` — verified live 2026-08-30 against production (preview logs nothing, close logs exactly one row, non-owner denied) | Scoped to today only — no historical date picker, no "reopen a closed day" | — | — |

### Email subsystem
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Delivery state machine | `queued/sending/sent/failed/bounced/cancelled`, `attempts`, `last_error`, exponential backoff capped 6h, permanent-failure short-circuit (functions as dead-letter) | ✅ | `0002_salon.sql:257-272`, `send-emails/index.ts:23,41-44,90-98` | — | — |
| Outbox UI (all/sent/queued/failed, search, CSV export, delete, preview) | Real | ✅ | `EmailPage.tsx:40-45` (419 lines) | — | — |
| Templates (owner-editable overlay, opt-in gating) | Real, protects tested copy from a seeded draft | ✅ | `TemplatesPage.tsx`, `TemplateEditorPage.tsx`, `0032`/`0037` | — | — |
| Template version history | Toggle opt-in/off only | 🟡 | No revision/diff/revert table or UI | Editing overwrites in place, no rollback to a prior version | P2 |
| Suppressed / bounced lane | No async bounce/complaint ingestion (raw SMTP only) | 🟡 | `provider_id` column exists but unpopulated | No bounce-webhook feed since this is cPanel SMTP, not an API ESP | P2 |
| Email diagnostics (SPF/DKIM/DMARC/SMTP status screen) | — | 🔴 | No such screen in-app (the actual DNS records are healthy per `~/.claude/CLAUDE.md`'s ops notes, just not surfaced in-app) | Owner can't self-diagnose a delivery problem from the dashboard | P3 |

### Security / Privacy
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| MFA/TOTP, password change, secret-login slug | Real | ✅ | `AccountSecurityCard.tsx`, `0051` | — | — |
| Secret owner login hardening | Rate-limited (5/15min), IP-hashed, audited to `secret_login_attempts`, nightly purge | ✅ | `0051_secret_owner_login.sql` | — | — |
| Active session list / per-session revoke | Only shows `last_sign_in_at` | 🟡 | `AccountSecurityCard.tsx:19-21` (comment: needs Supabase admin API, not client-exposable) | Full session list/revoke | External constraint (Supabase admin API), not neglect | P2 |
| Audit trail (appointment lifecycle, customer erasure, payment logging, login-slug change) | `audit_events` table (SELECT-only, no write policy for anyone including the owner), `log_audit_event()` called from `set_appointment_status`/`approve_appointment`/`reject_appointment`/`create_appointment_as_owner`/`reschedule_appointment_as_owner`/`delete_appointment_as_owner`/`erase_customer_as_owner`/`log_payment`/`set_owner_login_slug`, read-only `/dashboard/audit` page | ✅ | `supabase/migrations/0052_audit_trail.sql`, `src/pages/dashboard/AuditPage.tsx` — verified live 2026-08-29 against production (all 9 target actions logged correctly, non-owner denied, direct insert denied even for owner) | The ~15 direct client-side `.update()` mutations (owner notes, customer detail edits, settings/template edits, service-menu edits, subscribers, profile) are **not** covered — no single server-side hook point exists for them, deliberately left out of this MVP | Follow-up, not urgent at staff=1 | P3 (follow-up) |
| General security-events feed (RLS denials, auth failures) | Only the narrow secret-login lockout log exists | 🔴 | Same as above | No broad security-event visibility | P2 |
| Magic-link security (rate limit, single-use, expiry, revocation) | Real | ✅ | `customer_access_tokens` (`0002`), `customer-access` Edge Function | Bulk "revoke all sessions for this customer" | P3 |

### Analytics
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Product-event instrumentation | Sentry only (error monitoring) | 🔴 | No PostHog/Plausible/Mixpanel/gtag anywhere | No booking funnel, no conversion tracking | Explicitly **lower priority than a SaaS reading would give it** — this is a single-owner product where an owner glancing at Reports covers most of what a funnel would show | P3 |

### PWA / Offline
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Offline-safe booking blocking | Not separately checked in this pass | 🔍 | `OfflineBanner.tsx` exists; whether write actions specifically are blocked offline wasn't verified line-by-line | — | — |
| Update UX, install prompt | Real | ✅ | See §2 | — | — |
| App version visibility | Git short SHA + build timestamp, shown on the System Health page | ✅ | See Today/Owner dashboard section above (`0053_system_health.sql`) | — | — |

### Testing
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Unit tests | 21 Vitest files, concentrated in pure logic/hooks | 🟡 | `lib/`, `hooks/`, a handful of `components/`/`services/`/`pages/` | Most service files and most pages have no test file | P2 |
| RLS/security tests | Thorough, CI-run | ✅ | See §2 | — | — |
| E2E tests | Playwright framework + a real booking-race test | ✅ | See Calendar/Bookings section (`e2e/marketing-site.spec.ts`, `e2e/booking-race.spec.ts`) | Customer-journey and full owner-journey E2E tests still don't exist — only the race scenario and marketing-site smoke tests | P2 |

### Docs governance
See §4 below for the specific file-level fixes.

## 4. Files that contradict each other / need delete, merge, or update

### Applied in this pass (mechanical, already done)

| File | Fix |
|---|---|
| `CLAUDE.md:61` | "seven Deno Edge Functions" → "nine" |
| `AGENTS.md:46` | "seven Deno Edge Functions" → "nine" |
| `docs/ARCHITECTURE.md:20` | "7 Deno Edge Functions" → "9" |
| `docs/SCHEMA.md:3` | Migration range "0001 through 0047" → "0001 through 0051" |
| `docs/SCHEMA.md` migration table | Added rows for `0048`–`0051` |
| `docs/SCHEMA.md` table inventory | Added `secret_login_attempts`; live-table count 22→23, created count 24→25 |
| `docs/SCHEMA.md` §3 `staff` | Added `login_slug`/`login_slug_updated_at` columns |
| `docs/SCHEMA.md` §7 cron jobs | "Six jobs" → "Seven jobs"; added `purge-secret-login-attempts` row |

### Open questions — recommended, not executed

These are judgment calls, not factual corrections, so they weren't auto-applied:

1. **`ai_recommendations` table** — created by `0002`, RLS-policied, even seeded in the RLS test suite, but confirmed unused by any frontend/service code (`src/lib/insights.ts` + `ai-assistant-chat` are the real assistant; neither touches this table). Both `docs/SCHEMA.md` and this repo's other docs already correctly mark it dead. Dropping it requires a migration — **not authorised by this document**. Flagged as a P2/P3 code-change candidate only.

2. **CLAUDE.md / AGENTS.md overlap.** Not duplicates — different registers (CLAUDE.md = Claude Code session context + live coordinates + commands; AGENTS.md = generic cross-tool numbered directives). But three facts are restated in both with drifting detail:
   - Scope discipline ("women's hair only") — AGENTS.md's version is fuller (explains the `HairSalon` reasoning). No real disagreement, just verbosity difference — no action needed.
   - AI proposal/confirm boundary — CLAUDE.md:69 is one dense sentence; AGENTS.md:21-32 has the full mechanism (dispatcher-branch argument, untrusted-data fencing). Recommend CLAUDE.md's line become a one-sentence pointer to AGENTS.md's fuller version, so the two can't drift independently on a future edit. **This is a restructuring choice — present here, not executed.**
   - "No Inngest" — consistent in both, no drift, no action.

3. **`docs/GO-LIVE.md`** self-describes as a dated 2026-08-19 snapshot ("done, verified 2026-08-19 21:45 UTC" style markers throughout) yet is still listed in `CLAUDE.md`'s "load these first" table as if it were live evergreen reference. Two options, neither picked:
   - (a) Split: keep a slim, undated "how to redo go-live for a fresh environment" procedure live in `docs/GO-LIVE.md`, move the dated 2026-08-19 completion snapshot into `docs/history/`.
   - (b) Leave as-is, add one header sentence marking it explicitly historical.

4. **`docs/plan.md`** — no conflict found with PRD.md or GPT.md (different altitude: live flat punch-list vs. product spec vs. hypothetical transformation prompt). Its own "docs drift fast" item (dated 2026-08-24) is effectively the ancestor of this exact exercise — the drift found this time (Edge Function count, job count, migration range, `secret_login_attempts`/`staff` columns) accumulated *since* that pass. Optionally add one bullet to `plan.md`'s open items noting "next docs-drift pass due" — the user's call, not applied here.

5. **`docs/GPT.md`** — left as-is. It already defers to the docs when they disagree ("if a claim here and a claim in those files disagree, those files win"), so no correction is strictly needed. Optionally add one header line noting the multi-tenant direction was reviewed and declined in favour of this document's framing — optional, not applied.

## 5. Prioritized checklist — what needs to be done

**P0 — none found.** Worth stating explicitly: nothing here is a live production risk or a broken, blocking item. Several things the original brief assumed were gaps (RLS tests, AI governance, booking-race DB protection, Inbox merge) are already done.

**P1**
- [x] Stand up an E2E test framework — done: `@playwright/test`, `playwright.config.ts`, `npm run test:e2e` / `test:e2e:ui`.
- [x] Write the automated two-customer booking-race test — done: `e2e/booking-race.spec.ts`. Run live 2026-08-29 against the real Supabase project (`KOKO_OWNER_EMAIL`/`KOKO_DEV_PASSWORD` set): passed — one customer's `book_appointment()` call won, the other failed with `SLOT_TAKEN`, owner-session cleanup (cancel + hard delete) ran cleanly.
- [x] Payment reconciliation view — done: `PaymentReconciliationCard` on Today, flags completed appointments (last 30 days) with no logged payment.

**P2**
- [x] Audit trail (`audit_events` table + UI) — done: `supabase/migrations/0052_audit_trail.sql`, `/dashboard/audit`. Scoped to the highest-risk actions (appointment lifecycle, customer erasure, payment logging, login-slug change); verified live against production. Follow-up: the ~15 direct client-side `.update()` mutations with no single server-side hook point are not covered.
- [x] System health / diagnostics page + scheduled-job run monitoring — done: `supabase/migrations/0053_system_health.sql`, `/dashboard/system-health`. No new table — reads pg_cron's own `cron.job_run_details`, already populated. Verified live against production.
- [x] Application version display in the UI — done: git short SHA + build timestamp, injected at build time, shown on the System Health page.
- [x] Daily close / end-of-day workflow — done: `supabase/migrations/0054_daily_close.sql`/`0055_daily_close_split_preview.sql`, `/dashboard/daily-close`. Reuses `audit_events` (a new `day.closed` action) rather than a new table. Verified live against production.
- [x] GDPR customer data export — done: `supabase/migrations/0056_customer_data_export.sql`, "Export data" on the Customers page. Reuses `audit_events` (a new `customer.data_exported` action) rather than a new table. Verified live against production.
- [ ] Email template version history (diff/revert).
- [ ] Payment correction linkage (mark one row as correcting another).
- [ ] Customer-facing self-service communication preferences.
- [ ] Email suppressed/bounced lane (needs bounce-webhook ingestion, currently SMTP-only).
- [ ] `ai_recommendations` drop migration — **decision needed first, not authorised by this document.**
- [ ] Broaden unit-test coverage to service files and pages currently untested.

**P3**
- [ ] Shared `DataTable`/`Timeline`/`Tooltip`/`Dropdown`/`Tabs` UI primitives (each page currently hand-rolls its own — cosmetic/DX debt, not a functional gap).
- [ ] Product-event/analytics instrumentation — deliberately low priority for a single-owner product.
- [ ] Undo layer for cancellation/reschedule.
- [ ] Email configuration diagnostic screen.
- [ ] Bulk customer-session revocation.

**Judgment call, not a priority-ranked gap:**
- Notifications persistence — currently a computed feed (no stored `notifications` table; `notificationsService.ts` says so directly) with `localStorage` read-state per device. This may be a legitimate simplicity tradeoff for a single-owner app rather than a gap to fix — a real table would only pay off if read-state needs to survive across devices/browsers, at the cost of a write path and a migration. Flagged for a decision, not assigned a P-number.

## 6. Scope boundary

This document, and the mechanical doc corrections applied in §4, do **not** authorise building anything listed 🔴/🟡 above. Each checklist item in §5 needs its own separate plan and explicit approval before any code or migration is written. The `ai_recommendations` drop is a schema migration and is likewise not authorised here.
