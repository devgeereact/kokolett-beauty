# KOKO_GAP — Gap Analysis vs. the Transformation Brief

**Date:** 2026-08-29, updated through 2026-09-03 as P1/P2 items shipped (see §5's checked items for exact dates). Two passes ran on 2026-09-03: a PWA production audit (§4's fourth pass, §7) and, after it deployed, a full production-readiness audit covering functional QA, responsive, navigation, conversion, SEO, social, accessibility, performance, security, privacy, analytics, error handling, content, media, trust, forms, links, code quality and production config (§8). The second found three P1s the first did not look for.
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

- **RLS test suite** — `supabase/tests/rls_test.sql` (572 lines, 59 assertions, anon/non-owner/owner × 24 tables, run in CI). Seeds every sensitive table before probing (a 2026-08-20 fix — a naive "anon sees 0 rows" test would pass vacuously on an empty table).
- **AI governance** (propose-only, owner-confirms, no autonomous writes) — `supabase/functions/ai-assistant-chat/index.ts`. `propose_booking`/`propose_email` end the model's turn and hand a proposal object to the client; no dispatcher branch executes either as a write. Runs under the caller's own JWT (not service role), so a non-owner gets a working chat that reads nothing. Tool results are fenced (`<<<RECORDS ... RECORDS>>>`) against prompt injection.
- **Approvals + Requests → Inbox merge** — `src/pages/dashboard/InboxPage.tsx`, tabbed. `/dashboard/approvals` and `/dashboard/requests` are intentional `<Navigate>` redirects (`src/lib/routes.ts:40-51`, `@deprecated` on the old constants) preserving old bookmarks.
- **`/subscribe`** — real feature (mailing-list opt-in, deliberately unlinked from nav for pasting into an Instagram bio), not a dead route.
- **PWA offline/update UX** — `src/components/UpdatePrompt.tsx` (autoUpdate, hourly poll, and a brief "Updating" notice that announces the reload rather than asking permission for it), `src/components/OfflineBanner.tsx` + `useOnlineStatus.ts`, `src/components/InstallPrompt.tsx`.
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
| Undo layer (cancellation) | The generic Toast `action` (label+onClick, 8s auto-dismiss) already existed and `TodayPage.changeStatus()` already wired it up for every status change — the DB just never allowed `cancelled` to transition anywhere. Now it does, and `AppointmentsPage`/`CalendarPage` got the same Undo-toast wiring `TodayPage` already had | ✅ | `supabase/migrations/0063_undo_cancellation.sql`, `TodayPage.tsx`, `AppointmentsPage.tsx`, `CalendarPage.tsx` | Reschedule-undo is deliberately not covered — `rescheduleAppointmentAsOwner` retires the old row and creates a new one (`0024`), so undo there means cancelling the new booking and reviving the old one, a real slot-conflict/email design question of its own | Low | P3 |

### Customers
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Customer CRM (profile, history, notes, marketing consent, erasure) | `CustomersPage.tsx` + `CustomerDetailPanel.tsx` | ✅ | 436 lines | — | — |
| Customer timeline | A real connected-dot timeline, colour-coded by status, newest first, showing the cancellation/rejection reason where there is one | ✅ | `CustomerTimeline.tsx`, used by `CustomerDetailPanel.tsx`'s History tab | — | — |
| Customer communication preferences | Owner-side toggle plus a customer-facing one on `/my` (session-scoped RPCs, `customer_from_session()`-gated) | ✅ | `supabase/migrations/0060_customer_communication_preferences.sql`, `customerSessionService.ts`, `useCustomerSession.ts`, `MyBookingsPage.tsx` | — | — |
| GDPR data export (subject access) | `export_customer_data()` — customer profile, appointments, payments, emails, availability requests, mailing-list status, as JSON download from the Customers page ("Export data" menu item). Same table list `eraseCustomer()` touches, read instead of deleted. | ✅ | `supabase/migrations/0056_customer_data_export.sql`, `src/pages/dashboard/CustomersPage.tsx` — verified live 2026-08-30 against production (full package returned, non-owner denied, audit row carries no personal data) | — | — | — |

### Business (Services, Payments, Reports, Reviews, Marketing)
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Service menu / catalogue | Real, with duration/image/order/active | ✅ | `ServiceMenuPage.tsx` → `ServicesCatalogue.tsx` | — | — |
| Reports (revenue/trends, CSV export) | Real charts + export | ✅ | `ReportsPage.tsx` (409 lines) | — | — |
| Google reviews | Cached sync, cron-triggered | ✅ | `google_reviews`/`google_place_snapshot`, `sync-reviews` Edge Function | — | — |
| Payment logging | Append-only `logPayment()` → `log_payment` RPC | ✅ | `paymentService.ts:10-22`, `0027_payment_log.sql` | — | — |
| Payment reconciliation (missing-payment detection) | `PaymentReconciliationCard` on Today, listing completed appointments (30-day window) with `paid_pence` of 0 — reuses `appointments_detailed.paid_pence`, no new query/table needed. Card owns its own record-payment modal (`AppointmentDetailModal` reused directly) rather than only linking out. Briefly removed on 2026-08-31 and restored the same day, now paired with the AI assistant card as two `lg:col-span-6` cells sharing a row. | ✅ | `src/components/dashboard/today/PaymentReconciliationCard.tsx`, `listUnpaidCompletedAppointments`/`filterUnpaidCompleted` in `src/services/appointmentService.ts`, tested in `appointmentService.test.ts` | — | — |
| Payment corrections | `payments.corrects_payment_id` links a correction row to the payment it corrects; amount check now allows negative only when linked (a plain payment must still be positive). `log_payment()` validates the link is on the same appointment. `AppointmentDetailModal` shows itemized payment history and a "this corrects an earlier payment" toggle with target + add/deduct direction pickers. | ✅ | `supabase/migrations/0059_payment_corrections.sql`, `src/services/paymentService.ts`, `src/hooks/useAppointmentActions.ts`, `src/components/dashboard/AppointmentDetailModal.tsx` | — | — | — |
| Daily close / end-of-day workflow | `/dashboard/daily-close` — live preview of today's numbers (scheduled/completed/cancelled, collected, unpaid completed, pending requests, failed emails) via read-only `daily_close_summary()`; a "Close day" button calls `close_day()`, which recomputes fresh and logs a `day.closed` audit row. Reuses `audit_events` — no new table. Re-closable, not blocked. | ✅ | `supabase/migrations/0054_daily_close.sql`, `0055_daily_close_split_preview.sql`, `src/pages/dashboard/DailyClosePage.tsx` — verified live 2026-08-30 against production (preview logs nothing, close logs exactly one row, non-owner denied) | Scoped to today only — no historical date picker, no "reopen a closed day" | — | — |

### Marketing, SEO and social

Added 2026-08-31. The gap matrix had no row for search visibility, structured data,
meta tags, social profiles or business-identity consistency, so none of the faults
below had ever been recorded. Full detail in `docs/SOCIAL_PROFILE.md` §9.

| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Per-route metadata | `useDocumentMeta` now sets title, description, canonical, Open Graph, Twitter and robots per route, and a two-level `BreadcrumbList`. Called from every public route, including the six that previously set nothing. | ✅ | `src/hooks/useDocumentMeta.ts`, `docs/HOOKS.md` §21 | — | — |
| Structured data | One `HairSalon` entity with `@id`, `sameAs`, `founder`, real `areaServed` and a live `hasOfferCatalog` built from `service_menu`, plus a `WebSite` node. The Testimonials rating carries the same `@id` instead of declaring a second salon. | ✅ | `index.html`, `src/pages/TestimonialsPage.tsx`, `src/pages/ServicesPage.tsx` | Nothing. `geo` was added 2026-08-31 from the ONS centroid for SE28 8RX; swap for the exact profile pin only if it differs meaningfully | — |
| Business identity, one source | `src/lib/business.ts`. The contact email had been redeclared in four files and the site origin in about sixteen. | ✅ | `src/lib/business.ts`, `docs/RULES.md` §9.9 | Deno edge functions keep their own copy; they cannot import from `src/` | — |
| Locality correctness | Thamesmead everywhere, matching the verified Google profile. The site had said Woolwich, which is SE18. | ✅ | `docs/SOCIAL_PROFILE.md` §1.2 | — | — |
| Owner name | Christy everywhere. The AI prompt said Koko, and two seeded email templates signed off as "Koko Lett". | ✅ | `0065_copy_dashes_and_owner_name.sql`, `ai-assistant-chat/index.ts` | — | — |
| Locs advertised but not offered | Retired from `service_menu`, the JSON-LD, every meta description, the footer, the FAQ and the AI grounding prompt. | ✅ | `0066_retire_locs.sql`, `docs/RULES.md` §9.10 | — | — |
| Indexable gallery images | `PhotoCard` renders a real `<img>` with alt text. It was painting a CSS `background-image` on an `aria-hidden` div, so the salon's own work carried no alt text and could not appear in image search at all. | ✅ | `src/components/ui/PhotoCard.tsx` | — | — |
| Social card | 1200x630 card, `summary_large_image`. Both OG and Twitter had pointed at the square PWA app icon. | ✅ | `public/icons/social-card.png`, `scripts/generate-social-card.py` | — | — |
| Apex to www redirect | 301 in `.htaccess`. Canonical, sitemap and OG all use `www.`, so the apex had been an uncanonicalised duplicate of the whole site. | ✅ | `.htaccess` | Untested against the live host until the next deploy | P2 |
| No em or en dashes in copy | `npm run lint:copy` in CI, hookify rule widened to the paths that were leaking. | ✅ | `scripts/check-copy.py`, `.github/workflows/ci.yml` | — | — |
| Google review link, read vs write | `booking_settings.google_review_url` held a `share.google` redirect and was used for both reading and writing. Every read surface (footer icon, each review card, "Read all reviews on Google", the Testimonials call to action) sent people to the same place as the review request. Read surfaces now build a profile URL from the Place ID; the write link appears only on explicit "Leave a review" actions and in the email. | ✅ | `buildGoogleProfileUrl` in `src/lib/business.ts`, `Reviews.tsx`, `TestimonialsGrid.tsx`, `SiteShell.tsx`, `docs/SOCIAL_PROFILE.md` §2.1 | — | — |
| Google Business Profile and Instagram | Documented field by field, ready to paste. Not yet applied to the live profiles. | 🟡 PARTIAL | `docs/SOCIAL_PROFILE.md` §3, §4 | The owner has to apply it, and confirm the attributes in §3.9 | P1 |
| Cloudflare origin lock | Present on every other domain since 2026-08-24 but **absent here**, and direct-to-origin was answering 200 with the real site, bypassing the WAF. Now committed to the repo's `.htaccess` so a deploy cannot drop it again. | ✅ | `.htaccess`, `docs/DEPLOYMENT.md` §1, verified 403 direct / 200 proxied / 200 on `/.well-known/` | Header-based, so forgeable. The real boundary is Authenticated Origin Pulls, which needs WHM access this account does not have | P3 |
| Search Console | Sitemap not submitted, no re-index requested after the canonical and title changes | 🔴 MISSING | `public/sitemap.xml` is live and correct | Needs the owner's Google account; cannot be done from here | P1 |
| 404 canonicalised to the home page | `NotFoundPage` set `noindex` with no `path`, so it kept `index.html`'s canonical. The SPA rewrite answers every unknown path with 200, so any mistyped or shared broken link rendered a page saying both "this is the home page" and "do not index this". A `noindex` can be attributed to the canonical target. | ✅ | `useDocumentMeta.ts`, regression tests in `useDocumentMeta.test.ts` and `e2e/marketing-site.spec.ts` | — | — |
| Head state leaked between routes | The `headOwner` guard skipped cleanup wholesale, so a 404's `noindex` and a subpage's breadcrumb survived onto the next page. Every write is now unconditional, so the newer page's state is complete. | ✅ | `useDocumentMeta.ts` | — | — |
| Today grid left a hole | The schedule card is `lg:row-span-2`, so row 2 is 9 columns wide, not 12. A span-6 chart left columns 10 to 12 empty and pushed a half-width card alone onto the last row. | ✅ | `TodayPage.tsx`: chart now span-9, the payments/AI pair share a full row, requests span-12. Every row sums to 12. | — | — |
| Copy gate had four blind spots | `/*` inside a string literal blanked real copy; SQL quote state was counted per line so a `--` inside a multi-line literal hid a dash; the opt-out marker was substring-matched file-wide; and `supabase/functions/` was not scanned at all. | ✅ | `scripts/check-copy.py`, all three false negatives verified caught | — | — |
| `business.ts` and `index.html` could drift undetected | 13 constants are hand-keyed a second time into the JSON-LD, and nothing compared them. | ✅ | `src/lib/structuredData.test.ts` parses `index.html` and asserts it against the module | — | — |
| Two competing offer catalogues | `index.html` and `/services` both declared `hasOfferCatalog` on the same `@id`. | ✅ | Static one removed; `/services` owns it, generated from `service_menu` so it cannot drift | — | — |
| PhotoCard corners on WebKit | The new `<img>` relies on the parent's `overflow-hidden`, which WebKit does not reliably apply once the parent carries a 3D transform. The card does, unconditionally, via `perspective()`. | ✅ | `rounded-[inherit]` on the image | — | — |
| Private pages inherited the home canonical | `/reset-password`, `/unsubscribe/:id` and the `SecretGate` catch-all set no metadata, so each carried `index.html`'s canonical and would be reported as a duplicate of `/`. `reset-password` and `unsubscribe` were also absent from robots.txt. | ✅ | `ResetPasswordPage`, `UnsubscribePage`, `SecretGate`, `public/robots.txt` | — | — |
| Sitemap, robots and routes could disagree | Three hand-maintained lists with nothing comparing them: a new public page missing from the sitemap is a page Google may never find. | ✅ | `src/lib/sitemap.test.ts` | — | — |
| Doc drift | Full audit 2026-08-31 found README claiming a single-page marketing site, seven Edge Functions and migrations through `0046`; ARCHITECTURE publishing a sidebar nav that was never built and a `/login` route that does not exist; DESIGN claiming the dashboard is "Inter throughout" against 55 serif headings; GO-LIVE claiming `geo` was absent. All corrected. | ✅ | `docs/plan.md` | — | — |
| Prerendering the SPA | Not done, deliberately. Googlebot renders JavaScript, and a prerender step collides with the CSP-hash and PWA-artefact assertions in CI. | 🔴 MISSING | `docs/SOCIAL_PROFILE.md` §9.2 | Revisit only if Search Console reports rendering failures | P3 |

