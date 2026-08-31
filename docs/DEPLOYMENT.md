# Deployment — Kokolett Beauty UK (static PWA on cPanel)

This app builds to a **static `dist/`** folder and is served as plain files. There is
**no server runtime** — the cPanel host runs PHP/Apache only (typically `git`,
`rsync`, `mysql`; **no `node`/`npm`**). So the frontend is **built locally** (or in CI)
and only the built artifacts are shipped.

**This app's deploy target**

|           |                                                                                            |
| --------- | ------------------------------------------------------------------------------------------ |
| Domain    | `www.kokolettbeauty.com`                                                                   |
| Docroot   | `~/kokolettbeauty.com/` (dedicated — never a shared docroot; confirm exact path in cPanel) |
| Artifacts | `dist/*` plus the repo-root `.htaccess`                                                    |
| Timezone  | `Europe/London`                                                                            |

If you deploy through a personal wrapper or CI, that tooling still has to obey the
safety rules below — they exist because breaking them has caused real outages and
leaks.

> ⚠️ **Merging or pushing to `main` deploys nothing.** There is no CI/CD auto-deploy
> for this static site — `git push` only updates the repo. The live site only changes
> when someone runs the deploy step below (`cpanel-deploy dist kokolettbeauty.com
> --go`) by hand. This bit for real on 2026-08-30: the whole AI-broadcast-messaging
> feature was built, reviewed, and pushed to `main` across many commits, but the
> `dist/` build was never actually shipped to `~/kokolettbeauty.com/` — the new
> `/unsubscribe/:id` route 404'd in production for hours until a manual click-test
> caught it. **Finishing a branch (merge/push/PR) is not the same task as deploying
> it** — after any user-facing change lands on `main`, deploy it explicitly, then
> verify against the live site (§2) before considering the work actually shipped.

---

## 0. Before the first deploy

- [ ] All migrations applied, in filename order (`0001_init.sql` through `0046_*`).
      `supabase db push --linked`.
- [ ] `0027_payment_log.sql` pushed (`supabase db push --linked`) before or together with
      any build that reads `today_collected_pence` — otherwise the Today page's
      "Collected today" stat renders `£0.00` instead of a real figure until the
      migration is pushed.
- [ ] `btree_gist` extension present; the `appointments_no_overlap` constraint exists.
- [ ] Owner row inserted into `public.staff`.
- [ ] `booking_settings` reviewed — lead time, horizon, daily cap, `approve_first_time`,
      `approval_window_h`, and the Google review URL.
- [ ] Opening hours published. `availability_rules` was dropped in
      `0011_slots_are_the_model.sql`; hours now come from `weekly_template` applied
      into `availability_slots`, with `day_decided` recording deliberate closures.
- [ ] Business identity filled in (`booking_settings`): address line, phone,
      Instagram, Google review URL. The public footer and the policy pages render
      nothing where these are blank.
- [ ] Services entered with real durations and buffers. **No prices**: the salon does
      not quote a fixed price for a hair appointment, and `appointments.price_pence` is
      a placeholder that defaults to 0 (see `0027_payment_log.sql`). What was actually
      taken is logged per appointment in `payments`.
