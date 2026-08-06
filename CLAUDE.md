# Claude Code — Project Context

**Kokolett Beauty UK** — the booking and operations platform for a single-owner UK
**women's hair salon**. Marketing site, availability-first booking, passwordless
customer identity (magic links, no accounts), owner dashboard, advisory AI
assistant, and automated transactional email. Hybrid booking policy: returning
customers are confirmed instantly, first-time customers are held for owner approval.

You are working inside a **static, offline-first PWA** deployed to cPanel at
`https://koko.gakinz.com`. Treat the constraints below as ground truth for every
response.

## Live coordinates
| Thing | Value |
| --- | --- |
| Domain | `https://koko.gakinz.com` — currently serving `coming-soon/`, not the app |
| Contact / sending address | `booking@koko.gakinz.com` (singular `booking`) |
| Repo | `github.com/devgeereact/kokolett-beauty` (**public**) |
| Supabase ref / region | `erqrfjlozqyhogneqraj` / `eu-west-2` (London) |
| Dev + preview port | `5082` (block 08, `strictPort`) |

DB password: macOS Keychain, `security find-generic-password -a $USER -s supabase-kokolett-db -w`.
Never in a file.

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

## Hard constraints
- **Static build only.** Output is `dist/`, deployed via Git/FTP to cPanel.
  No server runtime of any kind.
- **TypeScript strict.** No implicit `any`; explicit return types on functions
  and hooks.
- **Styling:** NativeWind / Tailwind classes, tokens from `tailwind.config.ts`.
- **Offloaded systems:** Supabase (Auth/DB + RLS), ImageKit (media), Sentry
  (monitoring), Inngest (background workflows).
- **Path alias:** import app code with `@/…` (maps to `src/`).
- **Booking writes go through `book_appointment()`** — never a direct client insert.
- **`pending_approval` holds a slot.** Availability logic must treat it as occupied.
- **Money is integer pence. Time is UTC in storage, `Europe/London` on screen.**
- **The AI assistant is advisory only** and cannot mutate business data.
- Copy is British English.
- **Women's hair only.** Cutting, colouring, styling, treatments. Not a general
  beauty salon — no nails, brows, lashes or aesthetics — and not unisex. The word
  "Beauty" in the name is branding, not scope. Structured data uses `HairSalon`.

## Working style
- Prefer editing an existing file over creating a new one.
- Keep components small and typed; put SDK setup in `src/lib`, data calls in
  `src/services`, reusable logic in `src/hooks`.
- When unsure about the DB shape, re-read `docs/SCHEMA.md` rather than guessing.
