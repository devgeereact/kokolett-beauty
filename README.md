# Kokolett Beauty UK

The booking and operations platform for **Kokolett Beauty UK**, a single-owner UK
women's hair salon: cutting, colouring, styling, braids, twists, weaves and treatments.
Not nails, brows, lashes or aesthetics, and not unisex. An offline-first Progressive
Web App served as static files from cPanel, with all heavy lifting offloaded to
Supabase.

Live at **https://www.kokolettbeauty.com**

### What it does

- **Marketing site** — a real multi-page site: Home, About, Gallery, Services,
  Testimonials, FAQs and Contact, plus the three policy pages. The single-page
  simplification this line used to describe was reversed in the 2026-08-25 rebrand
  (`docs/PRD.md` §7, `docs/ARCHITECTURE.md` §3).
- **Availability-first booking** — customers only ever see slots that are genuinely
  open, generated from the owner's hours, breaks, closures, buffers and booking rules.
- **Availability is the gate** — anything inside the owner's published hours books
  instantly, for anyone, new or returning. When nothing is open, the customer submits
  a request instead, and requests are offered slots first-come-first-served.
- **No dead ends** — when nothing is available, the customer submits an availability
  request instead of hitting an empty calendar.
- **Passwordless customers** — identity is an email address. Access to appointment
  history is via a single-use magic link. Nobody ever creates an account.
- **Owner dashboard** — today's schedule, calendar with drag-to-reschedule, a combined
  Inbox (approvals and availability requests as tabs), customers, services,
  the weekly default that generates open days, reports, daily close, broadcasts,
  audit trail and system health.
- **Advisory AI** — three separate surfaces, and they are not the same thing: a
  deterministic insights module computed in the browser, an LLM chat assistant that can
  propose but never execute a write, and a drafting-only "polish with AI" helper.
  See `docs/ARCHITECTURE.md` §6b.
- **Automated email** — branded confirmations with `.ics` invites, reminders,
  completion, and Google review requests, all logged and retried.
- **Installable PWA** — the app shell and the public pages open with no signal. The
  dashboard needs a connection: caching the owner's diary would mean writing her
  customers' details to disk, where signing out does not reach them.

---

## Tech stack

| Layer            | Choice                          | Why                                            |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| Framework        | React 19 + Vite 8               | Fast HMR, tiny hashed bundles                  |
| Language         | TypeScript (strict)             | Safety enforced in CI                          |
| Styling          | Tailwind CSS 4 (web only)       | Utility-first, closed token set                |
| PWA              | `vite-plugin-pwa` (Workbox)     | Precached app shell + runtime caching          |
| Auth + DB        | Supabase (PostgreSQL + RLS)     | Managed Postgres, row-level security           |
| Server logic     | Supabase Edge Functions (Deno)  | Eleven functions: email, reviews, AI, access   |
| Scheduling       | `pg_cron` + `pg_net`            | Drains the email outbox, refreshes reviews     |
| Media            | ImageKit                        | Transformed URLs for service images            |
| Monitoring       | Sentry                          | Error tracking, magic-link tokens redacted     |
| Realtime         | Supabase Realtime               | Live calendar without polling                  |
| AI code review   | CodeRabbit                      | PR checks against `docs/RULES.md`              |
| Hosting          | cPanel (static `dist/`)         | Low cost, no server runtime                    |

---

## Quick start

### 1. Prerequisites
- Node.js **>= 18**
- npm (or pnpm)

### 2. Install & configure
```bash
git clone <your-repo> kokolett-beauty && cd kokolett-beauty
npm install
cp .env.example .env      # then fill in your keys
```

Keys ending up in the browser bundle must be `VITE_`-prefixed and either RLS-guarded
or write-only. Everything else — SMTP credentials, the AI provider key, the magic-link
secret, the Supabase service-role key — is a Supabase Edge Function secret and must
never be prefixed with `VITE_`.

### 3. Set up the database
Run the migrations **in order**, in the Supabase SQL editor or via
`supabase db push`:

```
supabase/migrations/0001_init.sql    # profiles, app_settings, auth triggers
supabase/migrations/0002_salon.sql   # the salon domain schema
...                                  # through 0076, applied in filename order
```

`0002` requires the `btree_gist` extension (it creates it) for the exclusion
constraint that makes double-booking impossible. Migrations are immutable once
applied: fix a mistake with a follow-up file, never by editing one in place.

Then grant yourself owner access after signing in once. **Set `login_slug` in the
same statement.** Without it the column stays NULL, `resolve_owner_slug()` can
never match (NULL matches nothing), and `SecretGate` renders a 404 for every URL
on the site: the sign-in form becomes unreachable, and so does the password
reset, which is only triggered from inside it. No migration inserts a `staff`
row, so this statement is the only thing that creates one.

```sql
insert into public.staff (id, role, login_slug)
select id, 'owner', 'pick-something-long-and-unguessable'
  from public.profiles where email = 'you@example.com';
```

Choose the slug the way you would choose a password, not a word: it is the only
thing between a stranger and the sign-in form, and it must be at least 8
characters of lowercase letters, numbers and hyphens. Change it later from
Settings, Security. If you want one generated for you:

```sql
insert into public.staff (id, role, login_slug)
select id, 'owner', 'owner-' || encode(gen_random_bytes(6), 'hex')
  from public.profiles where email = 'you@example.com'
returning login_slug;
```

**Then publish some opening hours before you expect anyone to book.**
`available_slots()` reads `availability_slots`, no migration seeds it, and the
nightly generator does nothing while `weekly_template` is empty. Until you set a
weekly pattern in Availability and apply it, `/book` correctly shows "No times
open at the moment" to every visitor.