- [ ] Edge Function secrets set (`supabase secrets set`): `SMTP_HOST`, `SMTP_PORT`,
      `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`,
      `EMAIL_CRON_SECRET`, `REVIEWS_CRON_SECRET`, `OPENROUTER_API_KEY`,
      `GOOGLE_PLACES_API_KEY`, and optionally `SITE_URL` / `ALLOWED_ORIGIN` (both
      default to `https://www.kokolettbeauty.com`). `SUPABASE_URL`,
      `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform
      — do **not** set them by hand. There is no `MAGIC_LINK_SECRET` and no separate
      "AI provider key": a customer magic link is a random token whose SHA-256 hash is
      stored in `customer_access_tokens` (nothing is signed, so there is no signing
      secret to set), and the only model credential is `OPENROUTER_API_KEY`.
- [ ] **Sending domain authenticated — SPF, DKIM and DMARC.** This is not optional.
      Every confirmation, reminder and magic link rides on email; unauthenticated mail
      lands in spam and the passwordless promise fails silently.
- [ ] `pg_cron` jobs scheduled — six of them, exactly as the migrations create them
      (`select jobname, schedule, active from cron.job order by jobname;`):
      `expire-pending-approvals` `7 * * * *`, `drain-email-queue` `*/5 * * * *`,
      `sync-google-reviews` `41 * * * *`, `extend-weekly-template` `13 2 * * *`,
      `purge-access-tokens` `23 4 * * *`, `purge-expired-personal-data` `31 3 * * 0`.
      There is no AI job: insights are computed client-side in `src/lib/insights.ts`,
      not on a schedule.
- [ ] Sentry project created in the **EU region** with PII scrubbing enabled — this app
      holds UK residents' personal data and the region cannot be changed later.
- [ ] Send one test booking through the live SMTP path and confirm the `.ics` opens
      correctly in both Apple Calendar and Outlook.

---

## 1. Build locally

```bash
npm run typecheck && npm run lint    # gates
npm run build                        # emits ./dist (hashed JS/CSS, sw.js, manifest, source maps)
npm run preview                      # smoke-test the production bundle before shipping
```

The only shippable output is `dist/` plus the repo-root **`.htaccess`** (HTTPS
redirect, SPA rewrite to `index.html`, MIME types, cache + security headers).

**`.htaccess` and `dist/` have to ship together now.** The CSP has been enforcing
since 2026-08-20 and its `script-src` pins `index.html`'s inline theme bootstrap by
hash. Deploy a new `dist/` whose inline script changed, against the old `.htaccess`,
and the browser refuses to run it — no theme on first paint, no visible error. CI
recomputes the hash and fails when the two disagree, so this can only happen by
deploying the two halves separately. If it does, rename the header to
`Content-Security-Policy-Report-Only` to unbreak it immediately, then fix the hash.

**`cpanel-deploy` excludes `.htaccess` unless you pass `--with-htaccess`.** The
script's exclude list protects the server's hand-maintained file from being
mirror-deleted, which is right for most sites but means a normal deploy silently
ships none of your `.htaccess` changes. This bit on 2026-08-31: the apex-to-www 301
was committed, built, deployed and appeared to succeed, and the apex still answered
200. The command that actually ships it is:

```bash
cpanel-deploy dist kokolettbeauty.com --keep cgi-bin --keep .well-known \
  --with-htaccess .htaccess --go
