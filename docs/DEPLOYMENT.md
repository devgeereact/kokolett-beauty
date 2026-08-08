# Deployment — Kokolett Beauty UK (static PWA on cPanel)

This app builds to a **static `dist/`** folder and is served as plain files. There is
**no server runtime** — the cPanel host runs PHP/Apache only (typically `git`,
`rsync`, `mysql`; **no `node`/`npm`**). So the frontend is **built locally** (or in CI)
and only the built artifacts are shipped.

**This app's deploy target**

|           |                                                           |
| --------- | --------------------------------------------------------- |
| Domain    | `koko.gakinz.com`                                         |
| Docroot   | `~/koko.gakinz.com/` (dedicated — never a shared docroot) |
| Artifacts | `dist/*` plus the repo-root `.htaccess`                   |
| Timezone  | `Europe/London`                                           |

If you deploy through a personal wrapper or CI, that tooling still has to obey the
safety rules below — they exist because breaking them has caused real outages and
leaks.

---

## 0. Before the first deploy

- [ ] Both migrations applied (`0001_init.sql`, then `0002_salon.sql`).
- [ ] `btree_gist` extension present; the `appointments_no_overlap` constraint exists.
- [ ] Owner row inserted into `public.staff`.
- [ ] `booking_settings` reviewed — lead time, horizon, daily cap, `approve_first_time`,
      `approval_window_h`, and the Google review URL.
- [ ] Opening hours entered in `availability_rules`; known closures added.
- [ ] Services entered with real durations, buffers and prices.
- [ ] Edge Function secrets set (`supabase secrets set`): SMTP credentials,
      `MAGIC_LINK_SECRET`, AI provider key, service-role key.
- [ ] **Sending domain authenticated — SPF, DKIM and DMARC.** This is not optional.
      Every confirmation, reminder and magic link rides on email; unauthenticated mail
      lands in spam and the passwordless promise fails silently.
- [ ] `pg_cron` jobs scheduled: `expire_pending_approvals()` hourly, the email drain
      every 15 minutes, `ai/daily-insights` at 06:00.
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

---

## 2. Ship the artifacts — into THIS app's own docroot

Deploy `dist/*` and `.htaccess` into **the target site's own document root or a
dedicated subdirectory** — here, `~/koko.gakinz.com/`. For example, `~/<domain>/` for an addon domain, or
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
- **Supabase / ImageKit / Inngest keys shipped to the browser must be write-only or
  RLS-guarded** (Supabase anon, ImageKit public, Inngest write-only event key). The
  `service_role` key and Inngest signing key are server-only and never touch this
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
`supabase secrets set`. The mailbox password comes from `.env` and is never
committed.

**Why the cron secret is in the Vault, not in a migration.** `send-emails` is
deployed `--no-verify-jwt`, so `EMAIL_CRON_SECRET` is the only thing between the
internet and the salon's mail queue. This repository is public and a migration is
forever, so `drain_email_queue()` reads the secret from `vault.decrypted_secrets`
by name and the value is inserted out of band. If the secret is missing the job
logs a notice and does nothing, rather than quietly posting unauthenticated
requests every five minutes.

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
ssh cpanel 'ls -t ~/mail/koko.gakinz.com/booking/new | head'
```

Scheduled jobs: `drain-email-queue` (5 min), `expire-pending-approvals` (hourly),
`extend-weekly-template` (nightly), `purge-access-tokens` (nightly).

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
  -d '{"email":"booking@koko.gakinz.com","create_user":false}'
```
