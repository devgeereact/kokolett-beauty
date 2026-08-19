# Go-live checklist — everything that has to be keyed in by hand

> **Status: done, 2026-08-19 21:00 UTC.** Sections 1 to 6 have been carried out and
> verified against the live project. What is left is in
> [After the handover](#after-the-handover) at the bottom. The sections below are kept
> as the record of what was done and how it was checked, not as outstanding work.

Generated 2026-08-19, alongside `docs/FEATURE_FIX.md`. That document records what was
changed in the repository; this one is the part no amount of code could supply. Work
through it top to bottom: the order matters in section 3, and section 4 is what proves
the rest of it landed.

Anything written `<like this>` is a value only you have.

---

## 1. `.env.example` — correct the tracked template

This file is committed, so a fresh clone inherits whatever is in it. It currently seeds
three values pointing at the **dead** `koko.gakinz.com` domain, and a block of
`VITE_SALON_*` variables that nothing in the app reads any more.

### Change

```dotenv
VITE_APP_URL="https://www.kokolettbeauty.com"
VITE_SALON_EMAIL="booking@kokolettbeauty.com"
SMTP_FROM_EMAIL="booking@kokolettbeauty.com"
```

The `www.` on `VITE_APP_URL` is load-bearing, not cosmetic. See section 2.

### Delete outright

Every one of these is now unread by `src/lib/env.ts`. They only inflate the bundle and
mislead the next person setting the project up:

```
VITE_APP_NAME
VITE_IMAGEKIT_PUBLIC_KEY
VITE_INNGEST_EVENT_KEY
VITE_SALON_ADDRESS
VITE_SALON_PHONE
VITE_SALON_CURRENCY
VITE_SALON_TIMEZONE
VITE_GOOGLE_REVIEW_URL
```

`VITE_SALON_ADDRESS` and `VITE_SALON_PHONE` in particular were shipping the strings
`"Add the salon address"` and `"+44 0000 000000"` into the production bundle. The real
address and phone come from the database (section 4), never from the build.

Also drop the server-only `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` if they are
still listed. There is no Inngest in this app.

### The template should end up as exactly this

```dotenv
# ---- Browser (inlined into the bundle at build time — nothing secret) -------
VITE_APP_URL="https://www.kokolettbeauty.com"
VITE_SUPABASE_URL="https://erqrfjlozqyhogneqraj.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon key>"
VITE_IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/<your imagekit id>"
VITE_SENTRY_DSN="<sentry dsn>"

# ---- Server only. NEVER prefix with VITE_ and never reference from src/ -----
SUPABASE_SERVICE_ROLE_KEY="<service role key>"
SMTP_HOST="<cpanel mail host>"
SMTP_PORT="465"
SMTP_USER="booking@kokolettbeauty.com"
SMTP_PASSWORD="<mailbox password>"
SMTP_FROM_EMAIL="booking@kokolettbeauty.com"
SMTP_FROM_NAME="Kokolett Beauty UK"
OPENROUTER_API_KEY="<openrouter key>"
GOOGLE_PLACES_API_KEY="<google places key>"
EMAIL_CRON_SECRET="<long random string>"
REVIEWS_CRON_SECRET="<a different long random string>"
```

Those are the only five `VITE_*` variables `src/lib/env.ts` reads. It reads them as
static `import.meta.env.VITE_*` members now, so anything not on that list is not
inlined and not shipped.

---

## 2. `.env` — the file the production build actually reads

Copy the template above and fill in the real values. Three of them are wrong on the
live site right now, because the deployed bundle was built from the example file.

### `VITE_APP_URL` — the one that is actually broken

Currently `https://kokolettbeauty.com`, with no `www.`.
`src/pages/LoginPage.tsx:98` uses it as the owner's magic-link `emailRedirectTo`. The
site canonicalises on `www.`, so unless the apex is also in Supabase's allow-list, the
owner's sign-in link lands nowhere.

Set it to `https://www.kokolettbeauty.com`, **and** add both origins to the Supabase
redirect allow-list:

> Supabase dashboard → Authentication → URL Configuration → Redirect URLs

```
https://www.kokolettbeauty.com/**
https://kokolettbeauty.com/**
http://localhost:5082/**
```

`localhost:5082` matters because that is the project's fixed dev port (`strictPort`).
The README used to tell people to open `5173`, which is not on the list and never
worked.

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

On price: the customer-facing pages quote no price anywhere, on purpose. A full head of
knotless braids and a trim are not the same appointment. `appointments.price_pence` is
a placeholder that defaults to 0, and what was actually taken is logged per appointment
in the `payments` table. The Today dashboard's money tile now reads that, which is why
it used to say £0.00 every day.

### 4.6 Services → the menu shown on the website

`/dashboard/services`. Descriptive, not bookable. Per item: group, name, a free-text
note ("about 4 hours", "half a day" — never a price), duration, buffer, optional image.

**This is the one uncontrolled scope surface in the whole app.** Whatever is typed here
renders verbatim on the public homepage. The salon is women's hair only: cutting,
colouring, styling, braids, locs, weaves, treatments. Not nails, brows, lashes,
aesthetics, barbering or unisex.

### 4.7 Then add the structured data

Once 4.1 has a real address, phone and opening hours, add them to the `HairSalon` block
in `index.html`. Without them the block cannot produce a full local rich result, and
inventing them would have been worse than leaving them out:

```jsonc
"address": {
  "@type": "PostalAddress",
  "streetAddress": "<street>",
  "addressLocality": "<town>",
  "postalCode": "<postcode>",
  "addressCountry": "GB"
},
"telephone": "<+44…>",
"openingHoursSpecification": [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "opens": "09:00",
    "closes": "18:00"
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

- **CI runs no SQL.** No `db push`, no lint, no pgTAP. A migration that cannot apply
  still reaches production undetected, which has happened once already (`0002` created
  the `citext` extension after the table that used it).
- **No RLS tests.** Nothing asserts that anon cannot read `appointments` or
  `customers`, or that a non-owner authenticated session is denied. The entire security
  model is unverified by any automated check. This is the highest-value test to add.
- **CSP is still `Report-Only`.** It has never run against real traffic. Its
  `connect-src` no longer needs `inn.gs`; trim that, watch it for a week, then promote
  the header to enforcing.
- **`minimum_password_length = 6`** in `supabase/config.toml`. `src/lib/password.ts`
  enforces stronger rules, but only in the browser.
- **The calendar has no keyboard equivalent for drag-to-reschedule.** The Move panel is
  the fallback, reached through the edit modal.

---

## After the handover

Everything in sections 1 to 6 is done. Verified on 2026-08-19:

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

### Still open

- **The end-to-end test with the owner watching.** Take a real booking on a phone,
  confirm the email arrives with the reference in the subject, open the magic link,
  reschedule, cancel. Nothing else substitutes for this.
- **`google_place_id`** is unset, so the reviews sync stays idle and the public Reviews
  block renders nothing. Deliberate: a clean empty state, not a fault. Set it in
  Settings → Business when you want reviews on the site.
- **`GOOGLE_PLACES_API_KEY`** is the one Edge Function secret not set, for the same
  reason.
- **No RLS tests.** Nothing asserts that anon cannot read `appointments` or
  `customers`. The security model is still unverified by any automated check, and this
  is the highest-value thing to add next.
- **CI runs no SQL.** The three migrations here were validated by hand in a rolled-back
  transaction. That worked, but it is a person remembering to do it.
- **CSP is still `Report-Only`** and its `connect-src` no longer needs `inn.gs`.