### Email subsystem
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Delivery state machine | `queued/sending/sent/failed/bounced/cancelled`, `attempts`, `last_error`, exponential backoff capped 6h, permanent-failure short-circuit (functions as dead-letter) | ✅ | `0002_salon.sql:257-272`, `send-emails/index.ts:23,41-44,90-98` | — | — |
| Outbox UI (all/sent/queued/failed, search, CSV export, delete, preview) | Real | ✅ | `EmailPage.tsx:40-45` (419 lines) | — | — |
| Templates (owner-editable overlay, opt-in gating) | Real, protects tested copy from a seeded draft | ✅ | `TemplatesPage.tsx`, `TemplateEditorPage.tsx`, `0032`/`0037` | — | — |
| Template version history | Append-only revision log, auto-logged by a trigger on real content changes; a "History" panel on the editor with Compare and Revert | ✅ | `supabase/migrations/0061_email_template_history.sql`, `TemplateHistoryPanel.tsx` | — | — | — |
| Suppressed / bounced lane | No async bounce/complaint ingestion (raw SMTP only) | 🟡 | `provider_id` column exists but unpopulated | No bounce-webhook feed since this is cPanel SMTP, not an API ESP. **Ruled infrastructure-blocked 2026-08-31 — see §5** — the only real option (IMAP-poll the mailbox and parse NDRs) is a project of its own, not a gap-fill. | P2 |
| Email diagnostics (SPF/DKIM/DMARC/SMTP status screen) | Live SPF/DKIM/DMARC check via a new `email-diagnostics` Edge Function reading public DNS TXT records over DNS-over-HTTPS (no credentials); an "Email authentication" card on the existing System Health page, alongside the outbox queued/failed counts it already showed | ✅ | `supabase/functions/email-diagnostics/index.ts`, `src/pages/dashboard/SystemHealthPage.tsx` | — | — |
| AI-drafted broadcast messaging | Rough idea → AI draft (`draft-copy` Edge Function) → owner-reviewed subject/body → send to confirmed, not-unsubscribed mailing-list subscribers only, queued through the existing outbox. Unsubscribe link on every broadcast email (new, previously nonexistent anywhere in the app). Same drafting reused on the one-off Compose modal and the customer-profile reply panel (deterministic templating there is now gone — `emailDrafts.ts` deleted). | ✅ | `supabase/migrations/0058_broadcast_messaging.sql`, `supabase/functions/draft-copy/index.ts`, `src/pages/dashboard/BroadcastsPage.tsx`, `src/pages/UnsubscribePage.tsx` | — | — | — |

### Production readiness (audited 2026-09-03, second pass)

Full detail, including how each was verified, in §8. Listed here so §3 stays the
single matrix rather than the first pass's matrix plus a separate report.

| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| A loading button cannot be clicked twice | `Button` resolves `disabled \|\| loading` | ✅ | `src/components/ui/Button.tsx`, `Button.test.tsx` | Fixed 2026-09-03. It was `disabled ?? loading`, and `??` only falls through on null/undefined, so any call site passing `disabled={!canSend}` handed it an explicit `false` the moment its form went valid and the button stayed live for the whole request. Seven such call sites, including Send on the Compose email modal and Offer this slot on a request | — |
| SMTP headers cannot be injected | `headerSafe()` on subject, recipient and From name | ✅ | `supabase/functions/_shared/smtp.ts` + `smtp.test.ts` (5 assertions), `send-emails/index.ts` | Fixed 2026-09-03. denomailer 1.6.0 returns a pure-ASCII subject unchanged and writes it into the DATA block verbatim, and `submit_contact_message()` is granted to `anon` and builds the subject from the caller's own name | — |
| An unsubscribe cannot be undone by a stranger | `subscribe_to_updates()` no longer clears `unsubscribed_at`; owner-only "Add back" | ✅ | `supabase/migrations/0071_unsubscribing_sticks.sql`, `rls_test.sql` (3 new assertions), `MailingListCard.tsx` | Fixed 2026-09-03, **not yet applied to production**: needs `supabase db push`. See §8 | P1 (deploy) |
| Google reviewer avatars render | `img-src` carries `https://lh3.googleusercontent.com` | ✅ | `.htaccess`, verified before/after under an enforcing CSP | Fixed 2026-09-03. Every avatar on the home page and `/testimonials` was CSP-blocked; the `onError` fallback to a letter badge is what hid it | — |
| Public mobile menu is a real dialog | `role="dialog"`, `aria-modal`, focus trap, Escape, scroll lock, focus return | ✅ | `src/components/public/SiteShell.tsx` | Fixed 2026-09-03. The dashboard drawer got a trap when `useFocusTrap` was extracted; the customer-facing one did not | — |
| Booking details are a real form | `<form onSubmit>`, `type="submit"` | ✅ | `src/pages/BookPage.tsx` | Fixed 2026-09-03. Enter did nothing, so the phone keyboard's Go key was inert on the last step of the booking flow | — |
| Hero carousel is not six full-size photos | `srcSet`/`sizes`, `fetchPriority`, slides mounted as reached | ✅ | `src/components/public/HeroCarousel.tsx`, `src/lib/imagekit.ts` | Fixed 2026-09-03. Six `w-1920` images were fetched on every home-page load; measured 2 at `w-1280` after | — |
| Privacy notice names its processors | Supabase, mail host, Cloudflare, Sentry, ImageKit, Google | ✅ | `src/pages/PolicyPages.tsx` | Fixed 2026-09-03. It named two of six, and its cookie section predated `product_events` | — |
| 404 is not a dead end | `SiteShell` chrome plus Book / home / three onward links | ✅ | `src/pages/NotFoundPage.tsx` | Fixed 2026-09-03. It was a bare centred block with one button, and it is also what a signed-out dashboard hit and every unmatched single-segment path render | — |
| `draft-copy` CORS matches the other functions | Configured origin plus the fixed loopback list, no wildcard | ✅ | `supabase/functions/draft-copy/index.ts` | Fixed 2026-09-03, **not yet deployed**. It fell back to `*` when `ALLOWED_ORIGIN` was unset and carried no dev origins: the same bug already found once in `email-diagnostics` | P2 (deploy) |
| Structured data cannot be broken out of | `jsonLd()` escapes `<` and the JS line separators | ✅ | `src/lib/utils.ts`, `utils.test.ts` | Fixed 2026-09-03. `/services` builds its catalogue from `service_menu` rows the owner types, and `JSON.stringify` escapes nothing HTML cares about. CSP would have refused the injected script, so this is hardening, not a live hole | — |

### Security / Privacy
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| MFA/TOTP, password change, secret-login slug | Real | ✅ | `AccountSecurityCard.tsx`, `0051` | — | — |
| Secret owner login hardening | Rate-limited (5/15min), IP-hashed, audited to `secret_login_attempts`, nightly purge | ✅ | `0051_secret_owner_login.sql` | — | — |
| Active session list / per-session revoke | Only shows `last_sign_in_at` | 🟡 | `AccountSecurityCard.tsx:19-21` (comment: needs Supabase admin API, not client-exposable) | Full session list/revoke | External constraint (Supabase admin API), not neglect | P2 |
| Audit trail (appointment lifecycle, customer erasure, payment logging, login-slug change) | `audit_events` table (SELECT-only, no write policy for anyone including the owner), `log_audit_event()` called from `set_appointment_status`/`approve_appointment`/`reject_appointment`/`create_appointment_as_owner`/`reschedule_appointment_as_owner`/`delete_appointment_as_owner`/`erase_customer_as_owner`/`log_payment`/`set_owner_login_slug`, read-only `/dashboard/audit` page | ✅ | `supabase/migrations/0052_audit_trail.sql`, `src/pages/dashboard/AuditPage.tsx` — verified live 2026-08-29 against production (all 9 target actions logged correctly, non-owner denied, direct insert denied even for owner) | The ~15 direct client-side `.update()` mutations (owner notes, customer detail edits, settings/template edits, service-menu edits, subscribers, profile) are **not** covered — no single server-side hook point exists for them, deliberately left out of this MVP | Follow-up, not urgent at staff=1 | P3 (follow-up) |
| General security-events feed (RLS denials, auth failures) | Only the narrow secret-login lockout log exists | 🔴 | Same as above. **Ruled infrastructure-blocked 2026-08-31** — `auth.audit_log_entries` (the standard Supabase/GoTrue table this would read) verified empty (`select count(*)` = 0) even seconds after a real, fresh owner sign-in; hosted Supabase is not writing to it on this project, likely routing auth events to its own internal Dashboard Logs instead. Building a feed on a table that never populates would be a hollow, misleading feature, not a fix. RLS denials specifically would need `pgaudit` enabled, a separate project-level configuration change. | No broad security-event visibility | P2 |
| Magic-link security (rate limit, single-use, expiry, revocation) | Real, including bulk "revoke all sessions for this customer" | ✅ | `customer_access_tokens` (`0002`), `customer-access` Edge Function, `revoke_customer_sessions()` (`0062`) | — | — |

### Analytics
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Product-event instrumentation | First-party booking funnel (`product_events`, migration 0064) — no third-party vendor, no personal data, rate-limited | ✅ | `supabase/migrations/0064_product_events.sql`, `src/lib/analytics.ts`, `BookingFunnelCard.tsx` | — | — |

