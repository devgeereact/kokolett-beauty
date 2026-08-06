# Autonomous AI Agent Directives — Kokolett Beauty UK

This repository is the booking and operations platform for **Kokolett Beauty UK**, a
single-owner salon. It is edited by humans **and** AI agents (Claude Code, CodeRabbit,
Cursor, etc.). These rules are binding for any automated contribution.

Two things in this codebase are load-bearing in ways that are easy to break by
accident. Read them before touching anything near booking:

1. **Double-booking is prevented by a Postgres exclusion constraint**, not by
   application logic. Do not "optimise" it away, and do not add a client-side check
   that pretends to be authoritative.
2. **The AI assistant is advisory by construction.** It writes to
   `ai_recommendations` and has no write path to `appointments`, `customers`, or
   `availability_*`. Do not grant it one. A prompt instruction is not a permission
   boundary.

## 1. Read before you write
Before generating or modifying code, load and obey, in this order:
1. `docs/RULES.md` — hard coding standards.
2. `docs/ARCHITECTURE.md` — directory layout and data flow.
3. `docs/SCHEMA.md` — database shape, types, and RLS.
4. `docs/HOOKS.md` — the sanctioned hook contracts.

## 2. Deployment reality (non-negotiable)
The build target is a **static** PWA on Namecheap cPanel (Stellar Plus).
- ❌ No SSR, no Next.js server components, no Node server in this repo — nothing
  that needs a runtime on cPanel.
- ✅ Everything runs in the browser or is offloaded to a managed service. Server-side
  and scheduled logic lives in **Supabase** (Edge Functions, Postgres triggers, RLS);
  media in ImageKit; monitoring in Sentry; background workflows via Inngest.
- The only shippable output is the static `dist/` folder.

## 3. Styling
- Tailwind / NativeWind utility classes **only**.
- No inline `style={{ }}`, no `.module.css`, no styled-components.
- Use the design tokens defined in `tailwind.config.ts` — never raw hex values.

## 4. Data access
- All Supabase reads/writes go through `src/services/*` or `src/lib/supabase.ts`.
- Never bypass Row Level Security. Never embed the `service_role` key.
- Client-exposed keys must be write-scoped or RLS-protected (anon key, ImageKit
  public key, Inngest write-only event key).

## 5. Quality gates (a PR must pass all)
- `npm run typecheck` — zero errors, no implicit `any`.
- `npm run lint` — zero warnings.
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
