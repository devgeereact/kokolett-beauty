# Privacy and legal record — Kokolett Beauty UK

The audit behind the six legal pages, written 2026-09-04. This is the working
record: what the system actually collects, who receives it, how long it is kept,
and what is still open. The pages in `src/pages/*Page.tsx` are the public
statement; this file is the evidence and the outstanding list.

**This is not legal advice, and nothing here has been reviewed by a solicitor.**
Items marked REQUIRES LEGAL REVIEW are questions of law or interpretation.
Items marked REQUIRES OWNER INPUT are business facts only Christy can confirm.

Controller: Christy, sole trader, trading as Kokolett Beauty UK. No company
number. Address and phone live in `booking_settings`, not in the repo.

---

## 1. Data inventory

Every row was read off the schema or the code, not assumed. "Evidence" is where
to look if a row is ever questioned.

| Data | Fields | Collected at | Purpose | Stored in | Retention | Evidence |
|---|---|---|---|---|---|---|
| Booking identity | `full_name`, `email`, `mobile` | `/book` | Making and confirming the appointment | `customers` (Supabase, London) | Until erasure; erasure anonymises if payments exist | `BookPage.tsx:29-35`, `0002_salon.sql:100-113` |
| Booking note | `appointments.customer_note` | `/book` | Preparing for the appointment | `appointments` | Nulled on erasure | `0042:78` |
| Marketing choice | `marketing_consent`, `consent_updated_at` | `/book`, `/my` | Deciding whether to email news | `customers` | Until withdrawn | `0039:155-162`, `0060` |
| Availability request | `full_name`, `email`, `mobile`, `preferred_dates`, `preferred_times`, `notes` | `/request-availability` | Offering a time when none is published | `availability_requests` | Two years, automatic | `0002_salon.sql:217-235`, `0046:22-57` |
| Contact message | `full_name`, `email`, `message` | `/contact` | Answering the enquiry | `email_messages.payload` | Two years, automatic | `contactService.ts:18-22`, `0047:56-60` |
| Mailing list | `email`, `full_name`, `source`, `unsubscribed_at` | `/subscribe` | Sending the salon's own news | `subscribers` | Until unsubscribed; unsubscribe is sticky | `0018:169-177`, `0071` |
| Payment record | `amount_pence`, `note`, `recorded_by` | Owner dashboard | Accounting for takings | `payments` | Survives erasure by design | `0027_payment_log.sql:18`, `0042:86-87` |
| **Owner's private note** | `customers.notes` | Owner dashboard | Looking after the client safely | `customers` | Deleted on erasure | `CustomerDetailPanel.tsx:379-388` |
| Sign-in token | `token_hash` (SHA-256), `expires_at` | Magic link | Letting a customer see their own bookings | `customer_access_tokens` | 30 minutes, single use, purged daily | `0002_salon.sql:242-253` |
| Customer session | token + customer record | Redeeming a link | Keeping the customer signed in | Browser `localStorage` | 30 days or sign-out | `customerSessionService.ts:15` |
| Sent email | `to_email`, `subject`, `payload` | Automatic | Delivering confirmations and reminders | `email_messages` | Two years, automatic | `0046:22-57` |
| Google reviewers | `author_name`, `profile_photo_url`, `body` | Sync job | Showing public reviews | `google_reviews` | Refreshed by sync | `0017:34-45` |
| Owner sign-in attempts | `ip_hash` (SHA-256) | Secret login slug | Rate limiting an attack | `secret_login_attempts` | 24 hours | `0051:28-33` |
| Change history | `actor`, `action`, `summary` | Owner actions | Knowing who changed what | `audit_events` | Two years | `0052:25-43` |
| Booking funnel | `event_name`, random `session_id` | `/book`, only with consent | Counting where booking is abandoned | `product_events` | No personal data at all | `0064:21-32`, `analytics.ts` |

**The private note is the sensitive row.** Its own placeholder text is
"Allergic to ammonia", so in practice it holds health information, which UK GDPR
Article 9 treats as special category. The privacy page now says so plainly and
explains why it is kept.

### Recipients

| Recipient | What it receives | Where | Evidence |
|---|---|---|---|
| Supabase | Everything above | London (`eu-west-2`) | `src/lib/supabase.ts` |
| cPanel SMTP host | Outgoing email and its contents | UK | `send-emails/index.ts:127-175` |
| Cloudflare | Connection metadata, IP | Global edge | `.htaccess:15-21` |
| Sentry | Error reports, masked replay on error | EU | `sentry.client.ts:16-46` |
| ImageKit | Image requests, IP | CDN | `src/lib/imagekit.ts` |
| Google Fonts | Font requests, IP | Google | `index.html` preconnect and stylesheet |
| Google Places | Place ID only, outbound | Google | `sync-reviews/index.ts:114` |
| **OpenRouter** | **Customer names, customer notes, message text** | **Outside the UK** | `ai-assistant-chat/index.ts:460`, `draft-copy/index.ts:173` |

