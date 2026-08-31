# Go-live checklist — standing up a fresh environment

This is the durable, undated procedure for taking a fresh clone (or a new
Supabase project) to a working, verified live site. It replaces an earlier
version of this file that was a dated, one-time completion snapshot for the
2026-08-19 go-live (the archived snapshot itself has since been deleted —
see `git log -- docs/GO-LIVE.md` for the 2026-08-19 revision if the original
narrative is ever needed).

For the mechanics of building and shipping a build once the environment
below is already set up, see `docs/DEPLOYMENT.md` — this file does not
duplicate that.

Anything written `<like this>` is a value only you have.

---

## 1. `.env` — fill in the tracked template

`.env.example` is the source of truth for every variable this app reads.
Copy it to `.env` and fill in real values — confirm the variable list still
matches by grepping every `import.meta.env.VITE_*` reference in `src/` and
every `Deno.env.get(...)`/`env(...)` call in `supabase/functions/`, since a
new function or a renamed variable will drift the two apart silently.

`VITE_APP_URL` must exactly match the domain the Supabase project's auth
redirect allow-list expects (see §2) — a mismatch here surfaces as a broken
magic-link redirect, not a build error.

## 2. Supabase project setup

1. **Auth redirect allow-list** — `supabase/config.toml`'s `[auth]` block is
   the source of truth; edit there, then run
   `supabase config push --project-ref <ref>` and confirm it reports
   `"auth": "updated"` (or `"up_to_date"`). Never hand-edit the dashboard's
   URL Configuration screen directly — that drifts silently from what's
   checked into the repo.
2. **Migrations** — `supabase db push --linked` applies every migration in
   order. There is no local Docker/Postgres in this environment, so validate
   anything you're unsure of in a rolled-back transaction against the live
   project first (`begin; ...; rollback;` in the SQL editor) rather than
   guessing.
3. **Edge Function secrets** (`supabase secrets set --project-ref <ref> ...`)
   — every value `.env`'s server-only section lists. `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected by the
   platform; never set them yourself.
4. **Vault entries** — the cron-triggered functions (`send-emails`,
   `sync-reviews`) read their shared secret and target URL from Vault, not
   from function secrets, via `select vault.create_secret(...)` in the SQL
   editor. The secret value must be byte-identical to what you set in step 3
   — both functions fail closed (refuse every caller, including their own
   cron job) if it's missing or doesn't match.
5. **Deploy every Edge Function** — `supabase functions deploy <name>
   --project-ref <ref>`, matching each function's `verify_jwt` setting to
   what `supabase/config.toml`'s `[functions.<name>]` block declares (every
   function has one, with a comment explaining its posture).
6. **Confirm cron jobs exist** — `select jobname, schedule, active from
   cron.job order by jobname;`. Cross-check the count and schedule against
   `docs/SCHEMA.md` §7.

## 3. The salon's own data — entered in the dashboard, not in a file

None of this can be seeded from a migration without inventing fake business
information. Sign in as the owner and fill in, screen by screen:

- **Settings → Business** — address, phone, Instagram, Google review link,
  Google Place ID (needed for the reviews sync to activate).
- **Settings → Business, booking rules** — slot spacing, buffers, lead time,
  booking horizon, daily capacity, cancellation window, first-time-booking
  approval policy.
- **Settings → Organisation** — business name, category, country.
- **Availability → working hours** (`/dashboard/weekly`) — nothing is
  bookable until a weekly template is published; an empty diary is why the
  booking page would show no times.
- **Appointment type** (`/dashboard/appointment`) — name, duration, price,
  description. Price is never shown to a customer anywhere in the app by
  design — confirm that's still true of any new customer-facing page before
  shipping one.
- **Services → the public menu** (`/dashboard/services`) — free-text only,
  no pricing. This is the one surface where scope discipline (women's hair
  only) has to be enforced by the person typing, not by the schema.
- **Services → the public menu**, continued — the group names here are also the
  services advertised on the Google Business Profile and in Instagram highlights.
  Keep all three saying the same thing (`docs/SOCIAL_PROFILE.md` §3.8), and note
  that locs are not offered (§1.3).
- **`index.html`'s structured data** — address, phone, and
  `openingHoursSpecification` matching whatever the weekly template actually
  publishes (one `OpeningHoursSpecification` object per distinct day-range).

  This is hand-keyed and no code can reach it. A crawler reads the served HTML
  before any JavaScript runs, which is the whole reason the entity lives there,
  and the cost is that it cannot track `booking_settings` or the weekly template.
  **Re-derive the hours whenever the template changes**: the salon opens at the
  first published start and closes at the last published start plus the
  appointment length. Getting this wrong puts wrong opening hours in a Google
  result, which is a person standing outside a closed door, not a ranking
  problem.

  `geo` is deliberately absent. Add it only from the real coordinates on the
  Google profile's own pin; a guessed lat/long is worse than none.

- **`src/lib/business.ts`** — locality, region, postcode, positioning line,
  areas served, service group names, Instagram URL, Google Place ID. Code, not
  dashboard: these change with a deploy, not with a login. `docs/SOCIAL_PROFILE.md`
  §2 maps which fact lives where.

## 4. Verification — a 200 proves nothing here

The SPA rewrite answers every path with `index.html`, including a missing
JavaScript bundle, so a partial upload looks perfectly healthy from a status
code alone. Check content type, not just status:

```bash
curl -sI https://<domain>/assets/index-<hash>.js | grep -i content-type
# MUST be text/javascript. text/html means the bundle is missing and the
# SPA rewrite is answering for it instead.
```

Then, by hand, with the owner watching:

1. Book a real appointment on a phone.
2. Confirm the email arrives, with the booking reference in the subject.
3. Open the magic link, reschedule, then cancel.
4. Check each step shows correctly in the dashboard.
5. Sign the owner out and back in with a magic link, to prove `VITE_APP_URL`
   is right end to end.
6. Queue one of each template to a test address and confirm the subject,
   plain-text part, and HTML all look like the designed template, not a
   placeholder draft.

## 5. Known, deliberately-left-open gaps

Carried forward from the last full pass — re-check whether any have since
been closed before assuming they still apply:

- `minimum_password_length = 6` in `supabase/config.toml`;
  `src/lib/password.ts` enforces stronger rules, but only in the browser.
- The calendar has no keyboard equivalent for drag-to-reschedule — the Move
  panel (reached through the edit modal) is the fallback.