### PWA / Offline
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Offline-safe booking blocking | `isOffline()` guard on `BookPage`'s submit, plus an `OFFLINE` branch in `toAppError` so a dropped connection anywhere reads as one | ✅ | `src/pages/BookPage.tsx`, `src/lib/errors.ts`, `src/lib/errors.test.ts` (12 assertions) | Code and unit tests verified 2026-09-03 (`errors.test.ts`, 12 assertions); the offline browser run itself is still outstanding, see section 7. It was 🔍 for good reason: nothing blocked the write and every network failure rendered "Something went wrong. Please try again." | — |
| Runtime caching of authenticated data | Scoped to four public tables; `purgeApiCache()` on both sign-out paths | ✅ | `vite.config.ts` runtimeCaching, `src/lib/apiCache.ts` | Fixed 2026-09-03. The route used to match every `/rest/v1/` path: `customers` and `appointments` reads were written to Cache Storage, keyed by URL alone, and survived sign-out. Confirmed in a real browser before and after | — |
| Update UX, install prompt | Real. The install banner is now genuinely dismissible (remembered in `localStorage`) and sits at `bottom-20` so it no longer stacks on `OfflineBanner` | ✅ | See §2; `src/components/InstallPrompt.tsx` | Its own docstring had said "dismissible" since it was written, with no control to dismiss it | — |
| App version visibility | Git short SHA + build timestamp, shown on the System Health page | ✅ | See Today/Owner dashboard section above (`0053_system_health.sql`) | — | — |
| Web app manifest identity | `id: '/'`, absolute `scope`/`start_url` | ✅ | `vite.config.ts` manifest, verified in `dist/manifest.webmanifest` | Fixed 2026-09-03. There was no `id`, so identity was inferred from `start_url`: changing that later would have registered as a second app on every device that already had this one. `/` is the value already inferred, so existing installs are unaffected | — |
| Production sourcemaps | `build.sourcemap: 'hidden'` + `workbox.sourcemap: false` | ✅ | `vite.config.ts`, verified 0 chunks carry `sourceMappingURL`, 78 maps still emitted | Fixed 2026-09-03. Maps were built, excluded from the deploy by `docs/DEPLOYMENT.md` §7, and never uploaded anywhere, while every shipped chunk pointed at a `.map` that 404s. The upload itself is still missing: see §5 P2 | P2 |
| Security headers on error responses | `Header always set` for nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy | ✅ | `.htaccess` | Fixed and verified live 2026-09-03: the origin lock's 403 now carries all four headers, where it previously carried none. `Header set` applies to the success table only. HSTS and CSP were already `always`, which is how it stayed invisible | — |

### Testing
| Feature | Current implementation | Status | Evidence | What's missing | Priority |
|---|---|---|---|---|---|
| Unit tests | 34 Vitest files, 301 tests, concentrated in pure logic/hooks. Up from 30 files / 276 tests over the two 2026-09-03 passes (`errors.test.ts`, `useBusinessSettings.test.ts`, `Button.test.tsx`, `utils.test.ts`) | 🟡 | `lib/`, `hooks/`, a handful of `components/`/`services/`/`pages/` | Most service files and most pages have no test file | P2 |
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
| `docs/GO-LIVE.md` | Split (§4 item 3, resolved): dated 2026-08-19 snapshot moved out; `docs/GO-LIVE.md` rewritten as a slim, undated "stand up a fresh environment" procedure |
| `docs/plan.md` | §4 item 4, resolved: appended a note to the "docs drift fast" bullet recording this 2026-08-30 pass and a rough next-pass cadence |

### Third pass, 2026-08-31 (mechanical, already done)

