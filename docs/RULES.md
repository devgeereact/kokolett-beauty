# Hard Coding Rules & Standards — Kokolett Beauty UK

These are enforced by TypeScript, ESLint, and CodeRabbit. PRs that violate them
do not merge.

## 1. Architecture

- **Static-first.** The shipped artefact is `dist/`, served as files. No Node
  server, no SSR, nothing that needs a runtime on the web host.
- **Server logic lives in `supabase/functions/`**, as Deno Edge Functions, plus
  Postgres triggers and `pg_cron` jobs. There are eleven functions. They are outside
  the Vite build and outside `npm run typecheck`, so they are checked separately with
  `deno check` (CI does this).
- **Respect the folder map** in `docs/ARCHITECTURE.md`. No new top-level folders
  without updating that doc first.
- **A new table ships with RLS on, and with a test.** `supabase/tests/rls_test.sql`
  asserts that every table in `public` has row-level security enabled, so a table added
  without it fails CI. Add the table to that file's probe list too: the blanket check
  catches a missing `enable row level security`, but only a named assertion catches a
  policy that is present and wrong. Run it with `supabase test db` (needs Docker); CI's
  `database` job runs it against a fresh Postgres on every push.
- **No import cycles.** Direction is `pages → services → lib`; components use
  `hooks`/`context`. `lib` imports nothing from `pages`/`components`.

## 2. TypeScript

- `"strict": true`. **No implicit `any`** — `@typescript-eslint/no-explicit-any`
  is an error.
- Explicit return types on exported functions and all hooks.
- Prefer `type`/`interface` over inline anonymous shapes for anything reused.
- Use the `@/` path alias; no deep `../../../` relative imports.

## 3. React

- Function components + hooks only. No class components except `ErrorBoundary`.
- Follow the Rules of Hooks (lint-enforced). Keep `useEffect` deps honest.
- One component per file; name the file after the component (`PascalCase.tsx`).
- Derive state; don't duplicate it. Lift state only as far as needed.
- **`JSX` must be imported.** React 19's `@types/react` removed the global `JSX`
  namespace, so a component returning `: JSX.Element` needs
  `import type { JSX } from 'react'` (or `type JSX` added to an existing `react`
  import). It is not ambient any more; `tsc` fails with `TS2503` without it.
- **`useRef<T>(null)` is `RefObject<T | null>`**, also since React 19. A prop or
  hook parameter that receives one must be typed `RefObject<T | null>` — widen the
  signature rather than casting at each call site.

## 4. Styling

- Tailwind utilities **only**. Tokens from `tailwind.config.ts` and `src/index.css`.
- **No** `.module.css`, no CSS-in-JS. `style={{}}` only for genuinely dynamic geometry
  (a chart bar's height, a calendar block's offset).
- Mobile-first: base styles, then `md:` / `lg:` / `wide:` overrides. **There is no
  `sm:`, `xl:` or `2xl:`** — `tailwind.config.ts` sets `screens` at theme level to
  exactly three breakpoints (`md` 768px, `lg` 1024px, `wide` 1440px), replacing
  Tailwind's defaults rather than extending them, so any other prefix emits nothing
  at all. Four ranges result: base, `md`, `lg`, `wide`.
- Compose conditional classes with `cn()` (never string-concatenate classes).

## 5. Data & security

- All Supabase access via `src/services/*` (or `src/lib/supabase.ts`); components
  don't build raw queries inline.
- Assume RLS is the last line of defense — still scope every query to the user.
- Never ship a secret. Browser-exposed keys must be write-only or RLS-guarded.
  The `service_role` key is server-only.

## 6. Errors & logging

- No `console.log` in committed code (`warn`/`error` allowed). Use Sentry for
  real telemetry.
- Wrap risky async in `try/catch`; report to Sentry with context, fail gracefully.

## 7. Git & reviews

- Small, atomic commits; imperative messages (`feat: add install prompt`).
- Every PR must pass `typecheck` + `lint` (zero warnings) before review.
- **CodeRabbit only reviews pull requests** — use branch → PR → merge. Work pushed
  straight to the default branch is never reviewed.
- **CodeRabbit review is manual on this repo, and does not start on its own.**
  CodeRabbit's own explanation: _"This repository does not receive automatic reviews
  because it has fewer than 10 stars."_ It posts `Review skipped: manual review
