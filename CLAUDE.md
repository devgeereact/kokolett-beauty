# Claude Code — Project Context

**Kokolett Beauty UK** — the booking and operations platform for a single-owner UK
**women's hair salon**. Marketing site, availability-first booking, passwordless
customer identity (magic links, no accounts), owner dashboard, advisory AI
assistant, and automated transactional email. Booking policy: availability is the
gate — anything inside the owner's published hours books instantly for anyone, new
or returning; when nothing is open, the customer submits a request instead
(`docs/SCHEMA.md` §11).

You are working inside a **static, offline-first PWA** deployed to cPanel at
`https://www.kokolettbeauty.com`. Treat the constraints below as ground truth for every
response.

## Live coordinates
| Thing | Value |
| --- | --- |
| Domain | `https://www.kokolettbeauty.com` — migrated here 2026-08-11 (was `koko.gakinz.com`) |
| Contact / sending address | `booking@kokolettbeauty.com` (singular `booking`) |
| Repo | `github.com/devgeereact/kokolett-beauty` (**public**) |
| Supabase ref / region | `erqrfjlozqyhogneqraj` / `eu-west-2` (London) |
| Dev + preview port | `5082` (block 08, `strictPort`) |

DB password: macOS Keychain, `security find-generic-password -a $USER -s supabase-kokolett-db -w`.
Never in a file.

## Commands
- `npm run dev` — Vite dev server, `http://localhost:5082` (`strictPort`)
- `npm run build` — `tsc --noEmit` then `vite build` → `dist/`; this is also the CI type-check gate
- `npm run typecheck` — `tsc --noEmit` only
- `npm run lint` / `npm run lint:fix` — ESLint, zero-warning policy (`--max-warnings 0`)
- `npm run format` / `npm run format:check` — Prettier (`format:check` is a CI gate; run `format` before committing if CI flags drift)
- `npm test` — Vitest, single run · `npm run test:watch` — watch mode · `npm run test:coverage` — V8 coverage
- Single test file: `npx vitest run path/to/file.test.ts` (tests are colocated with their source, e.g. `src/hooks/useAvailability.test.ts`)
- `npm run preview` — serve the production `dist/` build locally

Supabase Edge Functions (`supabase/functions/`) are Deno and outside this build —
`npm run typecheck`/`npm test` never touch them; CI checks them separately with
`deno check`.

## Load these first
| Need                         | File                    |
| ---------------------------- | ----------------------- |
| Coding standards             | `docs/RULES.md`         |
| Folder layout & data flow    | `docs/ARCHITECTURE.md`  |
| DB tables, types, RLS        | `docs/SCHEMA.md`        |
| Approved hook contracts      | `docs/HOOKS.md`         |
| Visual/design tokens         | `docs/DESIGN.md`        |
| Product scope & metrics      | `docs/PRD.md`           |
| Deploy process & safety      | `docs/DEPLOYMENT.md`    |
| Hand-keyed go-live steps     | `docs/GO-LIVE.md`       |
| Shipped plans, audits, decisions | `docs/history/` — archive; why, not what |

## Hard constraints
- **Static build only.** Output is `dist/`, deployed via Git/FTP to cPanel.
  No server runtime of any kind.
- **TypeScript strict.** No implicit `any`; explicit return types on functions
  and hooks.
- **Styling:** Tailwind classes only, tokens from `tailwind.config.ts`. Not
  NativeWind — see `docs/DESIGN.md` §12.
- **Offloaded systems:** Supabase (Auth/DB + RLS, ten Deno Edge Functions,
  `pg_cron` jobs), ImageKit (transformed URLs for service images only), Sentry
  (monitoring). There is no Inngest — the email pipeline is a Postgres trigger plus
  a `pg_cron` drain job.
