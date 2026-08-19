# Autonomous AI Agent Directives — Kokolett Beauty UK

This repository is the booking and operations platform for **Kokolett Beauty UK**, a
single-owner UK **women's hair salon**. It is edited by humans **and** AI agents
(Claude Code, CodeRabbit, Cursor, etc.). These rules are binding for any automated
contribution.

**Scope is women's hair only.** Cutting, colouring, styling, braids, locs, weaves and
treatments. Not nails, brows, lashes or aesthetics; not unisex; not barbering. The word
"Beauty" in the name is branding, not scope, and structured data uses `HairSalon`
rather than `BeautySalon` for exactly that reason. Never write copy, a service name, a
meta tag or a model prompt that implies anything wider: it invites enquiries the salon
cannot serve.

Two things in this codebase are load-bearing in ways that are easy to break by
accident. Read them before touching anything near booking:

1. **Double-booking is prevented by a Postgres exclusion constraint**, not by
   application logic. Do not "optimise" it away, and do not add a client-side check
   that pretends to be authoritative.
2. **The AI assistant can propose but never execute.** It is a real LLM in an Edge
   Function (`supabase/functions/ai-assistant-chat`) with read tools, plus two
   `propose_*` tools. Calling a `propose_*` tool returns a card and runs nothing: the
   tool dispatcher implements only the `get_*` tools and throws on anything else. The
   write happens client-side, under the owner's own session, when she presses Confirm,
   and the RPC behind it re-checks `is_owner()`. Do not add an executing tool, and do
   not treat the system prompt as the boundary. A prompt instruction is not a
   permission boundary; the missing dispatcher branch is.

   Everything a `get_*` tool returns is **untrusted**: customer names and notes come
   from the anonymous booking form. They are wrapped in explicit data markers before
   they reach the model. Keep it that way.

## 1. Read before you write
Before generating or modifying code, load and obey, in this order:
1. `docs/RULES.md` — hard coding standards.
2. `docs/ARCHITECTURE.md` — directory layout and data flow.
3. `docs/SCHEMA.md` — database shape, types, and RLS.
4. `docs/HOOKS.md` — the sanctioned hook contracts.

## 2. Deployment reality (non-negotiable)
The build target is a **static** PWA on cPanel.
- ❌ No SSR, no Next.js server components, no Node server — nothing that needs a
  runtime on the web host. The host has no Node at all, so the build runs locally.
- ✅ Everything runs in the browser or is offloaded to Supabase. Server-side and
  scheduled logic lives there: **seven Deno Edge Functions** under
  `supabase/functions/`, Postgres triggers, `pg_cron` jobs, and RLS. Monitoring is
  Sentry. There is no Inngest: nothing in the app dispatches an event and it is not a
  dependency. ImageKit is used for one thing only, building transformed URLs for
  service images (`src/lib/imagekit.ts`).
- The only shippable output is the static `dist/` folder, plus the repo-root
  `.htaccess`, which is **not** in `dist/` and has to be copied separately.

## 3. Styling
- Tailwind utility classes **only**.
- No `.module.css`, no styled-components. `style={{ }}` is acceptable for genuinely
  dynamic geometry (a chart bar's height, a calendar block's offset) and nothing else.
- Use the design tokens in `tailwind.config.ts` and `src/index.css` — never raw hex.
  The scale is closed on purpose: `colors`, `screens`, `fontSize`, `borderRadius`,
  `boxShadow` and `zIndex` replace Tailwind's defaults rather than extending them, so
  `bg-red-500` and `z-50` do not resolve. If you need a value the scale lacks, add the
  token; do not reach for an arbitrary `text-[11px]`.
- Tints are `color-mix()` strings and **cannot** take an alpha modifier.
  `bg-tint-brand/40` silently renders nothing.

## 4. Data access
- All Supabase reads/writes go through `src/services/*` or `src/lib/supabase.ts`.
- Never bypass Row Level Security. Never embed the `service_role` key.
- Client-exposed keys must be write-scoped or RLS-protected. Today that means the
  Supabase anon key (RLS is the boundary) and the Sentry DSN.
- `src/lib/env.ts` is the only file that may read `import.meta.env`, and it must read
  **static** `import.meta.env.VITE_*` members. A dynamic `import.meta.env[key]` defeats
  Vite's replacement and inlines every variable into the public bundle.

## 5. Quality gates (a PR must pass all)
- `npm run typecheck` — zero errors, no implicit `any`.
- `npm run lint` — zero warnings.
- `npm run format:check` — Prettier clean. This one is easy to forget and CI fails on it.
- `npm test` — the suite runs under `TZ=UTC` in CI on purpose, so a Europe/London
  machine cannot pass a BST case for the wrong reason.
- `deno check` over `supabase/functions/**`. Those files are invisible to
  `npm run typecheck` and to eslint, and a real type error hid there for weeks.
- No unused imports/variables, no leaked secrets, no `console.log`.

## 5a. Domain guardrails (Kokolett-specific)
- **Never write to `appointments` from the client for a public booking.** Use
  `supabase.rpc('book_appointment', …)`.
- **Money is integer pence.** No floats anywhere near a price.
- **Times are UTC in storage**, displayed in `booking_settings.timezone`. Never assume
  a day is 24 hours — BST transitions break that twice a year.
- **`pending_approval` occupies the calendar.** Any availability calculation that
  ignores it will let two customers hold one slot.
- **Never expose `customers.notes`** to a customer-facing view, an email template, or a
  model prompt. It is the owner's private field.
- **Never ship invented data.** No placeholder customers, no sample bookings, no demo
  rows standing in for an empty queue. An owner cannot tell your example apart from a
  real booking, and this has already shipped once. Write the empty state instead.
- **Never log PII to Sentry** — no emails, phone numbers, or customer names.
- Copy is British English.

## 6. Scope discipline
Do not invent new top-level folders. If a file doesn't fit the structure in
`docs/ARCHITECTURE.md`, stop and flag it in the PR description instead of
creating ad-hoc directories.

## 7. Deploy reality
The server has no Node — never assume a build step runs there. Ship only `dist/`.
Follow `docs/DEPLOYMENT.md`: deploy into the app's own docroot, never mirror-delete a
shared docroot, keep backups out of every webroot, and don't serve `*.map` publicly.
CodeRabbit only sees pull requests, so raise a PR — never push straight to the default
branch expecting review.