Finally, regenerate the database types:

```bash
supabase gen types typescript --project-id <ref> --schema public \
  > src/types/database.types.ts
```

### 4. Develop
```bash
npm run dev        # http://localhost:5082
```

### 5. Verify before shipping
```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build      # emits ./dist
npm run preview    # smoke-test the production bundle
```

### 6. Deploy to cPanel
The server has **no Node** — build locally, ship only the artifacts.
1. Run `npm run build` (emits `./dist`).
2. Upload **everything inside `dist/`** plus the repo-root **`.htaccess`** into **this
   app's own document root** — e.g. `~/<domain>/` for an addon domain or
   `public_html/<app>/` for a subpath. The `.htaccess` handles HTTPS, SPA routing,
   MIME types, and cache/security headers.
3. Load the site over HTTPS and confirm the install prompt appears.
4. Verify a booking end to end: take a slot, say what you want doing, and confirm the
   confirmation email arrives. There is no per-service selection step; one appointment
   covers whatever the customer describes.

> ⚠️ A **200 proves nothing** on this host. The SPA rewrite plus
> `ErrorDocument 404 /index.html` answers *every* path with `index.html`, including a
> missing JS bundle. Check the content type of the hashed entry chunk:
> `curl -sI https://www.kokolettbeauty.com/assets/index-<hash>.js | grep -i content-type`
> must say `text/javascript`, not `text/html`.

> ⚠️ **Never deploy into a shared docroot** (one that also serves other sites or holds
> loose `api.php` / `config.php`), and **never mirror-with-delete** without a dry-run
> first — see **`docs/DEPLOYMENT.md`** for the full, safe playbook (rsync/CI options,
> exclude lists, backups-outside-the-webroot, and source-map handling).

---

## Available scripts

| Script                 | Does                                             |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start Vite dev server with HMR                   |
| `npm run build`        | Type-check, then build the static PWA to `dist/` |
| `npm run preview`      | Serve the production build locally               |
| `npm run typecheck`    | `tsc --noEmit` strict check                      |
| `npm run lint`         | ESLint (zero-warning policy)                      |
| `npm run lint:fix`     | ESLint with `--fix`                               |
| `npm run format`       | Prettier write                                    |
| `npm run format:check` | Prettier check (CI gate — fails the build)        |
| `npm test`             | Vitest, single run                                |
| `npm run test:watch`   | Vitest in watch mode                              |
| `npm run test:coverage`| Vitest with V8 coverage                           |
| `npm run test:hooks`   | Verifies the tracked hookify safety rules         |
| `npm run lint:copy`    | No em or en dashes in copy (CI gate — fails the build) |
| `npm run lint:classes` | Fails on a Tailwind class that produces no CSS (CI gate; needs a build first) |
| `npm run test:e2e`     | Playwright, against a real Supabase project      |
| `npm run test:e2e:ui`  | Playwright in UI mode                            |

> `npm run test:e2e` runs everything in `e2e/`, and `e2e/booking-race.spec.ts`
> **writes to whatever Supabase project `.env` points at** — it books a slot, races a
> second booking against it, and cleans up as the owner. Run the read-only specs on
> their own with `npx playwright test e2e/marketing-site.spec.ts e2e/consent.spec.ts`
> unless you mean to write.

---

## Project layout

```
kokolett-beauty/
├── .env.example          # required env vars (copy to .env)
├── .htaccess             # cPanel: HTTPS, SPA routing, caching
├── AGENTS.md / CLAUDE.md # AI agent context
├── index.html            # app entry + font preconnect
├── vite.config.ts        # build + PWA/Workbox config
├── tailwind.config.ts    # design tokens (see docs/DESIGN.md)
├── docs/                 # PRD, DESIGN, ARCHITECTURE, SCHEMA, RULES, HOOKS,
│                         # SOCIAL_PROFILE, DEPLOYMENT, GO-LIVE, KOKO_GAP, plan
├── public/               # manifest icons, robots.txt, sitemap.xml
├── supabase/migrations/  # SQL schema + RLS policies
└── src/
    ├── assets/           # static assets imported by code
    ├── components/       # UI (ErrorBoundary, InstallPrompt, ...)
    ├── context/          # Auth / Theme providers
    ├── hooks/            # usePWAInstall, useOnlineStatus, ...
    ├── lib/              # SDK clients (supabase, sentry, imagekit, env)
    ├── pages/            # route views
    ├── services/         # typed Supabase data access
    └── types/            # shared + generated DB types
```

Full details live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Documentation index

- [`docs/PRD.md`](docs/PRD.md) — scope, MVP features, success metrics
- [`docs/DESIGN.md`](docs/DESIGN.md) — visual language & tokens
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system + folder design
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — Postgres tables & RLS
- [`docs/RULES.md`](docs/RULES.md) — coding standards
- [`docs/HOOKS.md`](docs/HOOKS.md) — custom hook contracts
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploy playbook & safety rules
- [`docs/plan.md`](docs/plan.md) — the living punch list of what's actually open
- [`docs/GO-LIVE.md`](docs/GO-LIVE.md) — undated procedure for standing up a fresh environment: what has to be keyed in by hand and how to verify it landed
- [`docs/SOCIAL_PROFILE.md`](docs/SOCIAL_PROFILE.md) — the master identity, the Google Business Profile and Instagram setup field by field, and the SEO review
- [`docs/KOKO_GAP.md`](docs/KOKO_GAP.md) — the verified gap analysis and the live P1/P2/P3 backlog
- [`docs/GPT.md`](docs/GPT.md) — the original multi-tenant transformation brief, kept as an input artifact and not as a plan

## License
MIT — do whatever you want, no warranty.