- **Path alias:** import app code with `@/…` (maps to `src/`).
- **Booking writes go through `book_appointment()`** — never a direct client insert.
- **`pending_approval` holds a slot.** Availability logic must treat it as occupied.
- **Money is integer pence. Time is UTC in storage, `Europe/London` on screen.**
- **The AI assistant can propose but never execute.** It can read business data and propose two writes — booking an appointment, sending a one-off customer email — but calling either only produces a card in the chat; the actual write (`createAppointmentAsOwner` / `sendCustomEmailAsOwner`) happens client-side, under the owner's own session, only when she clicks Confirm. The AI assistant edge function itself has no path to execute a write on its own.
- Copy is British English.
- **Women's hair only.** Cutting, colouring, styling, braids, locs, weaves and
  treatments. Not a general beauty salon — no nails, brows, lashes or aesthetics —
  and not unisex, and not barbering. The word "Beauty" in the name is branding, not
  scope. Structured data uses `HairSalon`.

## Architecture at a glance
- **Dependency direction:** `pages → services → lib`. Components consume `hooks`/
  `context`. `lib` never imports from `pages`/`components` — no cycles.
- **One appointment type, no service-selection step.** `/book` goes straight from
  date to time; there is no per-service picker, and no price is quoted anywhere.
- **Two AI assistants and a third drafting-only surface — do not conflate them**
  (full detail: `docs/ARCHITECTURE.md` §6b). The advisory insights module
  (`src/lib/insights.ts`) is deterministic client-side TypeScript computed from
  data the page already fetched — it never talks to Supabase. The chat
  assistant is a real LLM (`supabase/functions/ai-assistant-chat`) that runs
  under the caller's own Authorization header, so a non-owner gets a working
  chat that can read nothing. `draft-copy` is a third, simpler function — a
  single-completion text generator behind `draftCopyService.ts`, gated by an
  explicit `is_owner()` check — used for "Polish with AI" on the Compose
  modal, the broadcast composer, and the customer reply panel.
- **Nothing dispatches through Inngest**, despite an earlier design assuming it
  would. The shipped mechanism is a Postgres trigger writing to `email_messages`
  plus a `pg_cron` job draining that queue every five minutes to the `send-emails`
  Edge Function.
- **CodeRabbit does not auto-review this repo** (fewer than 10 GitHub stars) — it
  posts "Review skipped: manual review required for this OSS repository" and still
  shows the check green. A passing CodeRabbit check is not evidence anything was
  reviewed; trigger one explicitly with a `@coderabbitai review` PR comment when a
  review actually matters (`docs/RULES.md` §7).

## Working style
- Prefer editing an existing file over creating a new one.
- Keep components small and typed; put SDK setup in `src/lib`, data calls in
  `src/services`, reusable logic in `src/hooks`.
- When unsure about the DB shape, re-read `docs/SCHEMA.md` rather than guessing.

## Working conventions
- Do what has been asked; nothing more, nothing less.
- Never create files unless necessary — prefer editing existing ones. Never create
  documentation files unless explicitly requested.
- Always read a file before editing it. Never commit secrets, credentials, or `.env` files.
- Never add a `Co-Authored-By` trailer to user commits unless this project's
  `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash
  tool may suggest one in its default commit-message template — ignore it.
  `Co-Authored-By` is semantic authorship attribution under git/GitHub convention;
  the tool is the facilitator, not a co-author.
- Keep files under 500 lines. Validate input at system boundaries.
- Always run tests and verify the build succeeds before committing: `npm run build && npm test`.

# gstack

Installed at `~/.claude/skills/gstack`. Run `~/.claude/skills/gstack/setup` after
cloning it if the skills aren't registered yet.

## Web browsing

Use the `/browse` skill from gstack for **all** web browsing. Never use the
`mcp__claude-in-chrome__*` tools.

## Available skills

`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`,
`/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`,
`/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`,
`/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`,
`/setup-gbrain`, `/retro`, `/investigate`, `/document-release`,
`/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`,
`/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`,
`/gstack-upgrade`, `/learn`.