Closed a real RLS test-coverage gap (two tables shipped without being added to
the probe list — a violation of `docs/RULES.md` §1's own hard rule) and retired
`docs/history/` (`docs/superpowers/` was already retired into it the previous
pass, then went with it here): the project decided the archive-folder
convention itself was no longer worth keeping, not just that individual files
in it were stale, so every pointer into it across the repo needed fixing
rather than the folder needing a refresh.

| File | Fix |
|---|---|
| `supabase/tests/rls_test.sql` | Added fixtures, probe-list entries, anon/authenticated-denial, owner-read, and insert-blocked assertions for `email_template_revisions` (`0061`) and `product_events` (`0064`), neither of which had been added since shipping; `plan(51)` → `plan(59)` |
| `docs/RULES.md` §1 | "There are seven functions" → "eleven" (was already stale at nine/ten before this pass) |
| `CLAUDE.md:60` | "eleven Deno Edge Functions" — already correct, no change needed |
| `AGENTS.md:46` | "ten Deno Edge Functions" → "eleven" |
| `docs/ARCHITECTURE.md:20` | "10 Deno Edge Functions" → "11" |
| `docs/KOKO_GAP.md` §2 | RLS test-suite stats "457 lines, 49 assertions... 22 tables" → "572 lines, 59 assertions... 24 tables" |
| `docs/plan.md` | Resolved the stale "`google_place_id` is unset" item — reviews are live in production; appended this pass to the "docs drift fast" note |
| `docs/history/` | Folder deleted outright (23 files). Every reference into it — `README.md`, `CLAUDE.md`, this file, `docs/GO-LIVE.md`, `docs/SCHEMA.md`, `docs/plan.md`, and a source comment in `src/components/dashboard/calendar/MonthView.tsx` — rewritten to state the fact inline instead of citing a file that no longer exists. `docs/GPT.md` was left untouched (frozen input artifact, not a live doc) even though it still names `docs/history/` in its own table |

### Fourth pass, 2026-09-03 (PWA production audit, code + docs)

A full PWA audit, run against a real browser and the live Supabase project rather
than by reading. The theme of the pass: three separate places where a document
described a behaviour the code had never had, and one where the code had quietly
acquired a behaviour nobody would have written down on purpose.

**What "verified" means in this table, and what it does not.** Every finding was
reproduced before it was changed. What differs is the confidence in the fix.
Anything reachable while signed out was re-checked in the browser and is marked
so. Anything behind a session, an install prompt or the live host was reasoned
about and covered by tests, and is listed as outstanding in section 7: the
signed-in dashboard, the sign-out purge, the install banner, the `.htaccess`
headers and the apex redirect. Section 7 is the authority on that split, not this
table.

| File | Fix |
|---|---|
| `src/hooks/useBusinessSettings.ts` | Rewritten onto a module-level store. 41 components call this hook and each held its own `useState` copy, so every mount refetched the same single row: **three identical `booking_settings` requests measured on `/services` alone**, and `/dashboard/settings` renders five cards that each kept a private copy, so saving in one left the other four rendering pre-write values. One shared fetch, one shared row, `update()` publishes to every subscriber. Measured after: 3 requests → 1. New `useBusinessSettings.test.ts` (5 assertions) |
| `vite.config.ts` runtimeCaching | The Supabase route matched every `/rest/v1/` path. Cache Storage is keyed by URL alone, so authenticated reads of `customers` and `appointments` were written to disk with no record of whose token fetched them, and nothing in the app clears Cache Storage on sign-out. Narrowed to `booking_settings`, `services`, `service_categories`, `weekly_template`. Cache name kept deliberately so ExpirationPlugin sweeps existing installs. Status 0 dropped from `cacheableResponse` (an opaque response to a CORS API request is a failure, not data) |
| `src/lib/apiCache.ts` (new) | `purgeApiCache()`, called from both sign-out paths (`AuthContext`, `useCustomerSession`). Belt and braces for installs still running the old worker |
| `src/lib/errors.ts` | New `OFFLINE` code, checked before the coded matches. A dropped connection used to fall through to "Something went wrong. Please try again.", which tells a customer on a train nothing. New `errors.test.ts` (12 assertions) |
| `src/pages/BookPage.tsx` | `isOffline()` guard before submit. `docs/PRD.md` §9 has always said an offline write is "blocked with an explanation rather than queued"; nothing enforced it. Also keeps `booking_submitted` out of analytics for an attempt that never left the device |
| `src/lib/sentry.client.ts` | `beforeSend` drops events while `navigator.onLine` is false. With `replaysOnErrorSampleRate: 1.0`, one offline page dragged a session replay up per failed request. Filters on the connectivity flag, not the message text, so a "Failed to fetch" while genuinely online (CORS, CSP) still reports |
| `src/components/InstallPrompt.tsx` | Its own docstring said "dismissible" and there was nothing to dismiss it with: a fixed banner over the bottom of every page, every visit, stacked on top of `OfflineBanner`. Added a dismiss control, a remembered dismissal, and `bottom-20` so the two no longer overlap |
| `src/components/OfflineBanner.tsx` | "Showing cached content" was never quite true and is now plainly not. Says what offline actually means here |
| `src/pages/NotFoundPage.tsx` | Had no `<h1>` at all; the "404" numeral was a `<p>`. Now decoration, with a real heading. This page also renders for a signed-out hit on any dashboard route, so it is a page the owner sees |
| `vite.config.ts` build | `sourcemap: true` → `'hidden'`, and `workbox.sourcemap: false`. The deploy excludes `*.map` (`docs/DEPLOYMENT.md` §7) and there is no Sentry upload step, so the maps were built and discarded while every shipped chunk carried a `sourceMappingURL` pointing at a 404. Verified: 0 chunks carry the comment, maps still emitted for a future upload |
| `vite.config.ts` manifest | Added `id: '/'`; `scope`/`start_url` `'./'` → `'/'`. Without `id` an installed app's identity is inferred from `start_url`, so changing that later registers as a second app on every device that already has this one |
| `.htaccess` | `Header set` → `Header always set` for `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Without `always` Apache applies them to the success table only, so the 403 the origin lock returns on every direct-to-origin request went out bare. HSTS and CSP were already `always`, which is how the gap stayed invisible |
| `docs/ARCHITECTURE.md` §5 | Described `registerType: 'prompt'` + `skipWaiting: false` and a `public/offline.html`. The update strategy was inverted months ago and the file is deleted. Rewritten, including what offline actually delivers |
| `docs/PRD.md` §7/§9/§11 | "cached read-only owner views" and "the owner dashboard is readable offline" withdrawn, with the reason recorded rather than quietly deleted |
| `README.md` | Same offline claim, plus a `public/` tree still listing `offline.html` |

`docs/GPT.md` was left untouched again, for the reason given in the third pass:
frozen input artifact, not a live doc. It still describes the old update strategy
and `offline.html`. Its own header already says the live docs win.

### Open questions — recommended, not executed

These are judgment calls, not factual corrections, so they weren't auto-applied:

1. **`ai_recommendations` table** — ~~created by `0002`, RLS-policied, even seeded in the RLS test suite, but confirmed unused by any frontend/service code~~ **dropped 2026-08-30 (`0057`), owner-approved.** Confirmed unused by any frontend/service code (`src/lib/insights.ts` + `ai-assistant-chat` are the real assistant; neither ever touched this table). Explicitly does not affect the AI chat's ability to draft messages — that capability (`ai-assistant-chat`, one-off per-customer emails via `propose_email`, always rendered in an editable field for the owner to approve — `docs/RULES.md` §9.6) is untouched, and there is no bulk newsletter/ad-to-all-customers feature in the codebase to affect either way (checked: no "bulk send" path exists anywhere — `sendCustomEmailAsOwner` is explicitly one-off).

2. **CLAUDE.md / AGENTS.md overlap.** Not duplicates — different registers (CLAUDE.md = Claude Code session context + live coordinates + commands; AGENTS.md = generic cross-tool numbered directives). But three facts are restated in both with drifting detail:
   - Scope discipline ("women's hair only") — AGENTS.md's version is fuller (explains the `HairSalon` reasoning). No real disagreement, just verbosity difference — no action needed.
   - AI proposal/confirm boundary — CLAUDE.md:69 is one dense sentence; AGENTS.md:21-32 has the full mechanism (dispatcher-branch argument, untrusted-data fencing). Recommend CLAUDE.md's line become a one-sentence pointer to AGENTS.md's fuller version, so the two can't drift independently on a future edit. **This is a restructuring choice — present here, not executed.**
   - "No Inngest" — consistent in both, no drift, no action.

3. ~~**`docs/GO-LIVE.md`** self-describes as a dated 2026-08-19 snapshot... two options, neither picked~~ **Resolved 2026-08-30 (option a): split.** `docs/GO-LIVE.md` is now a slim, undated "stand up a fresh environment" procedure (env template, Supabase project setup, dashboard data entry, verification checklist), pointing to `docs/DEPLOYMENT.md` for build/deploy mechanics rather than duplicating them. The dated 2026-08-19 completion snapshot this replaced was archived separately and is no longer kept in the repo (2026-08-31).

4. ~~**`docs/plan.md`** — ... Optionally add one bullet... the user's call, not applied here~~ **Resolved 2026-08-30.** Appended a note to `plan.md`'s "docs drift fast" bullet recording this second pass and a rough cadence for the next one.

5. **`docs/GPT.md`** — left as-is. It already defers to the docs when they disagree ("if a claim here and a claim in those files disagree, those files win"), so no correction is strictly needed. Optionally add one header line noting the multi-tenant direction was reviewed and declined in favour of this document's framing — optional, not applied.

## 5. Prioritized checklist — what needs to be done

**P0 — none found.** Worth stating explicitly: nothing here is a live production risk or a broken, blocking item. Several things the original brief assumed were gaps (RLS tests, AI governance, booking-race DB protection, Inbox merge) are already done.

**P1**
- [x] Stand up an E2E test framework — done: `@playwright/test`, `playwright.config.ts`, `npm run test:e2e` / `test:e2e:ui`.
- [x] Write the automated two-customer booking-race test — done: `e2e/booking-race.spec.ts`. Run live 2026-08-29 against the real Supabase project (`KOKO_OWNER_EMAIL`/`KOKO_DEV_PASSWORD` set): passed — one customer's `book_appointment()` call won, the other failed with `SLOT_TAKEN`, owner-session cleanup (cancel + hard delete) ran cleanly.
- [x] Payment reconciliation view — done: `PaymentReconciliationCard` on Today, flags completed appointments (last 30 days) with no logged payment. Removed and restored on 2026-08-31; it now sits beside the AI assistant card rather than full width.
- [x] **Stop the service worker caching authenticated customer data to disk** — opened and closed 2026-09-03 by the PWA audit. The runtime-caching route matched every `/rest/v1/` path, so reads of `customers` and `appointments` were written to Cache Storage, which keys on URL alone, keeps no record of whose token fetched the response, and is cleared by nothing: not `signOut()`, not Supabase, not closing the tab. Reproduced in a real browser before the change (the `supabase-api` cache was created and populated on a first page load), and re-checked after (only the four public tables present). Narrowed the route to `booking_settings`, `services`, `service_categories`, `weekly_template`; added `src/lib/apiCache.ts` → `purgeApiCache()` on both sign-out paths; dropped status `0` from `cacheableResponse`. Cache name deliberately unchanged so existing installs get swept rather than orphaned.
- [x] **Stop refetching the `booking_settings` row once per component** — opened and closed 2026-09-03. 41 components call `useBusinessSettings` and each held a private `useState` copy. Measured **3 identical `booking_settings` requests on `/services`**, and `/dashboard/settings` renders five cards each holding their own copy, so saving in one card left the other four rendering pre-write values. Rewritten onto a module-level store (`useSyncExternalStore`): one shared in-flight request, cached row for later mounts, `update()` publishes the saved row to every subscriber. Measured after: 3 → 1.
- [x] **Block and explain offline writes** — opened and closed 2026-09-03. `docs/PRD.md` §9 had always specified that an offline write is "blocked with an explanation rather than queued"; nothing enforced it. The request went out, `fetch` rejected, and `toAppError` fell through to "Something went wrong. Please try again." Added an `OFFLINE` code checked ahead of the coded matches (recognises the per-engine `fetch` texts and `navigator.onLine`), plus an `isOffline()` guard on `BookPage`'s submit. This closes the `🔍 NEEDS VERIFICATION` row that had sat in §3's PWA table since 2026-08-29 saying offline write blocking "wasn't verified line-by-line" — it was not verified because it did not exist.

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

- [ ] **Sentry release sourcemap upload** — opened 2026-09-03 by the PWA audit. `build.sourcemap` is now `'hidden'`, so the maps are emitted and the dangling `sourceMappingURL` comments are gone, but nothing uploads them: `docs/DEPLOYMENT.md` §7 forbids publishing `*.map` to the docroot (correctly), and there is no upload step. Every stack frame in Sentry is therefore minified, which is most of what monitoring is for. The fix is `@sentry/vite-plugin` plus `SENTRY_AUTH_TOKEN`/org/project as CI secrets, gated on a release build. Not done here because it needs credentials this repo cannot create and a decision about whether CI or the local deploy owns the release.
- [ ] **Measure Supabase read latency from the salon's own connection** — observed 2026-09-03, not diagnosed. A single-row `booking_settings` read measured **~0.82s TTFB on a warm keep-alive connection** and 2.9-3.2s cold (DNS 2ms, connect 0.87s, TLS 1.85s) from one developer machine to `eu-west-2`. That is slow enough to be felt on first paint and it is the reason the duplicate-fetch bug above was worth fixing rather than tolerating. One machine on one network is not a measurement, though: repeat it from the owner's own device and from a phone on mobile data before concluding anything about the project, the region, or the plan.

**P1 (second 2026-09-03 pass, all fixed in the working tree; the two marked
"deploy" are code-complete and gate-green but were found after PR #57 shipped,
so they are not live yet)**
- [x] **A loading button could be clicked twice** — `Button` used `disabled ?? loading`. `??` only falls through on null/undefined, so a call site combining `loading={sending}` with `disabled={!canSend}` handed it an explicit `false` the moment the form went valid, and the button stayed live for the whole request. Seven call sites did exactly that: Send on the Compose email modal (a second email), Offer this slot on a request (a second offer to the same customer), Apply and Apply to future weeks on the weekly template, the note save on a request, and the name save on Profile. One character (`||`), plus `Button.test.tsx` asserting the explicit-`false` case specifically. Absorbed into `1922cc2`, so this one **is** live.
- [x] **SMTP header injection through the contact form** — `submit_contact_message()` is granted to `anon` and builds its subject as `'Message from ' || v_full_name`, checking only that the name is non-empty and at most 200 characters. denomailer 1.6.0's `quotedPrintableEncodeInline` returns pure-ASCII input **unchanged** (`config/mail/encoding.ts`) and `connection.ts:114` then writes `"Subject: " + value + "\r\n"` raw, so a CRLF in that name ends the header early and everything after it is parsed as further headers, or after a blank line as the body. The relay is the salon's own authenticated, DKIM-signed sender and the recipient is the owner's inbox. Fixed at the one place a string becomes an SMTP header (`_shared/smtp.ts`), which also covers owner-edited template subjects that never pass through `queue_email()`. Five Deno assertions.
- [x] **An unsubscribe could be undone by anyone who knew the address** — `subscribe_to_updates()` (0018) ended its upsert with `set unsubscribed_at = null`, and `confirmed` defaults to true and is never cleared, so re-submitting an opted-out address put that person straight back into the broadcast audience (`0058` sends to `confirmed and unsubscribed_at is null`). The anon key ships inside the browser bundle, so the caller did not have to be the person. Migration `0071` drops the clause, adds length ceilings and a global hourly cap; `MailingListCard` gains an owner-only "Show N who opted out" / "Add back", which is where a re-consent decision belongs. The confirm dialog's "They would need to sign up again to rejoin" was describing the bug, and is corrected. **Deployed 2026-09-04** — see §9.

**P2 (second 2026-09-03 pass)**
- [x] **Every Google reviewer avatar was CSP-blocked** — `img-src` did not carry `lh3.googleusercontent.com`, which is where `sync-reviews` stores `authorAttribution.photoUri`. `ReviewerAvatar` and `TestimonialsGrid`'s `Avatar` both fall back to an initial-letter badge `onError`, so it degraded silently and only the console knew. Proven both ways against a local server serving the real header: 10 violations and 0 avatars before, 0 violations and 5 avatars after.
- [x] **The public mobile menu was not a dialog** — no focus trap, no Escape, no `role="dialog"`, no scroll lock, no focus return, and the page behind stayed tabbable. Now uses the same `useFocusTrap` the dashboard drawer got.
- [x] **The booking form was not a form** — the details step was four inputs and an `onClick` button, so Enter did nothing on the last step of the booking flow.
- [x] **`draft-copy` CORS fell back to `*`** — and carried no loopback origins, so "Polish with AI" was the one owner action that could not be exercised against a dev server. Also now rejects an unknown `kind` with a 400 instead of sending `undefined` to OpenRouter and returning a 502, and caps input length. **Redeployed 2026-09-04** — see §9.
- [x] **The privacy notice named two of six processors** — Cloudflare, Sentry, ImageKit and Google Fonts were all absent, its cookie section predated `product_events`, and it still said marketing email was stopped by replying rather than by the unsubscribe link `0058` added. Rewritten against what the code actually does.
- [x] **The 404 was a dead end** — no nav, no footer, one button. It is also what a signed-out dashboard hit renders and what every unmatched single-segment path falls through to, so it is a page the owner sees too.

**P3 (second 2026-09-03 pass)**
- [x] Hero carousel fetched six `w-1920` photos on every home-page load, one of which is visible. Added `srcSet`/`sizes`, `fetchPriority` and mount-as-reached: measured 2 requests at `w-1280` on a 390px viewport after.
- [x] `loading="lazy"`/`decoding="async"` on the four below-the-fold images that had neither.
- [x] `JSON.stringify` into `<script type="application/ld+json">` on three pages, one of which interpolates owner-typed `service_menu` values. `jsonLd()` escapes `<` and the two JS line separators.
- [x] `<html lang="en">` against JSON-LD claiming `"inLanguage": "en-GB"`.
- [x] No body scroll lock behind `Modal`, so a scroll gesture over the backdrop moved the page underneath.
- [x] `tel:` and `mailto:` on the Contact page opened with `target="_blank"`, leaving an empty tab behind.
- [x] The Contact form's success state replaced the form with no `role="status"` and no focus move, so it announced nothing.
- [x] One dev-only `fast-uri` advisory (high, via the eslint tree). `npm audit --omit=dev` was and is clean; `npm audit fix` cleared it.

**P3**
- [x] Shared `DataTable`/`Tooltip`/`Dropdown`/`Tabs` UI primitives — done: `src/components/ui/{DataTable,Dropdown,Tabs,Tooltip}.tsx`. Deliberately not a full app-wide migration — each is real and adopted into at least one genuine existing consumer rather than left as unused scaffolding, but retrofitting every page that hand-rolls its own table/dropdown/tab-bar in one night is real blast radius with no live-verification budget to match. `Dropdown` → `AppointmentRowMenu.tsx` and `CustomerDetailPanel.tsx`'s More options menu (which previously had no outside-click close at all — a real UX fix, not just deduplication). `Tabs` → `CustomerDetailPanel.tsx` and `TemplateEditorPage.tsx`'s Email/Mobile toggle. `Tooltip` → `NextWeeksGlanceCard.tsx`'s day-glance dots (the sidebar collapse toggle was tried first and reverted — its `absolute -right-3 top-4` positioning depends on its current nearest-`relative`-ancestor, which `Tooltip`'s own wrapper span would have silently changed). `DataTable` → `AppointmentsTable.tsx` is now column definitions over the shared primitive; deliberately not used for Customers, which moved to cards per an explicit prior owner request. Verified live against production for all four. (`Timeline` is its own component — `CustomerTimeline.tsx`, see Customers section above.)
- [x] Product-event/analytics instrumentation — done, explicitly requested: `supabase/migrations/0064_product_events.sql`, `src/lib/analytics.ts`, `BookingFunnelCard.tsx` on Reports. First-party, not a third-party vendor — `product_events` holds no personal data (event name, random per-tab `sessionStorage` id, timestamp), avoiding the new-external-service/API-key/privacy-review decision a PostHog/Plausible/Mixpanel integration would have needed. Instruments the four real booking-funnel steps (page viewed, slot selected, submitted, confirmed), rate-limited (20/min per session, 500/min globally). Verified live against production with a real anonymous booking through the actual `/book` flow — all four events recorded correctly, Reports showed the resulting funnel with correct counts and percentages. Test data cleaned up.
- [x] Undo layer for cancellation — done: `supabase/migrations/0063_undo_cancellation.sql` lets `cancelled` transition back to confirmed/checked_in/in_service, clearing `cancelled_at`/`cancellation_reason` and re-queuing the reminders the cancellation retired. Wired the existing Undo-toast pattern (already used by `TodayPage`) into `AppointmentsPage`/`CalendarPage` too. Verified live against production (rolled-back-transaction SQL validation, then a real cancel → toast → Undo click round trip in the browser). **Reschedule-undo intentionally not built** — `rescheduleAppointmentAsOwner` retires the old row and creates a new one, so undo there is cancel-the-new-plus-revive-the-old with its own slot-conflict question, not a same-shape fix. Test data cleaned up.
- [x] Email configuration diagnostic screen — done: `supabase/functions/email-diagnostics/index.ts` (live SPF/DKIM/DMARC over public DNS-over-HTTPS, no credentials), "Email authentication" card on System Health. Verified live against the deployed function (real SPF/DMARC/DKIM values matching `dig` against the live domain) and in the browser; caught and fixed a real CORS bug (the function always echoed the configured production origin regardless of the caller's actual origin, rejecting every localhost dev request) before shipping.
- [x] Bulk customer-session revocation — done: `supabase/migrations/0062_customer_session_revocation.sql`, `revoke_customer_sessions()`, "Sign out everywhere" in the Customers detail panel's More options menu. Verified live against production (rolled-back-transaction SQL validation, then a real two-tab browser round trip — caught and fixed a real pre-existing bug in `useCustomerSession.ts`'s INVALID_SESSION detection, which checked `e instanceof Error` when `supabase.rpc()` errors are plain objects, so a revoked customer never actually got signed out client-side). Test data cleaned up.

**Judgment call, not a priority-ranked gap:**
- Notifications persistence — currently a computed feed (no stored `notifications` table; `notificationsService.ts` says so directly) with `localStorage` read-state per device. This may be a legitimate simplicity tradeoff for a single-owner app rather than a gap to fix — a real table would only pay off if read-state needs to survive across devices/browsers, at the cost of a write path and a migration. Flagged for a decision, not assigned a P-number.

## 6. Scope boundary

This document, and the mechanical doc corrections applied in §4, do **not** authorise building anything listed 🔴/🟡 above. Each checklist item in §5 needs its own separate plan and explicit approval before any code or migration is written.

## 7. Verifying the 2026-09-03 pass

### State as of writing

**Merged and deployed 2026-09-03.** PR #57, eight commits, merged to `main` as
`4b89a04` with all five CI checks green including the `database` job (migrations
applied from scratch plus the pgTAP RLS suite) and `verify` (Deno checks, CSP
script-hash assertion, PWA artefact assertion). Built from merged `main` and
shipped with:

```
cpanel-deploy dist kokolettbeauty.com --keep cgi-bin --keep .well-known \
  --with-htaccess .htaccess --prune --go
```

`--prune` was required and is worth understanding rather than copying: the script
aborts on any deletion whose top-level path is absent from `dist/`, and
`offline.html` is exactly that. The guard did its job; the removal was deliberate.
The live `.htaccess` was diffed against the repo's first (only this pass's change,
nothing the server carried alone) and backed up to
`~/private_backups/configs/htaccess-kokolettbeauty-20260903-021409.bak`.

**CodeRabbit found nine issues on the first push and six were real**, including a
race this pass introduced: a `booking_settings` read that started before a save
could resolve after it and publish the pre-save row over the saved one, which is
the exact bug the shared store was written to remove. Fixed with a load
generation, and the regression test was checked both ways (fails without the
guard, passes with it). The full triage, including the one finding answered
rather than built, is in commit `1922cc2`.

The tree also still carries earlier in-flight work from the session before this
one, which this pass reviewed rather than wrote: `autoUpdate` + `onNeedReload` in
`UpdatePrompt.tsx`, DOMPurify on the template preview, `useFocusTrap` on the
mobile nav, and the deletion of `public/offline.html`. All four were checked and
are sound. `onNeedReload` in particular is a real callback in vite-plugin-pwa
1.3.0 and fires on `activated` in the autoUpdate branch
(`node_modules/vite-plugin-pwa/dist/client/build/register.js:42`), not a silent
no-op.

### Gates, all green after the pass

`npm run typecheck` · `npm run lint` · `npm run lint:copy` · `npm run format:check`
· `npm run test:hooks` · `npm test` (**293 passed, up from 276**) · `npm run build`.

CI's own extra assertions were not re-run locally: the CSP script-hash check was
verified by hand against the built `index.html` and matches, the PWA-artefact
check passes by inspection (`dist/sw.js`, `dist/manifest.webmanifest`, `.htaccess`
all present), and the Deno and pgTAP jobs are untouched by this pass.

### What was verified in a real browser, and how

Headless Chromium against `npm run preview` on 5082 serving a production build,
hitting the live Supabase project. Not `npm run dev`: the service worker only
exists in a real build, so every finding here is invisible in dev.

| Check | Result |
|---|---|
| Service worker registers, one active, no waiting | Pass |
| Console errors across `/`, `/book`, `/about`, `/services`, `/gallery`, `/contact`, `/faqs`, `/testimonials`, `/my`, a 404 | Zero, before and after |
| `caches.keys()` after the fix | `workbox-precache-v2`, `imagekit-media`, `google-fonts`, `supabase-api` |
| `supabase-api` contents after the fix | Only `services`, `service_categories`, `weekly_template`, `booking_settings`. Before the fix it also took whatever the signed-in session had read |
| `booking_settings` requests on one `/services` load | 3 before, 1 after |
| Horizontal overflow at 320, 375, 768, 1280 on `/`, `/book`, `/services` | None |
| `<h1>` present on every public route | Yes, including the 404 now |
| Manifest in `dist/` | `"id":"/","scope":"/","start_url":"/"` |
| `sourceMappingURL` comments in shipped chunks | 0, with 78 maps still emitted for a future upload |

### What was NOT verified, and needs your pass

These are the gaps in the above. Worth doing exactly because nothing here proves them.

1. **Signed-in owner dashboard.** Every browser check ran signed out, against the
   live site after deploy as well as against the preview build. The
   `useBusinessSettings` rewrite touches 41 components, and the settings screen is
   where its behaviour changed most. Open `/dashboard/settings`, change something in
   **Booking rules**, and confirm the other four cards on that screen reflect it
   without a reload. That specific staleness is the bug the rewrite fixes, and it is
   the one thing most likely to have been fixed wrongly.
2. **Sign-out purge.** Sign in, load a dashboard page, sign out, then check
   `caches.keys()` in DevTools: `supabase-api` should be gone. Do it for the
   customer side too (`/my`, then Sign out).
3. **Offline behaviour, first hand.** DevTools → Network → Offline, then: the
   banner should read "You're offline. You can browse, but nothing can be booked or
   changed until you reconnect"; `/book` should refuse the submit with "You appear to
   be offline. Please check your connection and try again" rather than a spinner or a
   generic failure; and a hard reload should still boot the shell.
4. **Install banner.** It only appears on a real `beforeinstallprompt`, which
   headless Chromium does not fire, so the dismiss control and the `bottom-20`
   spacing are unverified in the browser. Install on a phone, dismiss it, reload, and
   confirm it stays gone.
~~5. `.htaccess` on the live host.~~ **Verified after the deploy.** Direct to
   185.61.152.45 returns 403 carrying `x-content-type-options`, `x-frame-options`,
   `referrer-policy` and `permissions-policy`; before this change that 403 went out
   bare. Note the probe needs `curl -sk`: the origin serves a Cloudflare Origin
   certificate, which curl and browsers both reject outside the proxy, so without
   `-k` you get `code=000` and learn nothing.

~~6. The apex-to-www 301.~~ **Verified after the deploy**, closing the item §3's
   marketing table had carried as untested since 2026-08-31:
   `https://kokolettbeauty.com/` returns 301 to `https://www.kokolettbeauty.com/`.

7. **A 200 still proves nothing here.** The SPA rewrite answers every non-file path
   with `index.html`, so `/offline.html` and `/sw.js.map` both return 200 after this
   deploy even though neither file exists. Check `content-type` (`text/html` means
   the fallback answered) or look on the server. Confirmed by hand: zero `*.map`
   files in the docroot.

### Note for anyone reading the service worker

An installed PWA that has not updated is still running the **old** worker, which
cached every `/rest/v1/` read. It keeps doing so until it picks up the new build.
`registerType: 'autoUpdate'` plus the hourly poll in `UpdatePrompt.tsx` means that
happens on its own, but it is not instant, and on the owner's own installed app it
is worth forcing once (DevTools → Application → Service Workers → Update, or just
sign out, which now purges the cache outright).

## 8. Production-readiness audit, 2026-09-03 (second pass)

Run after §7's PWA pass had merged and deployed, against a wider brief: functional
QA, responsive, navigation, conversion, SEO, social, accessibility, performance,
security, privacy, analytics, error handling, content, media, trust, forms, links,
code quality and production configuration. Everything below was read in the code
and, where it could be, exercised in a real browser against a production build.

### Executive summary

**86/100.** The application was already in good shape and the two gates that
matter most (RLS, CI) are genuinely thorough, which is why the findings here are
concentrated in places nothing was looking: a `??` in a shared button, a
third-party SMTP library's encoder, an upsert clause from migration 0018, and a
CSP origin nobody had a reason to add. Three P1s, six P2s, eight P3s. All fixed;
two need a deploy step this pass did not take.

The score is held down by the two undeployed fixes and by what could not be
verified from here at all (signed-in dashboard journeys, real email delivery,
the live host's headers after the next deploy), not by anything known-broken.

### Critical (P0)

None. Nothing found is a live outage, a data-loss path, an authentication
bypass, or a way for one customer to read another's data. The RLS suite covers
anon, signed-in-non-owner and owner across 24 tables and it passes.

### High (P1)

Three, all fixed. Each is listed with its root cause in §5's P1 block:

1. **`Button` let a loading action be clicked again.** `disabled ?? loading`.
2. **SMTP header injection reachable by an anonymous caller** through the contact
   form's name field.
3. **An unsubscribe could be undone by anyone who knew the address.**

### Medium (P2) and low (P3)

Six and eight respectively, all fixed. See §5.

### Fixes, and how each was tested

| Fix | Tested by |
|---|---|
| `Button`: `disabled \|\| loading` | `Button.test.tsx`, four assertions, one of them the explicit-`disabled={false}` case that was the bug |
| `headerSafe()` on every SMTP header value | `_shared/smtp.test.ts`, five Deno assertions, including that a CRLF cannot end the header block. The library behaviour was confirmed by reading denomailer 1.6.0's own `encoding.ts` and `connection.ts`, not assumed |
| `0071`: unsubscribe survives a re-signup | All 71 migrations applied in order against a throwaway `supabase/postgres:17.6.1.143` container, then the pgTAP suite run against it. Three new assertions pass, including "and the unsubscribe survives it". The 11 owner-read assertions that fail in that container fail identically on the unmodified suite from `HEAD`, so they are the container's missing GoTrue schema, not a regression |
| CSP `img-src` gains `lh3.googleusercontent.com` | A local server serving the exact header from `.htaccess`, run twice: with the old value (10 CSP violations, 0 avatars rendered) and the new one (0 violations, 5 avatars at 128x128) |
| Public mobile menu becomes a dialog | Real browser: opened it and read back `role="dialog"`, `aria-modal="true"`, `body.style.overflow === "hidden"`, `aria-expanded="true"`; pressed Escape and read back that the panel was gone, the scroll lock released and focus was on the trigger |
| `BookPage` details step becomes a `<form>` | Real browser: selected a slot, typed a first name only, pressed Enter, and read back the validation message plus **zero** Supabase requests, so the form submitted and stopped where it should |
| Hero carousel responsive and deferred | Real browser at 390x844: two image requests at `w-1280`, not six at `w-1920` |
| Privacy notice, 404, lazy images, `lang`, `jsonLd()`, `Modal` scroll lock, `tel:`/`mailto:`, Contact success state | `npm run typecheck` / `lint` / `format:check` / `lint:copy` / `test` / `build`, plus a real-browser sweep of all 14 public routes (see below). `jsonLd()` additionally has three unit assertions |
| `draft-copy` CORS and input validation | `deno check` clean; redeployed and CORS re-probed against the live function 2026-09-04, see §9 |

### Verified in a real browser

Headless Chromium, production build. Two servers: `npm run preview` on 5082, and
a local static server replaying the exact `Content-Security-Policy` from
`.htaccess` so the enforced policy was actually under test (`vite preview` sends
no such header, which is how the blocked avatars survived every previous pass).

| Check | Result |
|---|---|
| Console errors on `/`, `/about`, `/gallery`, `/services`, `/faqs`, `/contact`, `/book`, `/request-availability`, `/subscribe`, `/privacy`, `/terms`, `/booking-policy`, `/my`, a 404, under the enforced CSP | Zero on all fourteen |
| Horizontal overflow at 390px on the same fourteen | None; `scrollWidth === clientWidth` on every one |
| Exactly one `<h1>` per route, unique `<title>` per route | Both, on all fourteen |
| Per-route canonical, description, robots, Open Graph, Twitter, breadcrumb | Present and route-correct (checked on `/services`: canonical, `og:url`, `og:image` 1200x630, `twitter:title`) |
| Google reviewer avatars under the real CSP | 5 rendered after the fix, 0 before it |
| JSON-LD blocks parse on `/`, `/services`, `/testimonials`, `/faqs` | All parse; `/services` emits `HairSalon` with six offer-catalogue groups |
| `/dashboard` while signed out | Renders the 404, no hint a login exists |
| CI's CSP script-hash assertion, re-run by hand against `dist/index.html` | Match |
| `<html lang>` | `en-GB` |

### Status by area

| Area | Verdict | Why |
|---|---|---|
| Security | ~~PASS, with one deploy outstanding~~ **PASS** | No P0. RLS is the boundary and it is tested. The three real findings (SMTP injection, unsubscribe resurrection, `draft-copy`'s wildcard) are fixed and, as of §9, deployed. Secrets: `.env` is git-ignored, only `VITE_*` reach the bundle, `env.ts` uses static members so nothing else is inlined, no service-role key anywhere in `src/`, sourcemaps emitted but not linked and not deployed. `npm audit --omit=dev` clean |
| SEO | **PASS** | Unique title, description, canonical, OG, Twitter and a breadcrumb per route; one `<h1>` each; `HairSalon` + `WebSite` + a live `hasOfferCatalog`; robots.txt and sitemap.xml correct and guarded by `sitemap.test.ts`; apex-to-www 301 verified live in §7. Outstanding and not fixable from here: the sitemap has never been submitted to Search Console (§3, P1, needs the owner's Google account) |
| Accessibility | ~~PASS~~ **PASS, one P2 open** | Skip link, focus-visible rings throughout, semantic landmarks, labelled controls, `role="alert"` on error copy, reduced-motion honoured globally and per component, 44px touch targets on the customer path. The two real gaps found (the mobile menu, the Contact success state) are fixed. §9 replaces "not audited" with a real automated pass (`@axe-core/playwright`, WCAG 2.2 AA) and found one real, tracked gap: the brand accent's contrast at small sizes. No screen-reader run still |
| Performance | **PASS** | Dashboard fully lazy so a customer downloads none of it; Sentry deferred past first paint; hero now responsive and deferred; images lazy below the fold; fonts preconnected and preloaded. Largest chunks are Sentry (88 kB gzip, after idle), react-vendor (73 kB) and supabase (54 kB). §7's Supabase-latency observation is still the open question and still needs measuring from the owner's own connection |
| Mobile | **PASS** | No horizontal overflow on any public route at 390px; menu is now a proper dialog with a scroll lock; forms use correct input types and `autoComplete` |
| Conversion | **PASS** | One primary action everywhere (Book), a secondary that does not compete, no popups, no autoplay video, no invented testimonials or statistics, and the deliberate absence of prices is a documented product decision (`docs/PRD.md` §7), not an omission. The 404 now converts instead of dead-ending |
| Privacy and legal | **NEEDS ATTENTION (human)** | Reworked 2026-09-04 (`docs/LEGAL.md`). The page set went from three to six: privacy, cookies and storage, terms, booking policy, accessibility, complaints. Two real findings are fixed. **OpenRouter** received customer names and the text of customer notes through `draft-copy` and the assistant, while the notice claimed its supplier list was complete and that none of them saw a name; it is now disclosed. The `sessionStorage` analytics id wrote to a visitor's device with no consent mechanism at all, and is now behind a real accept/reject control (`src/lib/consent.ts`, `ConsentBanner.tsx`) with the gate in `trackEvent` and tests for all of it. The notice also now covers contact messages, availability requests, the mailing list, payments, and the owner's private notes, which hold health information. Still open and still human: no ICO registration (a sole trader holding customer records normally must register and pay the fee), and nothing here has been read by anyone qualified. Six questions are listed for counsel in `docs/LEGAL.md` §7. Flagged, not claimed |

### Remaining risks

1. ~~Two fixes are not live.~~ **Deployed 2026-09-04, see §9.** Everything else
   here is frontend or `.htaccess` and ships with the next `cpanel-deploy`.
2. **`0071` changes behaviour the owner may not expect.** Somebody who unsubscribes
   and later signs up again on the website will be told "thanks" and will not be
   added back. That is deliberate (the alternative is an unsubscribe a stranger can
   undo, and telling them would make the endpoint an is-this-address-on-the-list
   oracle), and the way back is the new "Add back" control. Worth her knowing.
3. **The signed-in dashboard was not exercised.** Same gap §7 records. Every browser
   check here ran signed out, so the `MailingListCard` change is verified by
   typecheck and reading, not by use.
4. **No email was actually sent.** The SMTP fix is a pure function with tests and a
   read of the library's source. A delivered message should be checked after deploy,
   and the injection itself should be re-probed against the deployed function.
5. ~~Contrast ratios and screen readers were not measured.~~ **Contrast is now
   measured (§9) and one real gap is tracked as a P2; screen readers still
   are not.**
6. **`AdvisorySection.tsx` is dead code** — 56 lines, imported by nothing,
   tree-shaken out of the build, and referenced in two comments as a deliberate
   future affordance. Left in place on that basis rather than deleted. If those
   comments stop being true, delete it.
7. **The remaining P2s from earlier passes are unchanged** by this one: bounce
   ingestion is infrastructure-blocked, the security-events feed is
   infrastructure-blocked, unit-test coverage of services and pages is still thin,
   and E2E is still not wired into CI.

### Launch decision

~~READY WITH MINOR FIXES.~~ **Superseded by §9** — both minor fixes are now
deployed and verified live.

The site is live and was already production-shaped. The two "minor fixes" were
specific and small: apply `0071`, redeploy `draft-copy`, and ship the frontend and
`.htaccess` changes. Until `0071` was applied, an unsubscribe on the live site
could still be undone by anyone who knows the address, which was the one finding
here with a real person on the other end of it.

## 9. Verification and deploy pass, 2026-09-04

Picked up where §8 left off: this pass did not re-derive a new 42-phase audit
from zero (the project already carries one, scored above), it re-verified the
existing 86/100 pass is still accurate, closed the two outstanding P1 deploys,
added real automated accessibility evidence in place of the "structural pass"
verdict, and fixed what that evidence found that was safe to fix narrowly.

### Baseline re-verified before touching anything

Six commits had landed since §8 was written: five are mechanical file-splits
under the 500-line limit (`git show --stat` on each confirms pure
extraction/move, no behaviour change), and the sixth, `0e735ae`, turned out to
**be** the code side of §8's own second pass (its diff is exactly `0071`, the
`draft-copy` fix, the SMTP header fix and the KOKO_GAP.md write-up from §8) —
not new, unreviewed work. Confirmed by re-running every local gate:
`typecheck` · `lint` · `format:check` · `lint:copy` · `test:hooks` · `test`
(**301 passed, up from 293** — `redact.test.ts`/`csv.test.ts`/etc. from §5's P2
coverage push plus the new `smtp.test.ts`/`utils.test.ts` from `0e735ae`) ·
`build` · `deno check` on every edge function · `deno test` (15 passed).
All green, no regressions.

### Ground truth checked against production, not just the doc

Before deploying anything, `list_migrations`/`list_edge_functions` (Supabase
MCP) were read directly against project `erqrfjlozqyhogneqraj` to confirm §8's
"needs deploy" claims were still true rather than assumed: migrations stopped
at `20260831091023_product_events` (`0071` absent) and `draft-copy` was last
updated 2026-08-30 (`version: 4`), predating the CORS/validation fix. Both
confirmed outstanding.

### The two deploys, and how each was verified live

- **`0071_unsubscribing_sticks.sql`** applied via `apply_migration`. Verified:
  `list_migrations` now lists it (as `20260904152812_0071_unsubscribing_sticks`);
  the function body deployed matches the reviewed source exactly (read back
  before applying, not assumed).
- **`draft-copy`** redeployed via `deploy_edge_function`; version moved 4 → 5.
  Verified live, not just by deploy success: an `OPTIONS` preflight from
  `Origin: http://localhost:5082` against
  `https://erqrfjlozqyhogneqraj.supabase.co/functions/v1/draft-copy` returned
  `access-control-allow-origin: http://localhost:5082` — the dev origin,
  not a `*` wildcard and not silently rejected.
- `get_advisors` (security) re-run after the migration: no new findings tied to
  `subscribe_to_updates` or the new `subscribers_created_at_idx`; the one
  pre-existing item (`secret_login_attempts` RLS-enabled-no-policy) is the
  already-documented deliberate deny-all false positive from §27, unchanged.

### Real accessibility evidence added

`@axe-core/playwright` added as a devDependency (new package, justified:
reuses the Playwright infrastructure already in this repo rather than adding a
second E2E tool, and directly replaces an "inspected, not measured" claim with
one that is actually measured). `e2e/marketing-site.spec.ts` gained a WCAG 2.2
AA scan (`wcag2a`/`wcag2aa`/`wcag22aa` tags) for every one of the 13 public
routes plus the 404 page plus the mobile nav dialog opened.

First run surfaced three real, distinct findings:

1. **`link-in-text-block`**: four inline links (`SiteFooter.tsx`'s "See what is
   open", `HomePage.tsx`'s "See the full menu", `ContactPage.tsx`'s "Book
   online" and "ask for a time") relied on `hover:underline` alone, so a
   sighted mouse-less reader had no way to tell they were links inside a
   sentence of running text. Fixed narrowly: `underline underline-offset-4`,
   matching the pattern `PolicyPages.tsx` already used correctly for the same
   kind of link. No colour change.
2. **A stale test, not a regression.** `unknown route falls back to the
   not-found page, not a blank screen` asserted `/doesn't exist/i`, which
   `0e735ae`'s `NotFoundPage` redesign replaced with "We could not find that
   page" (deliberately, per that file's own comment, to give the 404 a real
   `<h1>`). E2E is not wired into CI (§5, P2, still open) so nothing had run
   this test since the copy changed. Updated the assertion to match the
   current, correct copy.
3. **`color-contrast`, real and not fixed here.** `text-primary` (`#c24d2c`)
   on `--background` (`#e8ebed`) measures 3.99:1 where small text needs 4.5:1
   (the "See the full menu" link, the decorative "404" numeral, six
   `text-brand` footer category labels); `text-primary-foreground/80` on
   `bg-primary` measures 3.62:1 in a four-item stat band ("Years experience",
   "Google rated", etc.). `src/index.css`'s own comment shows `--primary` was
   deliberately tuned once already — "4.78:1 with white" — against a
   background this token is not actually always shown on. Not retuned here:
   the salon's brand accent colour is a visual-identity decision for the
   owner, not a mechanical accessibility fix, and the fix likely differs by
   context (full-opacity foreground for the stat band vs. a decision about
   `text-primary`/`text-brand` at small sizes elsewhere). Left as a tracked P2
   below. The seven affected routes (`/`, `/about`, `/gallery`, `/services`,
   `/testimonials`, `/faqs`, `/contact`) plus the 404 page and the mobile nav
   dialog carry `test.fail()` in the e2e file with a comment pointing here, so
   the assertion keeps running for real (an unexpected pass would flag loudly
   that the gap closed) rather than being weakened or silently skipped.

All 23 tests in the file pass (14 real passes, 9 expected failures via
`test.fail()`). Full local gate re-run after these edits — `typecheck` ·
`lint` · `format:check` · `test` (still 301) · `build` — all green.

### New finding

**P2 — brand-accent text contrast under 4.5:1 at small sizes**, on `/`,
`/about`, `/gallery`, `/services`, `/testimonials`, `/faqs`, `/contact`, the
404 page and the mobile nav dialog. Evidence: axe `color-contrast`, 3.62-3.99
measured against a 4.5:1 requirement, exact nodes listed above. Needs an
owner-level decision (darken the token vs. restrict small-text use vs. accept
as-is for a small enough delta) before a code fix — not invented here per
`AGENTS.md`'s scope-discipline instruction. Tracked, not fixed.

### What is still not verified (unchanged from §7/§8)

Signed-in owner dashboard journeys, real email delivery through the now-fixed
SMTP path, contrast against the live host's actual rendered fonts (this pass
used the same local-preview method as §8), and a manual screen-reader pass.
Privacy legal review and the ICO/consent-banner decision remain open, human
items — unchanged by this pass.

### Launch decision

**READY FOR PRODUCTION.** No P0, no open P1: both P1 deploys are live and
verified. One new P2 (brand-accent contrast) is tracked, not blocking — it is
a real, evidence-backed usability gap, not an outage, a data-loss path or an
authentication issue, and the same bar §8 itself used to reach "ready" while
carrying six open P2s already. The human-judgment items (privacy legal review,
ICO/consent-banner decision, screen-reader pass) remain exactly what §8 named
them: decisions for the owner, not blockers this document can resolve.

## 10. Frontend deploy, 2026-09-04

`cpanel-deploy dist kokolettbeauty.com --keep cgi-bin --keep .well-known --go`,
built from `65f2fce` (which includes this pass's fixes from §9 plus the six
legal pages and consent gate from a concurrent session). Dry run first, no
aborts, no unexpected deletions, no `.htaccess` change so no `--with-htaccess`
needed. Verified live, not just by exit code: the hashed entry chunk served at
`https://www.kokolettbeauty.com/` matches `dist/index.html`'s
(`assets/index-zz1kT92P.js`), serves as `text/javascript` rather than the SPA
`text/html` fallback, and all six new legal routes plus `/` return 200.

All local gates re-run clean against this exact commit before deploying:
`typecheck` · `lint` · `format:check` · `lint:copy` · `test` (**321 passed**,
up from 301 — the legal/consent commit's own new tests) · `build`.


## 11. Five-track independent audit, 2026-09-05

A full re-audit, run as five parallel read-only tracks (frontend/UX/a11y,
backend/Edge Functions, database/RLS, security/privacy, and a new-user journey
trace), plus a lead pass that ran the app in a real browser. It was deliberately
briefed to treat §8's and §9's conclusions as claims to test rather than as
ground truth, and to report only what those passes missed.

It found 92 findings across the five tracks, of which 2 are P0, 11 P1, 34 P2 and
the rest P3. That is not a contradiction of §9's "READY FOR PRODUCTION": both P0s
are properties of a **fresh install**, not of the live salon, and most of the rest
are the kind of thing only a differently-framed pass surfaces. §9 was accurate
about what it looked at.

### The two P0s, both fresh-install only

Neither affects the running production database, where a `staff` row and a
published diary have existed since launch. Both would stop a new deployment dead,
and both are documentation gaps rather than code defects.

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| P0-1 | **A fresh install has no reachable owner sign-in.** No migration inserts into `public.staff`; `0051:21`'s `update ... where login_slug is null` therefore updates zero rows; `resolve_owner_slug()` never matches NULL; `SecretGate` 404s every URL. The password-reset escape hatch is triggered from inside the form you cannot reach. | `0051:21`, `0001:83`, `SecretGate.tsx:62` | **FIXED in docs.** The bootstrap SQL in `README.md` and `docs/SCHEMA.md` §6 now sets `login_slug` in the same statement, with a `gen_random_bytes` variant, and says why. |
| P0-2 | **A fresh install can never take a booking, and the dashboard says the opposite.** `available_slots()` reads `availability_slots`, which no migration seeds; the nightly generator returns early while `weekly_template` is empty. Meanwhile `BookingPageStatusCard` rendered a hard-coded `Live` badge and "Your booking page is active and accepting bookings" while reading no data at all. | `0045:50`, `0022:208`, `BookingPageStatusCard.tsx:25` | **FIXED.** The card now calls `available_slots()` through `useAvailability`, the same question the customer's browser asks, and says "Nothing open" with a link to publish hours when the answer is zero. The bootstrap docs say to publish hours before expecting a booking. |

### Accessibility: nine real WCAG failures, all fixed

§8 recorded accessibility as a "structural pass"; §9 added axe coverage and then
annotated seven routes with `test.fail()` for a brand-accent contrast gap,
deferring it as "a visual-identity call for the owner". That framing was wrong,
and the annotation is now gone.

Every failing element was `docs/DESIGN.md`'s own rule being broken, not a palette
needing a new decision: `--brand` is documented as display type at 24px and up, and
six marketing eyebrow labels used it at 12px. The fix is a new `--brand-ink` token
in the same hue (`docs/DESIGN.md` §2.4); `--brand` and `--primary` are untouched.

A second, unrelated failure surfaced at the same time because the axe sweep had
only ever run in light mode: dark `--muted-foreground` was tuned against `--card`
but is also every field placeholder's colour on `--input`, where it measured
3.91:1. The suite now runs under both colour schemes.

**Every public route is axe-clean in both themes**, verified against the built
`dist/` served with the real CSP header.

### Three Tailwind classes that produced no CSS

Found by measuring the compiled stylesheet, not by reading the config. The theme
scale replaces Tailwind's default for `colors`, `fontSize` and `boxShadow`, so a
name outside the scale is dropped in silence:

- `text-7xl` on the 404 numeral: the scale stops at `6xl`, so a 72px display
  numeral rendered at the inherited 16px. That is also what put it under the
  contrast threshold.
- `from-black/70` on the Contact page photo scrim: no `black` in the closed
  palette, so every gradient stop resolved to `rgba(0,0,0,0)` and the white
  caption sat directly on the photograph. Verified in the browser:
  `linear-gradient(..., rgba(0,0,0,0) 0%, ...)`.
- `shadow-sm` on the template preview's selected segment.

None failed a build, a lint, a type check or an axe run. `npm run lint:classes`
(`scripts/check-dead-classes.py`) is now a CI step that runs after the build and
fails on any of the three, plus on undeclared breakpoint variants (`sm:` was
resolving at v4's own 640px in seven files) and bare numeric `z-` values.

### The dashboard, opened for the first time (added later the same day)

The owner signed the audit into a real dashboard session against the production
database, which is what made the next finding possible: **the twenty dashboard
screens had never had an accessibility check of any kind**, because they sit behind
the secret sign-in gate and no automated run had ever reached them. axe, driven
through that session against the built `dist/` under the real CSP, failed **every
screen**: roughly fifty violations, six distinct causes, 8 present on all twenty
because they are chrome.

Two mistakes, repeated. An opacity modifier on a foreground token
(`text-sidebar-foreground/60` at 3.31:1, twenty-one instances; the calendar's
outside-month days at 2.15:1, the worst ratio in the app). And status text tuned
against `--card` while also being used on its own tint, failing in both themes in
opposite directions. Full detail and the numbers are in `docs/DESIGN.md` §2.4a.

All twenty screens are now clean **in both colour schemes**, re-measured in the
browser after the fix. One `select` on the Customers page also had no accessible
name; it now has one.

The `--status-*` tokens moved in both blocks, so this changes colour on the
calendar, the status chips and the appointment lists. Hue and saturation are
unchanged in every case; only lightness moved, by the smallest step that clears the
threshold.

**One finding was data rather than code, and is now fixed:** the dashboard greeted
the owner as **Koko**. `TodayPage` reads `profiles.full_name` for the staff row and
takes the first word; the live value was `Koko Lett`, the brand name split in two.
The 2026-08-31 sweep that corrected the AI prompt and two email templates did not
reach this row. Set to `Christy` on 2026-09-05 and verified on screen. The column is
display-only (greeting, sidebar, assistant); it reaches no email and no
customer-facing surface.

### Fixed in this pass

Frontend:
- **Booking error swallowed.** On `SLOT_TAKEN`, `BookPage` set the message and
  cleared the slot in the same batch, unmounting the alert that was meant to show
  it. The customer's form vanished, the grid came back one time short, and nothing
  said why. The alert now renders outside the `{slot && …}` block.
- **Six public error codes had no copy**, so `EMAIL_INVALID`, `NAME_TOO_LONG`,
  `NOTE_TOO_LONG`, `TOO_MANY_BOOKINGS`, `NAME_REQUIRED` and `TOO_MANY_REQUESTS` all
  reached the customer as "Something went wrong. Please try again." For the rate
  limits, trying again is the blocked action. Fourteen codes now have copy, with
  tests asserting none of the rate limits says "try again".
- **Two auto-advancing carousels with no pause control** (WCAG 2.2.2, Level A).
  Honouring `prefers-reduced-motion` is the 2.3.3 exemption, not a 2.2.2
  mechanism. Both now have a visible toggle and pause on hover or focus. The
  hero's `role="tablist"`/`role="tab"` (controlling `aria-hidden` slides, so a
  contract no screen reader could follow) is now plain buttons with
  `aria-current`, and the dots carry a 24px touch target.
- **`useAvailability` had no request-sequence guard**, unlike every other fetch
  hook here, and it has two triggers (an effect and a realtime subscription). A
  slower first response could overwrite a newer slot list, so the customer picks a
  time that is already gone.
- **Three window listeners with no unmount path** in `useAppointmentDrag`: a
  CalendarPage unmounted mid-gesture left them bound, and the next `pointerup`
  anywhere in the app would call `rescheduleAppointmentAsOwner` from a component
  that no longer existed.
- **Two debounced searches with no ordering guard** (`CustomersPage`,
  `RebookSearchStep`), where the sibling `ComposeContentStep` already had one.

Backend and Edge Functions:
- **A message stranded in `sending` had no recovery path**, and the System Health
  page counted only `queued` and `failed`, so it was invisible. `send-emails` now
  sweeps anything stranded for over fifteen minutes back to `queued`, and `0075`
  reports the count.
- **No third-party call had a timeout.** All four (OpenRouter twice, Google Places,
  Cloudflare DoH) now carry `AbortSignal.timeout`.
- **The SMTP client was closed on the success path only**, leaking up to 25 open
  authenticated TLS connections per run against a refusing relay.
- **A partial Google Places response deleted the reviews it omitted**, permanently,
  with `last_error` cleared because the call succeeded. Pruning now requires a full
  five-review response.
- **The prompt-injection fence was not escaped out of the data it fenced.** A
  customer could book under a name containing `RECORDS>>>` and close the fence.
- **`List-Unsubscribe-Post: One-Click` was a promise this deployment cannot keep**:
  the URL is a client-side route, the page deliberately waits for a human click,
  and the SPA rewrite answers Gmail's POST with `200` and HTML. Gmail recorded the
  unsubscribe as honoured while the subscriber stayed on the list. Header removed;
  the plain `List-Unsubscribe` URL stays.

Security and privacy:
- **The brute-force lockout keyed on the FIRST `X-Forwarded-For` entry**, which the
  caller controls, so a random header per request bought a fresh bucket and the
  5-in-15-minutes lockout on the owner's sign-in never fired. `clientIp()` in
  `_shared/auth.ts` now reads the last entry, prefers `cf-connecting-ip`, and
  discards anything that is not an IP literal.
- **Sentry redaction covered the customer magic link only.** The owner's
  `?token_hash=` recovery credential and the implicit-flow `#access_token` fragment
  both reached Sentry intact, inside the session replay that
  `replaysOnErrorSampleRate: 1` attaches to any error during recovery.
- **CSP `connect-src` omitted `upload.imagekit.io`**, so the owner's About-photo
  upload had never worked once behind the enforced policy, failing as a generic
  message with no report endpoint to record it.
- **Contact-form personal data was outside the erasure path** (`0073`). This is the
  "a table added after `0044` was never added to the erasure path" shape:
  `submit_contact_message` puts the enquirer's name, address and message into
  `email_messages.payload` with `to_email` set to the OWNER, so neither of
  `erase_customer_as_owner`'s two clauses matched.
- **An anonymous booking could rewrite an existing customer** (`0072`): overwrite
  their name and mobile, and OR marketing consent back on for someone who had
  opted out on `/my`. Same defect class as the unsubscribe resurrection `0071`
  fixed for `subscribers`.
- **"Revoke all sessions" left unredeemed magic links alive** (`0073`).
- **The reserved-slug list in SQL had drifted from `routes.ts`** by four entries,
  all real public paths (`0076`), and a four-character slug was permitted.

Database:
- **Un-cancelling could raise a raw `23P01` at the owner** (`0074`): a cancelled
  row is outside the exclusion constraint and re-enters it, and this was the only
  write path against `appointments` with no `SLOT_TAKEN` handler.
- **Three superseded slot functions were still granted to `authenticated`**
  (`0074`). `clear_day_slots` deletes published slots with no `booked_times_on()`
  union, so calling it on a day with a live booking leaves the owner's day panel
  showing nothing at that hour.

### Documentation reconciled

Sixteen contradictions were found with file:line evidence on both sides. The ones
that would actively mislead someone writing code are corrected: `book_appointment`
documented with seven arguments against the shipped six; validation step 5
described in terms of the pre-`0011` `availability_rules` engine; the
`customer_access_tokens.purpose` enum omitting `session`, the value the entire
customer session rests on; `email_messages.status` omitting `cancelled`; a
`/login` route ARCHITECTURE describes and `App.tsx` does not route; "every
transition is owner-initiated" contradicting self-service cancel three sections
later in the same file; `docs/RULES.md` naming two AI surfaces where three ship;
and the PRD's booking-link handoff that no code mints.

### Open, with owner or environment dependencies

- **The live `staff.login_slug` needs checking.** `0051:21` seeds it to `christy`,
  the owner's first name as published on the About page, in a **public** repository.
  Deliberately NOT rotated by a migration: `get_own_login_slug()` needs a session,
  a session needs the form, and the form is only at the slug, so changing it out
  from under a signed-out owner locks her out. Change it from Settings, Security,
  while signed in.
- **`.env.example` is missing `IMAGEKIT_PUBLIC_KEY`**, which
  `owner-photo-upload/index.ts:89` reads. Not fixed here: the audit session could
  not read or write files matching `.env*`.
- ~~**Migrations `0072` to `0076` are written and NOT applied.**~~ **Applied and
  verified 2026-09-05**, after a rolled-back dry run and with a rollback script
  prepared first. Each was checked by reading the stored function body back, not by
  exit code. Applying them also surfaced and fixed a separate problem: the migration
  history had diverged so far that `supabase db push` was broken on this project
  (see `docs/DEPLOYMENT.md` §0a). It is now a clean no-op and push is the normal
  path again.
- The `0071` subscriber rate limit is global, so twenty requests take `/subscribe`
  offline for an hour. Reported and not changed: `0071` is already applied, and the
  right shape (per-address plus a higher global backstop) is a decision about the
  salon's actual sign-up volume.
- `rls_test.sql` asserts table-level RLS and two RPCs. It never asserts the
  `is_owner()` guard on any of the ~35 owner-gated definer functions, and never
  exercises `book_appointment()`. The race-protection claim in §2 is true of the
  code and has no test behind it in the pgTAP suite.
- ~~`rls_test.sql` asserts table-level RLS and two RPCs and never checks the
  owner guards.~~ **Closed 2026-09-05** (`supabase/tests/rls_test.sql` §8). The set
  is derived rather than listed: anything SECURITY DEFINER and executable by
  `authenticated` must deny a non-owner with `42501`, except a named allowlist of
  the public booking surface and the five session-token customer RPCs. A new owner
  RPC is covered the day it is written; making something public is a deliberate
  edit a reviewer sees. Run against the live schema when it was written, **all 33
  owner-gated functions denied correctly**, so the guards were real and simply had
  nothing asserting them.
- ~~`availability_requests` is an unbounded anonymous write whose owner-only columns
  the submitter can set; `product_events` accepts unbounded jsonb with no retention;
  `0071`'s global signup cap is a self-inflicted outage.~~ **Closed by `0077`**,
  applied and behaviour-tested in a rolled-back transaction first: attacker-supplied
  `owner_response`/`owner_note` come back NULL, a 2500-character note raises
  `NOTE_TOO_LONG`, forty preferred dates raise `INVALID_RANGE`, a 4KB event payload
  raises `INVALID_METADATA`, an ordinary event still succeeds, and the purge job
  reports the new `product_events_deleted` key.
- ~~Still open, all P2 or P3~~ **The tail is closed, 2026-09-05.** The twenty-two
  per-row `is_owner()` policies, both mismatched owner write paths and the daily-cap
  gap in the customer reschedule went in `0078`; the accessibility items (Toast live
  region, twelve unlabelled toolbar buttons, the nested-Escape trap, checkbox size,
  the unnamed destructive chip, ten `min-h-screen` gates), the five screens that
  overstated what they knew, four Edge Function fixes and the 515-line file went in
  PR #61; and `available_slots`'s correlated count went in `0079`.

  **`0079` is worth its own note because it was measured rather than assumed.** The
  daily-cap check ran a sequential scan of `appointments` for every candidate slot,
  and this is the one query an unauthenticated visitor can make expensive. On the
  live schema in a rolled-back transaction seeded with 900 appointments across the
  90-day horizon: **607.7ms with `SubPlan 1 -> Seq Scan ... loops=424`, versus
  15.9ms with a single `HashAggregate` joined once**, a 38x improvement, and the
  estimated cost fell from 1,907,544 to 27,675. A grouped CTE rather than an index,
  deliberately: an expression index on `(starts_at at time zone tz)::date` needs an
  IMMUTABLE wrapper around a STABLE function, which is an assumption a tzdata update
  can break. Equivalence was proved at three densities (0, 40 and 200 appointments):
  419/419, 397/397 and 291/291 rows with zero difference either way.

  ~~Still genuinely open: contact-form enquiries have no table.~~ **Closed by
  `0080`**, which was a silent data-loss path rather than a missing convenience.
  `submit_contact_message()` queued one email and stored nothing, so a bounced send
  lost the enquiry, clearing the Email page destroyed both the history and the rate
  limit that counted from it, and an installation with no `staff` row discarded
  every message while showing the sender a thank-you. The RPC now writes the record
  before it notifies anyone, the limits count from the record, erasure and retention
  both reach it, and the Inbox has a third tab to read it in. Verified in a
  rolled-back transaction: stored on submit, owner still notified, the fourth
  message from one address still refused, nothing left after an erasure, the purge
  reporting its new key, and, the case that mattered, **still stored when there is
  no staff row at all**.

  One item remains, and it is a feature rather than a fix: notification read state
  lives in `localStorage`, so it does not follow the owner between devices.

### Gates, all green after the pass

`typecheck` · `lint` · `format:check` · `lint:copy` · `lint:classes` (new) ·
`test:hooks` · `test` (**343 passed**, up from 321) · `build` · the CSP
script-hash assertion · the PWA artefact assertion · Deno typecheck of all eleven
Edge Functions · `deno test` (15 passed) · `playwright test` (**65 passed, 0
failed**, across both colour schemes).

### Not verified

- **No migration was applied and no SQL was run against any database.** Docker is
  not installed on the audit machine, so `supabase db start` and the pgTAP suite
  could not run locally. `0072` to `0076` are source-reviewed only.
- **The owner dashboard was never opened in a browser.** No approved test account
  was provided, and signing into the live dashboard was out of scope. Every
  dashboard finding is source inspection.
- **Nothing about the live deployment.** `supabase/config.toml` is CLI-local,
  `.htaccess` only ships with `--with-htaccess`, and the live slug cannot be read
  from the repo.
- **`npm run test:e2e` writes to the live database.** `playwright.config.ts` loads
  `.env`, which supplies `KOKO_OWNER_EMAIL`/`KOKO_DEV_PASSWORD`, so
  `booking-race.spec.ts`'s `canRun` guard passes and the test books, cancels,
  deletes and erases against production on every run. It cleans up after itself and
  uses RFC 2606 addresses, so no mail leaves the building, but it is a live write
  and worth knowing before running the suite. It is now pinned to one Playwright
  project so the new dark-mode project does not double it.

## 12. Shipped, 2026-09-05

Everything in §11 is live. Order was deliberate: database first, then the Edge
Functions that depend on it, then the frontend.

### Database

Migrations `0072` to `0077`, applied to production. Each one was dry-run inside
a rolled-back transaction, applied individually with `supabase db query
--linked --file`, and verified by reading the stored function body back rather
than by trusting an exit code. A rollback script covering every change was
written and dry-run before anything was mutated.

`0077` was also behaviour-tested in a rolled-back transaction before it went in:
attacker-supplied `owner_response`/`owner_note` came back NULL, a 2500-character
note raised `NOTE_TOO_LONG`, forty preferred dates raised `INVALID_RANGE`, a 4KB
event payload raised `INVALID_METADATA`, an ordinary event still succeeded, and
the purge reported its new `product_events_deleted` key.

**The migration history was repaired in the same pass.** `supabase db push` was
broken on this project: local `0050` to `0071` were recorded remotely under
timestamp versions from an older apply path, so push saw twenty-two repo files
it thought were pending and would have replayed them against a database that
already had them. Replaying them proved it rather than assuming it:

```
ERROR:  42P07: relation "audit_events" already exists
```

It dies at `0052`, and push records each migration as it applies it, so it would
have stopped with the history half-repaired. `migration repair --status applied`
recorded the repo files that were genuinely already applied; `--status reverted`
cleared the sixteen duplicate timestamp rows, each checked first against the
repo file it duplicated. The history is now one-to-one from `0001` to `0077`,
and `supabase db push --linked --dry-run` reports **"Remote database is up to
date."** Push is the normal path again.

### Edge Functions

Six deployed: `owner-secret-login` v1 to v2, `send-emails` v30 to v31,
`sync-reviews` v9 to v10, `ai-assistant-chat` v13 to v14, `draft-copy` v5 to v6,
`email-diagnostics` v2 to v3. `verify_jwt` was checked after each: `false` on
`send-emails`, `sync-reviews` and `owner-secret-login`, `true` on the other
three, matching `supabase/config.toml`. A flipped flag on either cron function
would have silently stopped the outbox draining.

**The lockout fix was verified against production, not asserted.** Two POSTs to
the deployed `owner-secret-login` with a wrong slug and two *different* forged
`X-Forwarded-For` values landed in **one** rate-limit bucket
(`count(distinct ip_hash) = 1`). Under the previous code they would have been
two buckets, which is precisely why the five-in-fifteen-minutes lockout could
never accumulate. The two probe rows were then deleted so they did not consume
the owner's own lockout budget.

### Frontend

`cpanel-deploy dist kokolettbeauty.com --keep cgi-bin --keep .well-known
--with-htaccess .htaccess --go`. Dry run first: 66 deletions, every one of them
inside `assets/`, all superseded hashed chunks. `--with-htaccess` was required
this time because the CSP changed; the last deploy did not need it.

Verified live rather than by exit code:

- the hashed entry chunk served at `https://www.kokolettbeauty.com/` matches
  `dist/index.html`, and is served as `text/javascript` rather than falling
  through to the SPA's `text/html`;
- the CSP `connect-src` now carries `upload.imagekit.io`, so the owner photo
  upload can work for the first time;
- `/`, `/book`, `/contact`, `/services`, `/privacy` and `/accessibility` all
  return 200;
- direct-to-origin still returns **403**, so the Cloudflare origin lock survived
  the `.htaccess` replacement;
- `sw.js`, `manifest.webmanifest`, `robots.txt` and `sitemap.xml` all 200;
- **no sourcemaps are published.** A `.js.map` URL returns 200, but with
  `content-type: text/html`: that is the SPA fallback, not a map. `ls
  ~/kokolettbeauty.com/assets/*.map` on the server returns 0.

**axe run against the live site**, both colour schemes, all seventeen public
routes: clean.

### CI

The pull request is green, including the `database` job, which applies all 78
migrations to a fresh Postgres and then runs the pgTAP suite. That is what
validated the new owner-guard block in `rls_test.sql`, which could not be run
locally because the audit machine has no Docker.
