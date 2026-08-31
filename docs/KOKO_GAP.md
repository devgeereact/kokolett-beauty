# KOKO_GAP — Gap Analysis vs. the Transformation Brief

**Date:** 2026-08-29, updated through 2026-08-31 as P1/P2 items shipped (see §5's checked items for exact dates).
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
| Customer communication preferences | Owner-side toggle plus a customer-facing one on `/my` (session-scoped RPCs, `customer_from_session()`-gated) | ✅ | `supabase/migrations/0060_customer_communication_preferences.sql`, `customerSessionService.ts`, `useCustomerSession.ts`, `MyBookingsPage.tsx` | — | — | — |
| GDPR data export (subject access) | `export_customer_data()` — customer profile, appointments, payments, emails, availability requests, mailing-list status, as JSON download from the Customers page ("Export data" menu item). Same table list `eraseCustomer()` touches, read instead of deleted. | ✅ | `supabase/migrations/0056_customer_data_export.sql`, `src/pages/dashboard/CustomersPage.tsx` — verified live 2026-08-30 against production (full package returned, non-owner denied, audit row carries no personal data) | — | — | — |

### Business (Services, Payments, Reports, Reviews, Marketing)
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Service menu / catalogue | Real, with duration/image/order/active | ✅ | `ServiceMenuPage.tsx` → `ServicesCatalogue.tsx` | — | — |
| Reports (revenue/trends, CSV export) | Real charts + export | ✅ | `ReportsPage.tsx` (409 lines) | — | — |
| Google reviews | Cached sync, cron-triggered | ✅ | `google_reviews`/`google_place_snapshot`, `sync-reviews` Edge Function | — | — |
| Payment logging | Append-only `logPayment()` → `log_payment` RPC | ✅ | `paymentService.ts:10-22`, `0027_payment_log.sql` | — | — |
| Payment reconciliation (missing-payment detection) | `PaymentReconciliationCard` on Today, listing completed appointments (30-day window) with `paid_pence` of 0 — reuses `appointments_detailed.paid_pence`, no new query/table needed. Card now owns its own record-payment modal (`AppointmentDetailModal` reused directly) rather than only linking out. | ✅ | `src/components/dashboard/today/PaymentReconciliationCard.tsx`, `listUnpaidCompletedAppointments`/`filterUnpaidCompleted` in `src/services/appointmentService.ts`, tested in `appointmentService.test.ts` | — | — | — |
| Payment corrections | `payments.corrects_payment_id` links a correction row to the payment it corrects; amount check now allows negative only when linked (a plain payment must still be positive). `log_payment()` validates the link is on the same appointment. `AppointmentDetailModal` shows itemized payment history and a "this corrects an earlier payment" toggle with target + add/deduct direction pickers. | ✅ | `supabase/migrations/0059_payment_corrections.sql`, `src/services/paymentService.ts`, `src/hooks/useAppointmentActions.ts`, `src/components/dashboard/AppointmentDetailModal.tsx` | — | — | — |
| Daily close / end-of-day workflow | `/dashboard/daily-close` — live preview of today's numbers (scheduled/completed/cancelled, collected, unpaid completed, pending requests, failed emails) via read-only `daily_close_summary()`; a "Close day" button calls `close_day()`, which recomputes fresh and logs a `day.closed` audit row. Reuses `audit_events` — no new table. Re-closable, not blocked. | ✅ | `supabase/migrations/0054_daily_close.sql`, `0055_daily_close_split_preview.sql`, `src/pages/dashboard/DailyClosePage.tsx` — verified live 2026-08-30 against production (preview logs nothing, close logs exactly one row, non-owner denied) | Scoped to today only — no historical date picker, no "reopen a closed day" | — | — |

### Email subsystem
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Delivery state machine | `queued/sending/sent/failed/bounced/cancelled`, `attempts`, `last_error`, exponential backoff capped 6h, permanent-failure short-circuit (functions as dead-letter) | ✅ | `0002_salon.sql:257-272`, `send-emails/index.ts:23,41-44,90-98` | — | — |
| Outbox UI (all/sent/queued/failed, search, CSV export, delete, preview) | Real | ✅ | `EmailPage.tsx:40-45` (419 lines) | — | — |
| Templates (owner-editable overlay, opt-in gating) | Real, protects tested copy from a seeded draft | ✅ | `TemplatesPage.tsx`, `TemplateEditorPage.tsx`, `0032`/`0037` | — | — |
| Template version history | Append-only revision log, auto-logged by a trigger on real content changes; a "History" panel on the editor with Compare and Revert | ✅ | `supabase/migrations/0061_email_template_history.sql`, `TemplateHistoryPanel.tsx` | — | — | — |
| Suppressed / bounced lane | No async bounce/complaint ingestion (raw SMTP only) | 🟡 | `provider_id` column exists but unpopulated | No bounce-webhook feed since this is cPanel SMTP, not an API ESP. **Ruled infrastructure-blocked 2026-08-31 — see §5** — the only real option (IMAP-poll the mailbox and parse NDRs) is a project of its own, not a gap-fill. | P2 |
| Email diagnostics (SPF/DKIM/DMARC/SMTP status screen) | — | 🔴 | No such screen in-app (the actual DNS records are healthy per `~/.claude/CLAUDE.md`'s ops notes, just not surfaced in-app) | Owner can't self-diagnose a delivery problem from the dashboard | P3 |
| AI-drafted broadcast messaging | Rough idea → AI draft (`draft-copy` Edge Function) → owner-reviewed subject/body → send to confirmed, not-unsubscribed mailing-list subscribers only, queued through the existing outbox. Unsubscribe link on every broadcast email (new, previously nonexistent anywhere in the app). Same drafting reused on the one-off Compose modal and the customer-profile reply panel (deterministic templating there is now gone — `emailDrafts.ts` deleted). | ✅ | `supabase/migrations/0058_broadcast_messaging.sql`, `supabase/functions/draft-copy/index.ts`, `src/pages/dashboard/BroadcastsPage.tsx`, `src/pages/UnsubscribePage.tsx` — spec: `docs/superpowers/specs/2026-08-30-ai-broadcast-messaging-design.md` | — | — | — |

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
| Unit tests | 20 Vitest files, concentrated in pure logic/hooks | 🟡 | `lib/`, `hooks/`, a handful of `components/`/`services/`/`pages/` | Most service files and most pages have no test file | P2 |
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

### Second pass, 2026-08-30 (mechanical, already done)

Drift accumulated from migrations `0052`–`0058` (audit trail, system health,
daily close, GDPR export, `ai_recommendations` drop, broadcast messaging) and
the new `draft-copy` Edge Function.

| File | Fix |
|---|---|
| `CLAUDE.md:61` | "nine Deno Edge Functions" → "ten" |
| `AGENTS.md:46` | "nine Deno Edge Functions" → "ten" |
| `docs/ARCHITECTURE.md:20` | "9 Deno Edge Functions" → "10" |
| `docs/ARCHITECTURE.md` §6b | Added a third paragraph for `draft-copy` (a third AI surface, not covered before); removed "drafted replies" from `insights.ts`'s description — that capability was never in `insights.ts` (no such export), it lived in the now-deleted `emailDrafts.ts` |
| `CLAUDE.md`'s §6b pointer line | "Two things are called 'assistant'" → "Two AI assistants and a third drafting-only surface", with a `draft-copy` sentence added |
| `docs/SCHEMA.md:3` | Migration range "0001 through 0057" → "0001 through 0058" (the per-migration table itself already had rows through 0058; only the header text was stale) |
| `docs/SCHEMA.md` `audit_events` row | Action-vocabulary list "extended by `0054` and `0056`" → "extended by `0054`, `0056` and `0058`" |
| `supabase/config.toml` | Added the missing `[functions.draft-copy]` block (`verify_jwt = true` + rationale comment) — every other function already documents its posture there; this one didn't |
| `docs/KOKO_GAP.md` §5 P2 | Added the missing `[x]` line for AI-drafted broadcast messaging (every other shipped §3 row already had one) |
| `docs/GO-LIVE.md` / `docs/history/` | Split (§4 item 3, resolved): dated 2026-08-19 snapshot moved verbatim to `docs/history/2026-08-19-go-live-checklist.md`; `docs/GO-LIVE.md` rewritten as a slim, undated "stand up a fresh environment" procedure |
| `docs/plan.md` | §4 item 4, resolved: appended a note to the "docs drift fast" bullet recording this 2026-08-30 pass and a rough next-pass cadence |

### Open questions — recommended, not executed

These are judgment calls, not factual corrections, so they weren't auto-applied:

1. **`ai_recommendations` table** — ~~created by `0002`, RLS-policied, even seeded in the RLS test suite, but confirmed unused by any frontend/service code~~ **dropped 2026-08-30 (`0057`), owner-approved.** Confirmed unused by any frontend/service code (`src/lib/insights.ts` + `ai-assistant-chat` are the real assistant; neither ever touched this table). Explicitly does not affect the AI chat's ability to draft messages — that capability (`ai-assistant-chat`, one-off per-customer emails via `propose_email`, always rendered in an editable field for the owner to approve — `docs/RULES.md` §9.6) is untouched, and there is no bulk newsletter/ad-to-all-customers feature in the codebase to affect either way (checked: no "bulk send" path exists anywhere — `sendCustomEmailAsOwner` is explicitly one-off).

2. **CLAUDE.md / AGENTS.md overlap.** Not duplicates — different registers (CLAUDE.md = Claude Code session context + live coordinates + commands; AGENTS.md = generic cross-tool numbered directives). But three facts are restated in both with drifting detail:
   - Scope discipline ("women's hair only") — AGENTS.md's version is fuller (explains the `HairSalon` reasoning). No real disagreement, just verbosity difference — no action needed.
   - AI proposal/confirm boundary — CLAUDE.md:69 is one dense sentence; AGENTS.md:21-32 has the full mechanism (dispatcher-branch argument, untrusted-data fencing). Recommend CLAUDE.md's line become a one-sentence pointer to AGENTS.md's fuller version, so the two can't drift independently on a future edit. **This is a restructuring choice — present here, not executed.**
   - "No Inngest" — consistent in both, no drift, no action.

3. ~~**`docs/GO-LIVE.md`** self-describes as a dated 2026-08-19 snapshot... two options, neither picked~~ **Resolved 2026-08-30 (option a): split.** The dated completion snapshot moved verbatim to `docs/history/2026-08-19-go-live-checklist.md`; `docs/GO-LIVE.md` is now a slim, undated "stand up a fresh environment" procedure (env template, Supabase project setup, dashboard data entry, verification checklist), pointing to `docs/DEPLOYMENT.md` for build/deploy mechanics rather than duplicating them.

4. ~~**`docs/plan.md`** — ... Optionally add one bullet... the user's call, not applied here~~ **Resolved 2026-08-30.** Appended a note to `plan.md`'s "docs drift fast" bullet recording this second pass and a rough cadence for the next one.

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
- [x] Email template version history (diff/revert) — done: `supabase/migrations/0061_email_template_history.sql` (append-only `email_template_revisions`, logged by a trigger on real subject/html_body changes), "History" panel on the template editor with a side-by-side Compare and a Revert action. Verified live against production (rolled-back-transaction SQL validation, then a real template round trip in the browser — caught and fixed a real bug where the History panel didn't refresh after a save until reload). Test revisions cleaned up.
- [x] Payment correction linkage (mark one row as correcting another) — done: `supabase/migrations/0059_payment_corrections.sql`, `payments.corrects_payment_id`, itemized history + correction UI in `AppointmentDetailModal`. Verified live against production (rolled-back-transaction SQL validation, then a real test appointment end-to-end; caught and fixed a wrong-default-selection bug and a flexbox width bug in the correction-target select). Test data cleaned up.
- [x] Customer-facing self-service communication preferences — done: `supabase/migrations/0060_customer_communication_preferences.sql`, a "Communication preferences" checkbox on `/my` letting a customer toggle her own `marketing_consent` via session-scoped RPCs. Verified live against production (rolled-back-transaction SQL validation, then a real test customer round trip in the browser). Test data cleaned up.
- [ ] Email suppressed/bounced lane — **ruled infrastructure-blocked, 2026-08-31, not being built.** `bounced` is a valid `email_messages.status` value in the state machine (`0002_salon.sql`) but nothing ever sets it — confirmed by reading `send-emails/index.ts`: it only ever writes `sending`/`sent`/`queued`(retry)/`failed`, and `failed` there means the SMTP call itself rejected synchronously (bad recipient at connect time), not an async bounce. A real bounce/complaint lane needs either (a) an ESP webhook, which cPanel's raw SMTP relay has no equivalent of, or (b) polling the `booking@` mailbox over IMAP for bounce/NDR messages and parsing them, which is a real feature (new Edge Function, IMAP client, mailbox credentials as a new secret, parsing heuristics for provider-specific bounce formats) — not a gap-fill, a project of its own. Left undone rather than half-built; revisit only if bounce volume becomes an actual operational problem (nothing today suggests it has).
- [x] `ai_recommendations` drop migration — done: `supabase/migrations/0057_drop_ai_recommendations.sql`, owner-approved 2026-08-30. See §4 item 1 for confirmation this doesn't touch AI message-drafting.
- [x] AI-drafted broadcast messaging — done: `supabase/migrations/0058_broadcast_messaging.sql`, `/dashboard/broadcasts`. New `draft-copy` Edge Function drafts subject/body from a rough idea; owner reviews and sends to confirmed, not-unsubscribed mailing-list subscribers via the existing outbox. New unsubscribe link on every broadcast email (previously nonexistent anywhere in the app), click-to-confirm plus RFC 8058 `List-Unsubscribe` headers. Same drafting engine reused on the one-off Compose modal and the customer-profile reply panel (`emailDrafts.ts`'s deterministic templating deleted). Verified live against production; final whole-branch review caught and fixed 4 issues before shipping (unsubscribe-on-load, missing deliverability header, half-done audit tab, reply-panel error state). **Full round-trip verified live 2026-08-30**: real self-subscribe → real one-recipient send → real delivery (Gmail, DKIM/SPF/DMARC all pass) → real click → `unsubscribed_at` set — then cleaned up (test subscriber + its queued email deleted). This also caught and fixed a real deploy gap: the whole frontend (`dist/`) had never actually been shipped to `kokolettbeauty.com`'s live docroot after this feature's work, only committed to git — the unsubscribe link 404'd until `cpanel-deploy` actually ran. Deployed and re-verified; test data removed.
- [ ] Broaden unit-test coverage to service files and pages currently untested — **in progress, 2026-08-31**: added `redact.test.ts` (magic-link token redaction before Sentry — the highest-risk untested file in the repo), `csv.test.ts`, `requestStatus.test.ts`, `appointmentsDateRange.test.ts`, `requestSlots.test.ts` (222 tests total, up from 208). Most `services/*.ts` files remain untested — many are thin Supabase RPC/`.from()` wrappers with little logic of their own to assert on, so the remaining value is concentrated in a handful of files with real branching (`dashboardService.ts`, `reportsService.ts`, `insights.ts` already has coverage). Not closing this item — it names an open-ended standard, not a finishable task.

**P3**
- [ ] Shared `DataTable`/`Timeline`/`Tooltip`/`Dropdown`/`Tabs` UI primitives (each page currently hand-rolls its own — cosmetic/DX debt, not a functional gap).
- [ ] Product-event/analytics instrumentation — deliberately low priority for a single-owner product.
- [ ] Undo layer for cancellation/reschedule.
- [ ] Email configuration diagnostic screen.
- [ ] Bulk customer-session revocation.

**Judgment call, not a priority-ranked gap:**
- Notifications persistence — currently a computed feed (no stored `notifications` table; `notificationsService.ts` says so directly) with `localStorage` read-state per device. This may be a legitimate simplicity tradeoff for a single-owner app rather than a gap to fix — a real table would only pay off if read-state needs to survive across devices/browsers, at the cost of a write path and a migration. Flagged for a decision, not assigned a P-number.

## 6. Scope boundary

This document, and the mechanical doc corrections applied in §4, do **not** authorise building anything listed 🔴/🟡 above. Each checklist item in §5 needs its own separate plan and explicit approval before any code or migration is written.