```

**Before passing `--with-htaccess`, diff the live file against the repo's.** The
server's copy can carry blocks the repo does not, and overwriting them is silent.
Exactly that had already happened here: the Cloudflare origin-lock block that every
other domain on the account has carried since 2026-08-24 was absent from this
docroot, and direct-to-origin was answering **200** with the real site, bypassing
the WAF. It is now committed to the repo's `.htaccess`, which is what stops a future
deploy dropping it again.

```bash
ssh cpanel 'cat ~/kokolettbeauty.com/.htaccess' > /tmp/live.htaccess
diff /tmp/live.htaccess .htaccess          # expect only your own change
ssh cpanel 'cp ~/kokolettbeauty.com/.htaccess ~/private_backups/configs/htaccess-kokolettbeauty-$(date +%Y%m%d-%H%M%S).bak'
```

**`robots.txt` is not served by this origin, and you cannot control its caching
from here.** Cloudflare's "Managed Content" feature rewrites the file: it prepends
its own block of AI-bot rules and replaces the cache header. Measured on
2026-08-31, after `.htaccess` was given an explicit `max-age=300`:

| File | `cache-control` served | `cf-cache-status` | Whose header wins |
| --- | --- | --- | --- |
| `sitemap.xml` | `max-age=300, public, must-revalidate` | `DYNAMIC` | ours |
| `robots.txt` | `public, max-age=14400, must-revalidate` | `HIT` / `MISS` | Cloudflare's |

Two consequences, both of which cost time before they were understood:

- **What is served is not what is deployed.** Our directives survive and are
  honoured, appended after Cloudflare's block. A `robots.txt` opening with rules
  nobody in this repo wrote is normal, not a compromise.
- **A robots.txt change can take up to four hours to appear**, and during that
  window a fetch returns the previous file. That is indistinguishable from a
  failed deploy unless you know to look. It is what happened on 2026-08-31:
  two new `Disallow` lines shipped correctly and the live file did not show them
  (`cf-cache-status: HIT`, `age: 2809`).

To verify a robots.txt change immediately, bust the edge cache with a query
string. Do not fetch the origin directly: the origin lock returns 403 to
anything without a `CF-RAY` header, and only `/.well-known/` is exempt.

```bash
curl -s  "https://www.kokolettbeauty.com/robots.txt?cb=$RANDOM" | grep Disallow
curl -sI "https://www.kokolettbeauty.com/robots.txt?cb=$RANDOM" | grep -i cf-cache-status
```

The `max-age=300` rule in `.htaccess` is still worth having: it is what governs
`sitemap.xml`, which Cloudflare does not rewrite, and it is the correct origin
behaviour for both files regardless of what the edge does with one of them.

**Verify the origin lock after any `.htaccess` deploy.** Through Cloudflare must stay
200; straight to the origin IP must be 403; `/.well-known/` must stay reachable at the
origin or certificate validation breaks:

```bash
curl -s  https://www.kokolettbeauty.com/ -o /dev/null -w '%{http_code}\n'                              # 200
curl -sk --resolve www.kokolettbeauty.com:443:185.61.152.45 https://www.kokolettbeauty.com/ \
     -o /dev/null -w '%{http_code}\n'                                                                  # 403
curl -sk --resolve www.kokolettbeauty.com:443:185.61.152.45 \
     https://www.kokolettbeauty.com/.well-known/pki-validation/ -o /dev/null -w '%{http_code}\n'        # 200
```

Testing the lock from the server itself does not work: a loopback request gets
cPanel's default page before `.htaccess` runs and reads 200 even on a locked site.

**If the dev server (`npm run dev`) renders with no brand colour — plain
black/white, `bg-primary`/`bg-background` etc. present in the DOM but computed
to transparent — this is a stale Vite/PostCSS cache on a long-running dev
server, not a code bug.** Confirmed 2026-08-19: `tailwind.config.ts` and
`src/index.css` were correct on disk and in the compiled `<style>` tag's
source text, but the emitted rule was the wrong shape
(`background-color: var(--primary)` instead of
`background-color: rgb(var(--primary) / <alpha-value>)`), because the running
Vite process (up for hours) never picked up a rebuild. Fix: kill the dev
server, `rm -rf node_modules/.vite`, restart `npm run dev`. No source change
needed. Before touching any design token, rule this out first.

---

## 2. Ship the artifacts — into THIS app's own docroot

Deploy `dist/*` and `.htaccess` into **the target site's own document root or a
dedicated subdirectory** — here, `~/kokolettbeauty.com/`. For example, `~/<domain>/` for an addon domain, or
`public_html/<app>/` for a subpath. **Never** deploy into a shared docroot that other
sites live in.

Typical options:

- **rsync over SSH** (fast, incremental) into `<docroot>/`.
- **cPanel Git Version Control** + a `.cpanel.yml` copy step.
- **FTP/SFTP** upload of `dist/` (CI or manual).

After deploy: load the site over **HTTPS** and confirm the app boots and the install
prompt appears.

---

## 3. Deploy safety rules (non-negotiable)

These are generic cPanel-static truths — obey them regardless of tooling:

1. **Dry-run any mirror/delete first.** If your deploy mirrors with `--delete`, run it
   in dry-run and read the diff before writing. A mirror-delete pointed at the wrong
   directory silently wipes files that exist in **no repo and no backup** (e.g. a
   site's `uploads/`).
2. **Never mirror-delete a shared docroot.** If one directory serves multiple sites or
   holds loose `api.php` / `config.php` / `.htaccess`, target a **specific
   subdirectory** instead. Mirroring the shared root deletes the neighbours.
3. **Exclude runtime & secret files from deletes:** at minimum `uploads/`, `.env`,
   `config.php`, `*.bak*`, `*.zip`, `*.sql`, `error_log`, `node_modules`, `.git`.
4. **Keep backups OUTSIDE every webroot.** Apache serves `.bak` / `.zip` / `.sql` as
   **plain text**, so a backup left in a docroot leaks its contents (including any
   credentials) to the public internet. Put backups in a directory that is not served
   (e.g. `~/private_backups/`).
5. **Never commit real secrets.** `.env` stays git-ignored; only `.env.example`
   (key names, no values) is tracked. Confirm with `git status --ignored` after setup.

---

## 4. Source maps → Sentry

Upload source maps as part of the release so stack traces de-minify, but **do not ship
`*.map` files to the public docroot** — exclude them from the deployed set (or delete
after upload). See `docs/ARCHITECTURE.md` §8 for the security posture.

---

## 5. Managed-service notes (deploy-relevant)

- **Sentry region is fixed at project creation and cannot be changed later.** Pick the
  correct data region up front (e.g. an EU/DE ingest host looks like
  `o<org>.ingest.de.sentry.io`); apps handling EU/UK personal data should be created in
  the EU region with PII scrubbing on. Only browser-safe DSN ships to the client.
- **CodeRabbit only reviews pull requests.** Use branch → PR → merge; work pushed
  straight to the default branch is never reviewed.
- **Keys shipped to the browser must be RLS-guarded or otherwise public by design**
  (the Supabase anon key, the ImageKit URL endpoint, the Sentry DSN). The
  `service_role` key is server-only and never touches this
  static bundle.

## Transactional email — how it actually runs

Email is an outbox. Triggers enqueue `email_messages` in the same transaction as
the booking; a scheduled job drains it over SMTP. A mail outage therefore delays
confirmations rather than losing them.

```
booking ──► email_messages (queued)
                 ▲
   pg_cron */5 ──┴──► drain_email_queue() ──► pg_net ──► send-emails ──► SMTP