required for this OSS repository` and **passes** the check, so a PR can look fully
  green having never been reviewed. Do not read a green CodeRabbit check as a review.
- **Triggering it, and its two limits.** Comment `@coderabbitai review` on the PR, or
  tick the "🔍 Trigger review" checkbox in CodeRabbit's own comment. Two things stop
  it: it is **incremental** and will not re-review a commit it has already seen, so
  push a fix before asking again; and the account is **rate limited**, so a burst of
  reviews in one session leaves later PRs unreviewed. When that happens the check
  still reads green — check the comment, not the tick.
- **CodeRabbit** checks: no unused vars/imports, correct RLS scoping, no leaked
  credentials or unsanitized keys, adherence to this file.

## 8. Deploy hygiene (see `docs/DEPLOYMENT.md`)

- Build locally; ship only `dist/` — the server has no Node.
- Deploy into this app's own docroot; **never** mirror-with-delete a shared docroot,
  and dry-run any delete first.
- **Never place backups (`*.bak`/`*.zip`/`*.sql`) inside a webroot** — Apache serves
  them as plaintext and leaks their contents. Backups live outside every docroot.

---

## 9. Kokolett-specific rules

### 9.1 Money

- Money is **integer pence**, always. `price_pence: number`. No floats, no decimals in
  the database, no `parseFloat` on a price. Format for display only, at the edge, with
  `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })`.

### 9.2 Time

- Store **UTC**, always (`timestamptz`). Convert for display using the salon timezone
  from `booking_settings.timezone`, never the browser's timezone — a customer booking
  from Spain must see London times.
- Never do date arithmetic on strings. Never assume a day is 24 hours: British Summer
  Time transitions will produce a 23- and a 25-hour day every year, and the availability
  engine must survive both.
- `day_of_week` is 0–6 with **0 = Sunday**, matching Postgres `extract(dow …)`.
  JavaScript's `getDay()` agrees; `date-fns` defaults do not always. Be explicit.

### 9.3 Booking integrity

- **Never write to `appointments` from the client for a public booking.** The only
  public write path is `supabase.rpc('book_appointment', …)`.
- Never treat a client-side availability check as authoritative. It exists to keep the
  UI responsive; the database decides.
- Handle `SLOT_TAKEN` as a first-class outcome, not an exception. Refresh availability,
  preserve everything the customer typed, and offer the nearest alternatives.
- Map every `BookingErrorCode` to human copy. A customer must never see a Postgres
  error string.

### 9.4 Appointment status

- Transitions go through `appointmentService`. No component sets `status` directly.
- `pending_approval` holds the slot. Any code that computes availability must treat it
  as occupied.
- A customer is "returning" only if they have a **completed** appointment. Cancellations
  and no-shows do not count. This rule lives in `book_appointment()` — do not
  reimplement it in TypeScript, because two implementations will diverge.

### 9.5 Customer data (UK GDPR)

- `customers.notes` is owner-private. It must never appear in a customer-facing view,
  an email template, or an AI prompt.
- Marketing consent is separate from booking consent. Never default it to true, never
  bundle it into a terms checkbox.
- Deletion goes through `erase_customer_as_owner`, and there is exactly one path.
  It clears the customer, the mailing list, their enquiries, the outbox and their
  access tokens. Where no payment is attached it deletes outright; where one is,
  it keeps the appointment rows for the books and anonymises everything personal
  on them. Never add a second, weaker "hide the row" path beside it.
- Do not log email addresses, phone numbers, or customer names to Sentry. Scrub them.

### 9.6 AI

- AI output is advisory. **Three** separate things wear the word "assistant", and
  this rule binds all of them: the deterministic client-side insights module
  (`src/lib/insights.ts`), the LLM chat (`supabase/functions/ai-assistant-chat`), and
  the drafting-only "Polish with AI" generator (`supabase/functions/draft-copy`,
  behind `src/services/draftCopyService.ts`). None writes business data; see
  `docs/ARCHITECTURE.md` §6b. `draft-copy` was listed in CLAUDE.md, the PRD and
  ARCHITECTURE but not here, which is the one document `AGENTS.md` names as binding
  on AI edits. It is a distinct governance case: it makes no RLS-gated read, so it
  carries its own explicit `is_owner()` check rather than relying on the caller's
  row-level access to return nothing. (The unused `ai_recommendations` table this
  note used to warn against was dropped, `0057`, 2026-08-30, so there is nothing to
  avoid building against any more.)
- Untrusted text that reaches a model must be fenced AND the fence must be escaped
  out of the text it fences. `ai-assistant-chat` puts tool results between
  `<<<RECORDS`/`RECORDS>>>` markers; until 2026-09-05 it did not remove those markers
  from the payload, so a customer could close the fence from inside a booking name.
- No AI code path may write to `appointments`, `customers`, or `availability_*`. The
  chat can _propose_ a booking or a one-off email; the write happens client-side under
  the owner's own session only when she clicks Confirm.
- Never put a customer's private notes, full contact details, or another customer's
  data into a model prompt.
- Always render AI-drafted copy in an editable field before it is sent. The owner's
  name goes on it, so the owner approves it.

### 9.7 Naming conventions

- Database: `snake_case` tables and columns, plural table names.
- TypeScript: `camelCase` variables, `PascalCase` types and components.
- Services: `<domain>Service.ts` exporting named functions, never a default export.
- Hooks: `use<Thing>.ts` with an explicit return interface (see `docs/HOOKS.md`).
- Booking references are `KB-XXXXXX`, uppercase, generated only by the database.
- Copy is **British English** — "personalise", "colour", "jewellery", "£".

### 9.8 Accessibility is a merge gate

- The booking flow must be completable by keyboard alone.
- Status is never communicated by colour alone; always pair with a text label.
- Touch targets ≥ 44×44px, which sets the minimum time-slot button size.
- Do not remove the global `:focus-visible` ring.

### 9.9 Business identity has one home, and copy carries no dashes

**RULE.** Static business facts live in `src/lib/business.ts`: the name, locality,
region, postcode, site origin, contact email, social URLs, service groups and the
schema.org `@id`s. Do not redeclare any of them as a `const` in a page or a component.
That is how the site, the Google profile and Instagram drifted apart in the first place:
the contact email existed in four files and the origin in about sixteen.

Three deliberate exceptions, and no others:

- **`booking_settings`** owns the address line, phone, opening hours, Instagram URL,
  Google review URL and Place ID. The owner edits these in Settings, so code reads them
  through `useBusinessSettings` and never hard-codes them.
- **`index.html`** hand-keys the address, phone and opening hours into its JSON-LD. A
  crawler reads the served HTML before any JavaScript runs, so the structured data
  cannot come from the database. It must be re-synced by hand; `docs/GO-LIVE.md` §3
  carries the step.
- **`supabase/functions/_shared/templates.ts`** keeps its own copy of the name, origin
  and email, because Deno cannot import from `src/`.

`docs/SOCIAL_PROFILE.md` §2 is the full map.

**RULE.** No em dashes (—) and no en dashes (–) in anything a person reads. Copy, error
messages, email bodies, meta tags, structured data, dashboard labels, the PWA manifest.
Use a full stop, a comma, a colon or parentheses; a full stop is usually right. Write
time and date ranges as "09:00 to 17:00", not "09:00 – 17:00", because a screen reader
announces the dash as nothing at all and the range reads as two unconnected times.

Code comments are exempt. A comment is not copy.

Enforced by `npm run lint:copy` (`scripts/check-copy.py`), which runs in CI and strips
comments before checking. **It covers `supabase/functions/` in full**, not just
`_shared/`: the AI prompts are the two places where a model literally writes the
sentences, and both were carrying em dashes while instructing the model to use none. A
model copies what it is shown before it follows what it is told, so the prompts are now
dash-free themselves and say why. `.claude/hookify.em-dash-in-copy.local.md` warns earlier, in
the editor, but it is advisory. A file that must quote a dash in order to remove one,
such as a migration doing a find-and-replace over live copy, opts out with a
`copy-check: allow-dashes` marker and nothing else does.

This has been swept by hand twice and come back twice, once into production:
`0020_subject_lines_without_em_dashes.sql` exists only because `0018` was applied before
its subject lines were fixed.

### 9.10 Locs are not a service

**RULE.** The salon does not do locs. Not faux, butterfly, soft or starter locs, and no
loc maintenance or retwists. `0018` seeded five of them into `service_menu` and they
were advertised on the site, in the structured data, in the meta descriptions and inside
the AI assistant's grounding prompt until `0066_retire_locs.sql` retired them on
2026-08-31.

Twists are a different service and she does do them, so the service group is **Twists**,
never "Twists and locs". Do not reintroduce the word on any surface, and say so plainly
when asked: an honest no costs less than a customer arriving for something that cannot
be done.
