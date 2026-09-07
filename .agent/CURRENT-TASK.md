# Current Task Contract

## Outcome

A professional consistency retouch of the existing interface: the same design, made
more coherent, more legible and easier to use across desktop, tablet, mobile browser
and installed PWA.

Supersedes the GEE OS adoption contract, which completed on 2026-09-04. That work is
recorded below under "Previous scope" and its outputs (`.agent/PROJECT.yml`,
`.agent/MCP-PROFILE.yml`, `.claude/rules/gee-os.md`, `docs/GEE-OS.md`) are unchanged
by this task.

## Scope

- Name and share the composition roles the interface was already using informally:
  card padding, card title sizes, the title/description/action block, section and
  record-list gaps, the two control families, icon buttons, segmented controls.
- Complete the keyboard and focus contracts the shared controls were claiming but not
  implementing (`Tabs`, `Dropdown`, `Tooltip`, `DatePicker`, `useFocusTrap`).
- Coordinate the four fixed bottom notices, and account for device safe areas.
- Fix the demonstrated layout defects: the Email page's three columns at 1024px, the
  dashboard header's truncated title and subtitle, the unreachable Messages queue, the
  uncapped content column above 1440px.
- Update the canonical documents in the same change.

## Outside scope

- New features, a new theme, a new font, a new icon set, a new information
  architecture.
- Business-rule or schema changes. Nothing in this task touches booking, availability,
  money, timezones or RLS.
- Deployment, remote mutation, sending email, and any write to the production
  database. The owner session used for verification was read-only.
- Rewriting historical briefs (`docs/GPT.md`, earlier `KOKO_GAP.md` sections) — they
  are records, not active instructions.

## Mode and workflow

- Primary mode: Existing Application.
- Workflow: Change Safety.

## Evidence

- Screenshots of 40 route states (18 public, 22 owner) in light and dark from the
  production build under `vite preview`: before at 375/768/1024/1440, after at
  320/375/414/768/1024/1440, plus 1920px before and after for the content-cap change.
  320 and 414 are after-only — they were added once the narrow-width work started.
- axe-core over 39 routes in both colour schemes, 78 runs: 0 violations.
- 14 new behavioural tests for the changed keyboard and focus contracts.
- Gates: typecheck, lint, `format:check`, `TZ=UTC` Vitest, `lint:copy`,
  `lint:classes`, production build.

## Completion

Recorded in `docs/KOKO_GAP.md` §13, including the two source findings that turned out
to be wrong, and everything that remains **NOT TESTED** — real devices, Firefox and
WebKit, populated owner queues, and visible tooltips for the collapsed rail.

## Previous scope (completed 2026-09-04)

Adopt GEE OS 0.5.0 locally without replacing existing project knowledge or changing
application behaviour: add agent-neutral routing and MCP contracts, preserve
`AGENTS.md`, `CLAUDE.md`, source, docs and untracked work, and record a
project-specific plan for later knowledge modularisation. Its exclusions (no feature
work, no deletion or renaming, no remote synchronisation, no deployment, no secret
discovery) held throughout and still hold.
