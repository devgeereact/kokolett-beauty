# Kokolett Beauty UK

The booking and operations platform for **Kokolett Beauty UK**, a single-owner salon.
An offline-first Progressive Web App served as static files from cPanel, with all
heavy lifting offloaded to managed services.

Live at **https://www.kokolettbeauty.com**

### What it does

- **Marketing site** — services, gallery, testimonials, FAQs, contact, policies.
- **Availability-first booking** — customers only ever see slots that are genuinely
  open, generated from the owner's hours, breaks, closures, buffers and booking rules.
- **Availability is the gate** — anything inside the owner's published hours books
  instantly, for anyone, new or returning. When nothing is open, the customer submits
  a request instead, and requests are offered slots first-come-first-served.
- **No dead ends** — when nothing is available, the customer submits an availability
  request instead of hitting an empty calendar.
- **Passwordless customers** — identity is an email address. Access to appointment
  history is via a single-use magic link. Nobody ever creates an account.
- **Owner dashboard** — today's schedule, calendar with drag-to-reschedule, approvals
  queue, availability requests, customers, services, availability rules, reports.
- **Advisory AI assistant** — matches cancellations to waiting customers, flags
  under-used days, drafts replies. Recommends only; the owner decides.
- **Automated email** — branded confirmations with `.ics` invites, reminders,
  completion, and Google review requests, all logged and retried.
- **Installable PWA** — the owner's dashboard stays readable offline.

---

## Tech stack

| Layer            | Choice                          | Why                                            |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| Framework        | React 18 + Vite 6               | Fast HMR, tiny hashed bundles                  |
| Language         | TypeScript (strict)             | Safety enforced in CI                          |
| Styling          | Tailwind CSS (NativeWind-ready) | Utility-first, portable to Expo later          |
| PWA              | `vite-plugin-pwa` (Workbox)     | Precached app shell + runtime caching          |
| Auth + DB        | Supabase (PostgreSQL + RLS)     | Managed Postgres, row-level security           |
| Media            | ImageKit                        | Real-time image resize/compress over a CDN     |
| Background jobs  | Inngest                         | Event-driven workflows, cron, retries          |
| Monitoring       | Sentry                          | Error + performance tracking with source maps  |
| Motion           | Framer Motion                   | Micro-interactions & page transitions          |
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
```

`0002` requires the `btree_gist` extension (it creates it) for the exclusion
constraint that makes double-booking impossible.

Then grant yourself owner access after signing in once:

```sql
insert into public.staff (id, role)
select id, 'owner' from public.profiles where email = 'you@example.com';
```

Finally, regenerate the database types:

```bash
supabase gen types typescript --project-id <ref> --schema public \
  > src/types/database.types.ts
```

### 4. Develop
```bash
npm run dev        # http://localhost:5173
```

### 5. Verify before shipping
```bash
npm run typecheck
npm run lint
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
4. Verify a booking end to end: pick a service, take a slot, and confirm the
   confirmation email and `.ics` invite arrive.

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
| `npm run lint`         | ESLint (zero-warning policy)                     |
| `npm run format`       | Prettier write                                   |

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
├── docs/                 # PRD, DESIGN, ARCHITECTURE, SCHEMA, RULES, HOOKS
│   ├── planning/         # live/proposed engineering specs
│   └── history/          # point-in-time audits & decisions (archival)
├── public/               # manifest icons, offline.html, robots.txt
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
- [`docs/planning/`](docs/planning/) — active engineering specs and plans
- [`docs/history/`](docs/history/) — archived audits, reviews and decisions

## License
MIT — do whatever you want, no warranty.