OpenRouter is the one recipient that gets identifiable content. It was
undisclosed until this change.

---

## 2. Cookies and browser storage

The site sets **no cookies**. `document.cookie` has no hits in `src/`,
`public/` or `index.html`. It does use browser storage, which PECR treats the
same way.

| Key | Store | Category | Essential | Purpose |
|---|---|---|---|---|
| `kokolett-consent` | local | Strictly necessary | Yes | Records the choice below |
| `kokolett-theme` | local | Preference | Yes, once chosen | Light or dark. Written only after the visitor uses the toggle (fixed 2026-09-04) |
| `kokolett-customer-session` | local | Strictly necessary | Yes | The customer's own sign-in |
| `kb.install-prompt-dismissed` | local | Preference | Yes | Stops the install prompt reappearing |
| `sb-<ref>-auth-token` | local | Strictly necessary | Yes | Supabase session, owner only |
| `kokolett-analytics-session` | **session** | **Analytics** | **No** | **Consent required.** Random per-tab id for the funnel |
| `kokolett-sidebar-collapsed`, `-date-format`, `-time-format`, `-notifications-read`, `-notifications-archived`, `-notification-preferences`, `-ai-conversations` | local | Preference | Owner only | Dashboard layout and drafts. No customer meets these |
| `imagekit-media`, `supabase-api`, `google-fonts`, precache | Cache Storage | Strictly necessary | Yes | Offline copy. `supabase-api` is scoped to `booking_settings` and `weekly_template` only (`vite.config.ts:182-190`) |

No third-party analytics, tag manager, advertising pixel, CAPTCHA, map embed or
social embed exists anywhere. The CSP at `.htaccess:178` is the enforcing list
of every origin the browser may talk to.

---

## 3. Retention

| Data | Period | Mechanism |
|---|---|---|
| Access tokens | 30 minutes, single use | `purge-access-tokens`, daily |
| Sent email, availability requests | 2 years | `purge_expired_personal_data()`, weekly, `0046` |
| Audit events | 2 years | `purge-audit-events`, `0052` |
| Secret login attempts | 24 hours | `purge-secret-login-attempts` |
| Customer record | Until erasure requested | `erase_customer_as_owner()`, `0042` |
| Appointment history | Retained as a business record; anonymised rather than deleted where a payment exists | `0042:86-100` |
| Payment records | Not deleted | REQUIRES LEGAL REVIEW: HMRC ordinarily expects six years for a sole trader, and no rule currently enforces an upper bound |

---

## 4. Consent

One optional category, built 2026-09-04:

- `src/lib/consent.ts` is the store. Undecided reads as no. A malformed record,
  an older version, or a storage failure all read as undecided.
- `src/components/public/ConsentBanner.tsx` is the control, mounted from
  `SiteShell` so it appears on the public site only. Accept and reject are the
  same component at the same size; nothing is preselected; there is no dismiss
  that grants consent by silence; it does not trap focus or block the page.
- `src/lib/analytics.ts` gates on `analyticsAllowed()` before it reads or
  writes anything, so an undecided visitor has nothing stored.
- `/cookies` carries the full inventory and a live control to change or
  withdraw. Withdrawing deletes the stored id immediately.
- Tests: `src/lib/consent.test.ts`, `src/lib/analytics.test.ts`,
  `src/components/public/ConsentBanner.test.tsx`.

---

## 5. Issues found, and what happened to them