```

**Secrets.** `SMTP_HOST/PORT/USER/PASSWORD/FROM_EMAIL/FROM_NAME`, `SITE_URL`,
`ALLOWED_ORIGIN` and `EMAIL_CRON_SECRET` are Edge Function secrets, set with
`supabase secrets set`. `.env` is a **local** source only: the same mailbox password
must also be deployed as the `SMTP_PASSWORD` Edge Function secret, or `send-emails`
cannot authenticate and the outbox stops draining. `.env` itself is never
committed.

**Why the cron secret is in the Vault, not in a migration.** `send-emails` is
deployed `--no-verify-jwt`, so `EMAIL_CRON_SECRET` is the only thing between the
internet and the salon's mail queue. This repository is public and a migration is
forever, so `drain_email_queue()` reads the secret from `vault.decrypted_secrets`
by name and the value is inserted out of band. If the secret is missing the job
logs a notice and does nothing, rather than quietly posting unauthenticated
requests every five minutes.

Note that turning JWT verification back on would not substitute for this. The
anon key ships inside the browser bundle and is itself a valid JWT, so anyone can
present one; the shared secret is the actual control.

> ⚠️ **The guard fails closed as of 0022.** It used to read
> `if (secret && provided !== secret)`, which skipped the check entirely when
> `EMAIL_CRON_SECRET` was unset in the deployed function — the exact case where
> you are least protected. It now refuses every request when the secret is
> missing, so confirm the secret is set **before** deploying `send-emails`, or
> the outbox stops draining.

To restore it on a fresh project:

```sql
select vault.create_secret('<secret>', 'email_cron_secret', 'Shared secret for send-emails');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-emails',
                           'send_emails_url', 'Endpoint the scheduled drain posts to');
