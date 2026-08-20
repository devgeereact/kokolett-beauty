# Go-live checklist — everything that has to be keyed in by hand

> **Status, updated 2026-08-19 22:05 UTC.** Everything in [Not done](#not-done) is
> now done. The three items closed since the 21:40 audit:
>
> 1. **The Supabase redirect allow-list** was still pointing at the dead
>    `koko.gakinz.com` domain and had no `www.` entry at all — confirmed by the diff
>    `supabase config push` printed before applying it: `site_url` went from the
>    bare, scheme-less `"kokolettbeauty.com"` to `"https://www.kokolettbeauty.com"`,
>    and `additional_redirect_urls` dropped `koko.gakinz.com` and gained
>    `https://www.kokolettbeauty.com/**`. `supabase/config.toml` had declared the
>    correct values since 2026-08-11 (`git blame`) — nobody had run `config push`
>    to sync them to the live project until now. Re-ran the push immediately after;
>    it reported `up_to_date`, confirming the change stuck. One side effect from the
>    same `[auth]` block: `mfa.totp.enroll_enabled`/`verify_enabled` also flipped
>    `false → true`, matching what `config.toml` already declared.
> 2. **`.env.example`** carried six dead scaffold variables
>    (`MAGIC_LINK_SECRET`, `MAGIC_LINK_TTL_MINUTES`, `AI_PROVIDER_API_KEY`,
>    `AI_MODEL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — zero references
>    anywhere in `src/` or `supabase/`, left over from the initial scaffold commit)
>    and was missing four the app actually needs (`OPENROUTER_API_KEY`,
>    `GOOGLE_PLACES_API_KEY`, `EMAIL_CRON_SECRET`, `REVIEWS_CRON_SECRET`), on top of
>    the `VITE_SALON_*` block this document already knew about. Rewritten to match
>    exactly what `src/lib/env.ts` and the edge functions read.
> 3. **Section 4.7's structured data** was added to `index.html`: `address`
>    (`Redbourne Dr, London SE28 8RX`), `telephone` (`+44 7707 906408`), and
>    `openingHoursSpecification` (Monday–Sunday, 08:00–20:00, given directly by the
>    owner). Validated by parsing the `<script type="application/ld+json">` block
>    with `JSON.parse` — well-formed. Not independently cross-checked against
>    `booking_settings`/the published weekly template (no DB access from this
>    session); if the salon's actual hours vary by day, update the
>    `openingHoursSpecification` array to match — Google accepts multiple
>    `OpeningHoursSpecification` entries, one per distinct day-range (see the old
>    per-day example this replaced, in git history).
>
> An earlier version of this banner claimed sections 1 to 6 were complete. That was
> wrong: it was written from a summary rather than from checking each claim. This
> pass verified the live Supabase project directly (`supabase migration list`,
> `functions list`, `secrets list`, `config push`) and the live site over HTTPS —
> not from a summary either.

Generated 2026-08-19, alongside what is now
`docs/history/2026-08-19-ship-week-hardening-audit.md` (then `docs/FEATURE_FIX.md`).
That document records what was
changed in the repository; this one is the part no amount of code could supply. Work
through it top to bottom: the order matters in section 3, and section 4 is what proves
the rest of it landed.

Anything written `<like this>` is a value only you have.

---

## Not done

Nothing. See the banner above for what was closed and when.

---

## 1. `.env.example` — the tracked template

**Done, verified 2026-08-19 21:45 UTC.** This file is committed, so a fresh clone
inherits whatever is in it. It used to seed the dead `koko.gakinz.com` domain, six
dead scaffold variables (`MAGIC_LINK_SECRET`, `MAGIC_LINK_TTL_MINUTES`,
`AI_PROVIDER_API_KEY`, `AI_MODEL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — zero
references anywhere in `src/` or `supabase/`, left over from the initial scaffold
commit), and a `VITE_SALON_*` block nothing reads. Rewritten to exactly what
`src/lib/env.ts` and the edge functions actually read — confirmed by grepping every
`Deno.env.get`/`env(...)` call site across `supabase/functions/`:

```dotenv
# ---- Browser (inlined into the bundle at build time — nothing secret) -------
VITE_APP_URL="https://www.kokolettbeauty.com"
VITE_SUPABASE_URL="https://erqrfjlozqyhogneqraj.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon key>"
VITE_IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/<your imagekit id>"
VITE_SENTRY_DSN="<sentry dsn>"

# ---- Server only. NEVER prefix with VITE_ and never reference from src/ -----
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected by the
# platform automatically — do not set them.
SMTP_HOST="<cpanel mail host>"
SMTP_PORT="465"
SMTP_USER="booking@kokolettbeauty.com"
SMTP_PASSWORD="<mailbox password>"
SMTP_FROM_EMAIL="booking@kokolettbeauty.com"
SMTP_FROM_NAME="Kokolett Beauty UK"
EMAIL_CRON_SECRET="<long random string>"
REVIEWS_CRON_SECRET="<a different long random string>"
OPENROUTER_API_KEY="<openrouter key>"
GOOGLE_PLACES_API_KEY="<google places key>"
SITE_URL="https://www.kokolettbeauty.com"
ALLOWED_ORIGIN="https://www.kokolettbeauty.com"
```

Those five `VITE_*` variables are the only ones `src/lib/env.ts` reads, as static
`import.meta.env.VITE_*` members — anything not on that list is not inlined and not
shipped. `SITE_URL`/`ALLOWED_ORIGIN` both fall back to
`https://www.kokolettbeauty.com` in every function that reads them, so they're
optional, but the live project has both set explicitly (section 3.1).

---

## 2. `.env` — the file the production build actually reads

Copy the template above and fill in the real values.

### `VITE_APP_URL` and the redirect allow-list — done, verified 2026-08-19 21:45 UTC

`src/pages/LoginPage.tsx:98` uses `VITE_APP_URL` as the owner's magic-link
`emailRedirectTo`. Grepping the live production bundle
(`https://www.kokolettbeauty.com/assets/index-*.js`) for `kokolettbeauty.com` finds
only `https://www.kokolettbeauty.com` — no bare apex string anywhere — so the deployed
build was already compiled with the correct `www.` value before this pass started.

What was still wrong was the **Supabase side**: the live project's redirect allow-list
didn't match `supabase/config.toml`, which has declared the correct values since
2026-08-11 (`git blame supabase/config.toml`) but had never been pushed. Fixed by
running `supabase config push --project-ref erqrfjlozqyhogneqraj`; the diff it printed
before applying confirmed the live `site_url` was still the scheme-less
`"kokolettbeauty.com"` and `additional_redirect_urls` still had `koko.gakinz.com/**`
and no `www.` entry. It now matches `config.toml` exactly:

```toml
# supabase/config.toml [auth] — this is the source of truth; edit here, then
# `supabase config push`, never the dashboard directly (that's what drifted).
site_url = "https://www.kokolettbeauty.com"
additional_redirect_urls = ["https://www.kokolettbeauty.com/**", "http://localhost:5082/**"]
```

No apex (`https://kokolettbeauty.com/**`) entry — deliberate, not an oversight.
`VITE_APP_URL` only ever resolves to the single build-time `www.` value, so nothing
in this app ever asks GoTrue to redirect to the apex. (The apex domain itself is
still publicly reachable over HTTPS and serves the same SPA — that's a possible SEO
duplicate-content cleanup, not an auth gap.)

`localhost:5082` matters because that is the project's fixed dev port (`strictPort`).
The README used to tell people to open `5173`, which is not on the list and never
worked.

**If this drifts again:** edit `supabase/config.toml`, then run
`supabase config push --project-ref erqrfjlozqyhogneqraj` and confirm it reports
`"auth": "updated"` (or `"up_to_date"` if nothing changed). Don't hand-edit the
dashboard's URL Configuration screen directly — that's exactly how this drifted the
first time.

### `VITE_SENTRY_DSN`

Currently a placeholder. `src/lib/sentry.ts:11-20` detects placeholders and makes
`initSentry()` a no-op, so **there is no error reporting on the live site at all**. Put
a real DSN in, or decide deliberately to ship the first week blind. The Sentry wiring
itself is good: magic-link tokens are stripped from URLs and breadcrumbs before
anything is sent.

Use the **EU** Sentry org. Region is fixed at project creation and cannot be changed
later.

### `VITE_IMAGEKIT_URL_ENDPOINT`

Still `https://ik.imagekit.io/your_imagekit_id`, and that is fine. Only one screen
uses it, the service images in the dashboard's Services catalogue, and all 49 menu
items have a null `image_path`, so nothing anywhere builds an ImageKit URL. Set it
when the salon starts uploading photographs.

---

## 3. Supabase — secrets, migrations, functions

**Order matters.** Migration `0037` has to be applied before the new `send-emails`
function is deployed. Deployed the other way round, every transactional email switches
to the placeholder draft copy seeded in `0032` on the very next drain.

### 3.1 Edge Function secrets

```bash
REF=erqrfjlozqyhogneqraj

supabase secrets set --project-ref $REF \
  SMTP_HOST='<cpanel mail host>' \
  SMTP_PORT='465' \
  SMTP_USER='booking@kokolettbeauty.com' \
  SMTP_PASSWORD='<mailbox password>' \
  SMTP_FROM_EMAIL='booking@kokolettbeauty.com' \
  SMTP_FROM_NAME='Kokolett Beauty UK' \
  EMAIL_CRON_SECRET='<long random string>' \
  REVIEWS_CRON_SECRET='<a different long random string>' \
  OPENROUTER_API_KEY='<openrouter key>' \
  GOOGLE_PLACES_API_KEY='<google places key>' \
  ALLOWED_ORIGIN='https://www.kokolettbeauty.com' \
  SITE_URL='https://www.kokolettbeauty.com'
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the
platform. Do not set them.

Generate the two cron secrets with something you will not be tempted to reuse:

```bash
openssl rand -hex 32
```

### 3.2 Vault entries

The cron jobs read these from Vault, not from function secrets, because a migration is
permanent and a secret in one is permanent too. Run in the SQL editor. The
`EMAIL_CRON_SECRET` value must be **byte-identical** to the one you set above.

```sql
select vault.create_secret('<EMAIL_CRON_SECRET value>',   'email_cron_secret',
                           'Shared secret for send-emails');
select vault.create_secret('https://erqrfjlozqyhogneqraj.supabase.co/functions/v1/send-emails',
                           'send_emails_url', 'Endpoint the scheduled drain posts to');

select vault.create_secret('<REVIEWS_CRON_SECRET value>', 'reviews_cron_secret',
                           'Shared secret for sync-reviews');
select vault.create_secret('https://erqrfjlozqyhogneqraj.supabase.co/functions/v1/sync-reviews',
                           'sync_reviews_url', 'Endpoint the scheduled review sync posts to');
```

Both functions **fail closed**: with the secret missing they refuse every caller,
including their own cron job, silently. If the outbox stops draining, check here first.

### 3.3 Validate the three new migrations before applying them

`0037`, `0038` and `0039` have **never been executed anywhere**. This machine has no
local Postgres, no Docker and no `psql`, so they were verified by diffing the
regenerated `book_appointment()` against `0022`'s (only the intended additions differ)
and by checking dollar-quote and block balance. That is not the same as running them.

Either push to a Supabase branch, or run them inside a transaction you roll back. In
the SQL editor:

```sql
begin;

-- paste the contents of 0037_email_templates_opt_in.sql
-- paste the contents of 0038_close_privileged_grants.sql
-- paste the contents of 0039_book_appointment_input_rules.sql

-- Prove 0039 still books, and still refuses what it should:
select * from public.book_appointment(
  '<a real free slot, e.g. 2026-08-25T10:00:00Z>'::timestamptz,
  'Test Customer', 'not-an-email', '07700900123', null, false);
-- expected: EMAIL_INVALID

rollback;   -- ← nothing above is kept
```

Check `rollback;` actually ran before you close the tab. Then apply for real:

```bash
supabase db push --linked
```

### 3.4 Deploy the functions — this order

```bash
REF=erqrfjlozqyhogneqraj

# New. EmailPage calls it on every message selection; undeployed, every
# detail pane shows an error.
supabase functions deploy render-email-preview --project-ref $REF

# Changed. MUST come after 0037 is applied.
supabase functions deploy send-emails --project-ref $REF --no-verify-jwt

# Changed: message caps, role validation, tool results fenced as data.
supabase functions deploy ai-assistant-chat --project-ref $REF

# Changed: per-address rate limit.
supabase functions deploy customer-access --project-ref $REF --no-verify-jwt
```

`supabase/config.toml` now records each function's `verify_jwt` setting explicitly, so
the flags above match what the file says rather than depending on shell history.

### 3.5 Confirm the cron jobs exist

```sql
select jobname, schedule, active from cron.job order by jobname;
```

Expect `drain-email-queue` every `*/5 * * * *`, plus the approval-expiry and
review-sync jobs.

---

## 4. The salon's own data — entered in the dashboard, not in a file

None of this was invented, deliberately. The footer, the policy pages and the
structured data all render nothing where these are blank.

Sign in at `https://www.kokolettbeauty.com/login` as `booking@kokolettbeauty.com`.

### 4.1 Settings → Business

| Field              | Column                               | Notes                                                                                                                             |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Address            | `booking_settings.address_line`      | Appears in the footer as a Google Maps link, and on the policy pages. Leave blank only if you genuinely do not want it published. |
| Phone number       | `booking_settings.phone`             | Rendered as a `tel:` link, so customers can tap to call.                                                                          |
| Instagram          | `booking_settings.instagram_url`     | Full profile URL. The footer icon is hidden without it.                                                                           |
| Google review link | `booking_settings.google_review_url` | The button in the "how was it?" email after an appointment.                                                                       |
| Google Place ID    | `booking_settings.google_place_id`   | Needed by the reviews sync. Find it with Google's Place ID finder.                                                                |

### 4.2 Settings → Business, booking rules

Defaults are in brackets. Change what does not match how the salon actually runs.

| Field                                    | Column                     | Default |
| ---------------------------------------- | -------------------------- | ------- |
| Slot spacing (min)                       | `slot_granularity_min`     | 15      |
| Tidy-up time (min)                       | `default_buffer_min`       | 10      |
| Minimum notice (min)                     | `lead_time_min`            | 120     |
| Book up to (days)                        | `max_horizon_days`         | 90      |
| Max per day                              | `max_appointments_per_day` | 8       |
| Free cancellation (h)                    | `cancellation_window_h`    | 24      |
| Hold first-time bookings for my approval | `approve_first_time`       | on      |
| Approval window (hours)                  | `approval_window_h`        | 12      |

Note on **Hold first-time bookings**: with it off, the Approvals queue is structurally
empty and the Inbox now says so plainly. That empty state is correct, not a fault.

### 4.3 Settings → Organisation

Business name, category and country. Defaults are already "Kokolett Beauty UK",
"Hair Salon", "United Kingdom" — confirm rather than retype.

### 4.4 Availability → working hours

`/dashboard/weekly`. Set the usual week, then apply it forward. Hours are **published
slots**, not a rule that gets evaluated: `availability_rules` was dropped in
migration `0011`, and what a customer sees is explicit rows in `availability_slots`
generated from the weekly template. Add known closures on the same screen.

Nothing is bookable until this is done. An empty diary is why the booking page shows
"No times open at the moment" and pushes customers to the request form.

### 4.5 Appointment type

`/dashboard/appointment`. One appointment type covers everything; the customer
describes what they want in a sentence.

- **What it is called** — the name that appears on a booking
- **How long it takes** — the default block length, used for slot generation
- **Price (£)** — see below
- **Description** — shown on the booking page

On price: the customer-facing pages quote no price anywhere, on purpose, and a check of
`HomePage`, `BookPage`, `MyBookingsPage` and `src/components/public/` confirms none
renders one. A full head of knotless braids and a trim are not the same appointment.

The appointment type is nonetheless set to £42.50, and `book_appointment()` copies that
onto every booking, so `appointments.price_pence` is 4250 rather than 0. The Today
money tile used to sum it and call the result "Est. revenue" — a nominal figure the
salon does not actually charge. It now reads `today_collected_pence` from the
`payments` table and is labelled "Taken today", which is money genuinely recorded.

**It will read £0.00 until the owner starts logging payments.** `payments` is empty
today. She records one from the Calendar, Appointments or Today screen when marking an
appointment complete. That is the intended flow, but it is a change from a tile that
always showed a number, so it is worth telling her.

### 4.6 Services → the menu shown on the website

`/dashboard/services`. Descriptive, not bookable. Per item: group, name, a free-text
note ("about 4 hours", "half a day" — never a price), duration, buffer, optional image.

**This is the one uncontrolled scope surface in the whole app.** Whatever is typed here
renders verbatim on the public homepage. The salon is women's hair only: cutting,
colouring, styling, braids, locs, weaves, treatments. Not nails, brows, lashes,
aesthetics, barbering or unisex.

### 4.7 The structured data — done, 2026-08-19 22:05 UTC

`index.html`'s `HairSalon` block now carries `address`
(`Redbourne Dr, London SE28 8RX`), `telephone` (`+44 7707 906408`) and
`openingHoursSpecification` (Monday–Sunday, 08:00–20:00 — given directly by the
owner, not read from `booking_settings`). If the salon's actual published hours vary
by day, replace the single entry with one `OpeningHoursSpecification` object per
distinct day-range, matching whatever `/dashboard/weekly` actually publishes:

```jsonc
"openingHoursSpecification": [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday"],
    "opens": "09:00",
    "closes": "18:00"
  },
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "opens": "09:00",
    "closes": "17:00"
  }
]
```

---

## 5. Build and deploy

The web host has no Node, so the build runs locally and only artefacts are shipped.

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

Before uploading, check the artefact rather than the `.env` file:

```bash
MAIN=$(ls -S dist/assets/index-*.js | grep -v '\.map$' | head -1)

grep -c 'https://kokolettbeauty\.com' "$MAIN"        # 0  (the apex must not appear)
grep -c 'https://www\.kokolettbeauty\.com' "$MAIN"   # 1 or more
grep -oE '[a-z0-9]+\.ingest\.[a-z.]*sentry\.io' "$MAIN" | head -1   # a real DSN host
```

Two traps here, both of which caught me when I ran it:

- **`ls dist/assets/index-*.js | head -1` picks the wrong file.** There are two,
  and the one that sorts first is a 138-byte stub, not the entry chunk. Sort by
  size with `ls -S`.
- **Grepping for `your-dsn` always matches.** `src/lib/sentry.ts` carries that
  string inside the regex it uses to _detect_ a placeholder DSN, and that regex
  is compiled into the bundle. A hit proves the guard exists, not that the DSN
  is fake. Look for a real ingest host instead.

Then upload **everything inside `dist/`, plus the repo-root `.htaccess`**, into
`~/kokolettbeauty.com/`.

`.htaccess` is not in `dist/` and never has been. It is a separate manual copy, and
forgetting it 404s every deep link (`/book`, `/dashboard`, every `/access/<token>` in
every email) while the home page keeps working perfectly. CI now fails if the file
disappears from the repo, but it cannot check that you copied it.

Do not ship `*.map` — 5.3 MB of the 6.7 MB `dist/` is source maps, and they belong in
Sentry, not the public docroot.

---

## 6. Verification — a 200 proves nothing here

The SPA rewrite plus `ErrorDocument 404 /index.html` answers **every** path with
`index.html`, including a missing JavaScript bundle. A partial upload therefore looks
perfectly healthy. This has already caused one outage. Check the content type:

```bash
# Take the hash from the built dist/index.html
curl -sI https://www.kokolettbeauty.com/assets/index-<hash>.js | grep -i content-type
# MUST be text/javascript. text/html means the bundle is missing and the
# rewrite is answering for it.

curl -s https://www.kokolettbeauty.com/ | grep -c 'og:image'   # 1
curl -sI https://www.kokolettbeauty.com/book | head -1          # 200
```

### Then, by hand, with the owner watching

1. Book a real appointment on a phone.
2. Confirm the email arrives, and that the subject still carries the booking reference.
3. Open the magic link, reschedule, then cancel.
4. Check each step shows correctly in the dashboard.
5. Open the Inbox and confirm there is **no customer she does not recognise**. Four
   invented ones used to appear there whenever the queue was empty.
6. Sign the owner out and back in with a magic link, to prove `VITE_APP_URL` is right.

### Email specifically, before trusting it

Queue one of each template to a test address and confirm three things: the subject
still carries the booking reference, the plain-text part still carries date, service
and reference, and the HTML is the designed template rather than the placeholder draft
seeded in `0032`. If any of those is wrong, `0037` did not apply before `send-emails`
was deployed.

Every email sent **before** this deploy will show "sent before the outbox started
keeping its contents". That is expected: older rows were scrubbed on send. Only new
mail previews.

---

## 7. Known gaps, deliberately left open

Not blockers for this week, but do not let them fade from view.

- **CSP is still `Report-Only`.** It has never run against real traffic. Its
  `connect-src` no longer needs `inn.gs`; trim that, watch it for a week, then promote
  the header to enforcing.
- **`minimum_password_length = 6`** in `supabase/config.toml`. `src/lib/password.ts`
  enforces stronger rules, but only in the browser.
- **The calendar has no keyboard equivalent for drag-to-reschedule.** The Move panel is
  the fallback, reached through the edit modal.

---

## After the handover

Verified against the live project on 2026-08-19. [Not done](#not-done) above is now
empty.

|                         |                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations              | `0001`–`0039` applied, 0 pending                                                                                                      |
| `email_templates`       | 18 active, **0 automated** — an unedited draft cannot replace tested copy                                                             |
| Privileged grants       | `drain_email_queue`, `sync_google_reviews`, `booked_times_on` all `anon=false, authenticated=false`                                   |
| `google_place_snapshot` | public read policy removed; only the owner policy remains                                                                             |
| `book_appointment()`    | rolled-back probe: bad email, single-word name and over-long name all rejected; a valid booking still accepted                        |
| Edge Functions          | all seven ACTIVE, `verify_jwt` matching `config.toml` exactly                                                                         |
| Cron                    | `drain-email-queue` succeeded at 20:50, after both the revoke and the redeploy                                                        |
| Outbox                  | nothing queued, nothing pending that would bounce                                                                                     |
| Site                    | entry chunk serves `content-type: text/javascript`, all nine routes 200, no `.map` reachable, `.htaccess` and `.well-known` preserved |
| Metadata                | og:title, og:description, og:image, twitter:card and canonical all live; description is customer copy                                 |

**Demo data was removed from the live database.** 14 of 16 customers, 28 of 30
appointments, all 5 availability requests, both subscribers and 76 outbox rows were
seeded rows on `@example.invalid`. The owner would have opened her dashboard to
fourteen people she had never met, and her Reports figures would have counted them.
Deleted with the filter the seeder itself documents, dry-run first, rollback confirmed
before committing. Two real customers and their completed appointments remain.

Two orphaned reminders aimed at `demo-test@example.com`, scheduled for the 23rd and
24th, were retired rather than left to bounce against a reserved domain in the salon's
first week of sending.

**What the 21:45 pass re-checked directly, versus carried over from 21:40:**
Migrations, Edge Functions, and Edge Function secrets were re-queried live
(`supabase migration list --linked`, `functions list`, `secrets list`) and the site
rows were re-curled — all match this table. `email_templates`, privileged grants,
`google_place_snapshot`, the `book_appointment()` probe, cron, the outbox, and the
demo-data removal were **not** re-run this pass — no migration, deploy, or data
change happened between 21:40 and 21:45 that could have moved any of them, so they're
carried over rather than re-verified. Nothing in this repo has read access to the
live database's row-level contents from this session (no configured DB connection, no
extracted credential) — re-confirm those with a direct SQL check before relying on
them for anything beyond "probably still true."

### Still open

- **The end-to-end test with the owner watching.** Take a real booking on a phone,
  confirm the email arrives with the reference in the subject, open the magic link,
  reschedule, cancel. Nothing else substitutes for this.
- **`google_place_id`** is unset, so the reviews sync stays idle and the public Reviews
  block renders nothing. Deliberate: a clean empty state, not a fault. Set it in
  Settings → Business when you want reviews on the site.
- **`GOOGLE_PLACES_API_KEY`** is the one Edge Function secret not set, for the same
  reason.
- ~~**No RLS tests.**~~ ~~**CI runs no SQL.**~~ Both closed 2026-08-20:
  `supabase/tests/rls_test.sql` is a 45-assertion pgTAP suite, and CI's `database` job
  applies every migration to a fresh Postgres and runs it on each push.
- **CSP is still `Report-Only`** and its `connect-src` no longer needs `inn.gs`.
