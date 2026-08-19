# Agent-tooling cleanup + `/browse` design QA

Two unrelated pieces of work done in one session: trimming AI-agent scaffolding out of
the repo, then using `/browse` to chase down a reported "designs look off" complaint.

---

## 1. Ruflo/claude-flow/gstack/superpowers cleanup

**What:** removed `.worktrees/`, `.swarm/`, `.superpowers/`, `.gstack/`, `.claude-flow/`,
`.agents/`, and the generic `ruflo init` scaffold inside `.claude/` (`agents/`, `commands/`,
`skills/`, `helpers/`, `proven-config.json`) — about 5.2MB of local, gitignored, regenerable
state. Also removed the root `.mcp.json` (its only entry was the claude-flow MCP server) and
stripped the ruflo hook wiring / `claudeFlow` config block out of `.claude/settings.json` and
`.claude/settings.local.json`, so ruflo hooks stop firing on every tool call.

**Why:** all of it was `ruflo init` output with zero salon/booking-specific content
(distributed-consensus agents, SPARC methodology docs, claude-flow's own v3-development
skills) and no evidence of real use beyond one 13-day-stale, empty `swarm_init` session. None
of it is referenced by `package.json`, CI, or any build/deploy script — confirmed by grepping
the repo for each directory name before deleting anything.

**What was kept:** the 5 `hookify.*.local.md` files under `.claude/` (the only tracked
content in that directory — each encodes a real production incident: a price leak, a deploy
misconfig, an em-dash sweep, a `ruflo init --force` that once wiped this project's `CLAUDE.md`,
and a live-data delete), `.idea/` (normal WebStorm metadata, no secrets), and the `# gstack`
pointer section in `CLAUDE.md` (`/browse` has real, evidenced usage — see below).

**`CLAUDE.md`:** the auto-injected "Ruflo — Claude Code Configuration" section (~230 lines —
agent-team routing tables, swarm topology config, MCP tool tables, CLI reference) was removed.
The few substantive rules buried inside it (no `Co-Authored-By` trailer, keep files under 500
lines, validate input at boundaries, run build+tests before committing) were folded into a new
short "## Working conventions" section instead of being lost.

**Result:** `.claude/` dropped from 2.0MB to 28KB (settings + the 5 hookify files). `git
status` after cleanup showed only `CLAUDE.md` modified and `.mcp.json` deleted — everything
else removed was untracked. `npm run build` verified clean afterward.

**Plugins actually needed for the app to function: none.** It's a static Vite/React +
TypeScript PWA on Supabase; `npm run build` + `cpanel-deploy` is the entire chain
(`docs/DEPLOYMENT.md`). Of the AI-tooling layer, only `hookify` (project-specific guardrails)
and gstack's `/browse` (see below) showed genuine ongoing value for this project.

---

## 2. `/browse` visual QA — "designs seem off"

Swept the public-facing pages (`/`, `/book`, `/my`, `/login`, `/subscribe`) against the dev
server at `localhost:5082` with gstack's `/browse` skill: full-page screenshots, mobile/tablet/
desktop responsive captures, console/network checks.

**Finding:** the homepage rendered with no brand colour at all — plain black text on white,
buttons with borders but no fill, none of `docs/DESIGN.md`'s terracotta identity visible
anywhere. `Book an appointment` and every other `bg-primary` element computed to
`background-color: rgba(0, 0, 0, 0)`.

**Root cause, confirmed by inspecting the compiled Tailwind output directly (not by
guessing):** the `<a class="... bg-primary ...">` elements had the correct classes, and
`tailwind.config.ts` / `src/index.css` were correct on disk — but the dev server's compiled
`.bg-primary` rule read `background-color: var(--primary);` instead of the config's
`background-color: rgb(var(--primary) / <alpha-value>)`. `var(--primary)` alone is not a
valid CSS colour (the custom property holds a bare `194 77 44` triplet, not a colour
function), so the browser silently dropped the whole declaration. Every colour utility in the
page had the same malformed shape — this wasn't specific to `bg-primary`.

This was a **stale Vite/PostCSS cache**, not a source bug. The dev server (PID 55237) had
been running since 18:40 that day; killing it, deleting `node_modules/.vite`, and restarting
`npm run dev` fixed every page immediately, with zero source changes. Re-screenshotted `/`,
`/book`, `/my`, `/login`, `/subscribe` at mobile/tablet/desktop afterward — full terracotta
identity restored, no console errors, no layout/overflow issues at any breakpoint.

**Also fixed while investigating:** `/my-bookings` was assumed as the "My bookings" route
during the sweep and 404'd — the actual route is `/my` (`routes.customer.home` in
`src/lib/routes.ts`). Not an app bug, just the wrong URL guessed during QA; noted here so the
next session doesn't repeat the same wrong guess.

**Documented for next time:** `docs/DEPLOYMENT.md` §1 now carries this exact symptom → cause →
fix, so a future "the site looks unstyled" report gets a `rm -rf node_modules/.vite` + restart
before anyone starts editing design tokens.