```

**Verifying delivery**, rather than assuming it:

```bash
supabase db query --linked "select public.drain_email_queue();"
supabase db query --linked "select id, status_code, left(content,120) from net._http_response order by id desc limit 1;"
ssh cpanel 'ls -t ~/mail/kokolettbeauty.com/booking/new | head'
```

Scheduled jobs — all six: `drain-email-queue` (5 min), `expire-pending-approvals`
(hourly), `sync-google-reviews` (hourly), `extend-weekly-template` (nightly),
`purge-access-tokens` (nightly), `purge-expired-personal-data` (weekly, Sunday).

## Auth: signup is closed

The salon has exactly one administrator, provisioned deliberately. Since
2026-08-08 `[auth].enable_signup = false`, so nobody can mint an account by
hitting `/auth/v1/signup` or asking for a magic link with `create_user: true`.
The login form already passed `shouldCreateUser: false`, but that is a
client-side choice — this is the server-side one.

Customers are unaffected: they are not `auth.users` at all, and reach their
bookings through a single-use token on `/access/:token`.

> **`[auth.email].enable_signup` must stay `true`.** The CLI maps it onto
> "email logins are disabled" for the whole provider, not just signup — setting
> it to `false` locked the owner out of both password and magic-link sign-in.
> Found the hard way, and reverted within minutes. The flag that actually gates
> account creation is `[auth].enable_signup`.

Verified after each change, because "signup is off" and "the owner can still get
in" are two different questions:

```bash
# must fail
curl -s -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" \
  -H 'Content-Type: application/json' -d '{"email":"x@example.com","password":"…"}'
# must succeed
curl -s -X POST "$URL/auth/v1/otp" -H "apikey: $ANON" \
  -H 'Content-Type: application/json' \
  -d '{"email":"booking@kokolettbeauty.com","create_user":false}'
```

## Google reviews on the marketing site

Reviews are **cached**, not fetched from the browser. The Places key is billable
and a key shipped to a browser is a public key however it is restricted; and a
salon's reviews change a few times a month, so refetching per page view would
pay Google repeatedly for the same handful of paragraphs.

```
pg_cron :41 hourly → sync_google_reviews() → pg_net → sync-reviews
                   → Places API (New) → google_reviews + google_place_snapshot
                   → public_reviews() ← the marketing page
```

**Places API (New), not the legacy one.** Google froze the legacy Places API in
March 2025 and it is unavailable in new Cloud projects — which is exactly what
the salon would create. The function calls
`https://places.googleapis.com/v1/places/{placeId}` with `X-Goog-Api-Key` and a
mandatory `X-Goog-FieldMask`. Writing it against the legacy endpoint would have
produced a `REQUEST_DENIED` that looks like a key problem.

**Three things are still needed** before reviews appear:

1. `GOOGLE_PLACES_API_KEY` as a function secret — a Places API (New) key with
   **no HTTP referrer restriction**, because this is a server-side call. Restrict
   it by API instead.
   ```
   supabase secrets set GOOGLE_PLACES_API_KEY='…' --project-ref <ref>
   ```
2. The **Place ID** (`ChIJ…`), set in Settings → Reviews. The `share.google` link
   already stored is _not_ a Place ID and cannot be used with the API.
3. `REVIEWS_CRON_SECRET`, in **both** places — the function secret and the Vault
   entry `sync_google_reviews()` reads. Same value in each, or the call is
   refused.

   ```
   supabase secrets set REVIEWS_CRON_SECRET='…' --project-ref <ref>
   ```

   ```sql
   select vault.create_secret('<same value>', 'reviews_cron_secret',
                              'Shared secret for sync-reviews');
   ```

   > ⚠️ **Set both before deploying the function (0022 and later).** `sync-reviews`
   > used to take no request argument at all, so there was nothing to
   > authenticate: anyone who found the URL could POST to it in a loop and spend
   > the owner's Places budget, one billable call per request. It now **fails
   > closed** — a missing secret refuses every caller, including the cron job. So
   > deploying the new function without setting the secret does not leave reviews
   > working; it stops them updating, silently, until the secret exists.

Until both exist, `sync-reviews` returns 503 and the marketing page simply omits
the reviews section — it never shows an empty heading or invented testimonials.

Google returns at most five reviews and chooses which. No API returns all of
them; anything claiming to is scraping, which breaks Google's terms and stops
working without warning.