| Priority | Issue | Status |
|---|---|---|
| P1 | OpenRouter received customer names and notes and was absent from the privacy notice, which claimed its supplier list was complete and that none of them saw a name | Disclosed on `/privacy` |
| P1 | Analytics wrote a device identifier with no consent mechanism of any kind | Gated, banner built, tested |
| P2 | The notice said name, email and mobile were "the whole list"; contact messages, availability requests, mailing list, payments and the owner's private notes were undisclosed | Rewritten |
| P2 | Health information in the private note was undisclosed and had no stated basis | Disclosed; basis REQUIRES LEGAL REVIEW |
| P2 | No accessibility statement, no complaints route, no separate cookie notice | Three pages added |
| P2 | Sentry's error-triggered session replay was undisclosed | Disclosed, with the masking described accurately |
| P2 | No patch-test rule anywhere, on a site that advertises colour | Added to the booking policy, owner-confirmed at 48 hours |
| P3 | `kokolett-theme` was written on first mount for visitors who never touched the toggle | Now written only on a real change |
| P3 | `robots.txt` disallowed the bare prefix `/access`, which would also have hidden the new `/accessibility` page | Changed to `/access/`; `sitemap.test.ts` made boundary-aware |
| P2 | Five colour-contrast failures on `/` (`HomePage.tsx:243`, `text-primary-foreground/80` on `bg-primary`, 3.62:1 against a 4.5:1 threshold). The existing axe sweep misses them because the strip renders after `networkidle` | Disclosed on `/accessibility`. Not fixed: changing a brand colour is the owner's decision, and it is already tracked in `docs/KOKO_GAP.md` |

### Found, deliberately not fixed here

Both are behaviour changes to a live mailing system and need Christy's
agreement first. Neither is a legal-page edit.

1. **Booking consent goes nowhere.** The tick on `/book` sets
   `customers.marketing_consent` (`0039:155-162`), but broadcasts read only
   `subscribers` (`0058:64-66`). Nothing joins the two, so somebody who ticks
   the box at booking is never actually emailed. Consent is collected and not
   acted on, which is the mirror image of the usual problem but still a
   mismatch between what the form promises and what happens.
2. **One-off owner emails carry no unsubscribe link.** `owner_broadcast` has
   both the in-body link and the RFC 8058 headers; `owner_custom_message` has
   neither (`_shared/templates.ts:963-986`). If a one-off message is ever
   promotional rather than about a specific appointment, PECR expects an opt-out
   in it.

---

## 6. Owner input required

1. **Register with the ICO and pay the data protection fee.** A sole trader
   holding customer records normally has to. Check and register at
   `ico.org.uk/registration`. This is the top item: it is a legal duty with a
   fee attached, not a website change. Once registered, the number can go on
   `/privacy`.
2. **Under-16 clients.** `/terms` currently says 18 or over to book online and
   `/privacy` says a parent should book for anyone under 18. Confirm that
   matches what the salon actually does.
3. **Complaint timings.** `/complaints` promises acknowledgement within three
   working days and an answer within fourteen. Confirm those are achievable.
4. **Accessibility reply time.** `/accessibility` promises five working days.
5. **The assistant.** Now that OpenRouter has to be disclosed as receiving
   customer names and notes, confirm the assistant is worth keeping. If it is,
   check whether OpenRouter's terms include a data processing agreement.
6. **The published address.** `index.html`'s structured data carries a street
   address and mobile number. If that is a home address, decide whether it
   should be public.
7. **Insurance.** Confirm the salon's insurer's patch-test requirement matches
   the 48 hours now stated on the site.

---

## 7. Legal review required

1. The Article 9 basis for holding allergy and scalp information. The page
   currently describes it as explicit agreement given when the client tells the
   salon; whether that is sufficient, and whether an Article 9 appropriate
   policy document is needed, is a lawyer's call.
2. The international transfer to OpenRouter: whether an IDTA or the UK addendum
   to the standard contractual clauses is required, and whether a transfer risk
   assessment is needed.
3. Whether the Consumer Contracts (Information, Cancellation and Additional
   Charges) Regulations 2013 apply to an appointment booked online, and whether
   the regulation 28 exemption reaches hairdressing. In practice the salon
   charges nothing for a cancellation at any notice, so the question is about
   what must be *disclosed*, not about money.
4. The liability wording in `/terms`.
5. Whether a sole trader running this site needs anything further under the
   Provision of Services Regulations 2009 in the way of published business
   information.
6. Retention of payment records, and the absence of an upper bound on
   appointment history.

---

## 8. Readiness

**TECHNICALLY READY FOR LEGAL REVIEW.**

The pages describe what the software does and every claim on them is traceable
to code. The consent control works and is tested. What remains is not code: an
ICO registration, a handful of business facts, and a qualified read of the six
questions above.

Nothing here has been deployed. `docs/KOKO_GAP.md` keeps privacy and legal open
until a qualified person has read the pages.

### Before publishing

- [ ] Register with the ICO and pay the fee
- [ ] Confirm the owner-input list in section 6
- [ ] Have a solicitor read `/privacy`, `/terms` and `/booking-policy`
- [ ] Decide on the two marketing defects in section 5
- [ ] Deploy, including `.htaccess` if it has changed, and check all six pages
      resolve on the live domain
