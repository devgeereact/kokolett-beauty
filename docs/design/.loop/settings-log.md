# Settings screen — design-match log

Target: `SettingsPage.tsx`, route `/dashboard/settings`. Ref:
`docs/design/settings.png`.

## Already built — no code changes needed

The only screen in this whole build-loop pass that needed zero edits.
Six tabs (Organisation/Account/Business/Preferences/Security/Billing),
all real, all matching the reference or improving honestly on what it
implies:

- **Organisation**: real business name/category/country/timezone
  ("Hair Salon" — correctly the app's real scope, not the reference's
  generic "Beauty Salon"), real account details, real business-settings
  nav rows, real Preferences, real Security/Support cards.
- **Business** tab (not shown in the reference screenshot, but real and
  more thorough than the reference implies): salon details, DB-enforced
  booking rules, Google reviews config, an actual iCalendar subscription
  feed with an honest security/latency notice, share links, real mailing
  list count.
- **Preferences**: Theme is genuinely wired to `ThemeContext` app-wide
  (verified live — clicking Dark actually re-themes the whole dashboard,
  screenshot confirms the button's own selected state updates). Time
  format is genuinely wired into every `formatTime` call. Language is
  disabled with one option, honestly — no i18n system exists, and copy is
  British English everywhere per CLAUDE.md, so this isn't a real choice to
  offer. Date format saves a real preference but doesn't yet drive
  rendering — documented in the component's own comment as a deliberate
  choice, not an oversight.
- **Security**: real TOTP two-factor auth via Supabase's native MFA API —
  QR enrollment, verification, disable, and an honest, actionable error
  message if MFA isn't turned on at the Supabase project level yet (names
  the exact config path rather than a generic failure). "Login activity"
  shows the one real session fact the client SDK exposes
  (`last_sign_in_at`), not a fabricated session list.
- **Billing**: "This dashboard is your own — there's no subscription or
  invoice to manage." Correct — this is a bespoke single-owner app, not a
  multi-tenant SaaS product being resold to Kokolett; there's no real
  billing relationship to show.

## Not implemented — logged, not guessed at

- Nothing found worth building. Every place the reference implies
  something this app doesn't have (a billing plan, multiple languages, a
  session-management admin list) already has an honest real answer rather
  than a fabricated one.

## Verification

Clicked through all six tabs live. Dark theme and mobile (390×844) checked
on the Organisation tab (the one the reference depicts) — clean, all tabs
wrap correctly at narrow width. `npx vitest run`: 154/154 passing (no
changes made, confirming nothing needed touching).

## Stop

Converged after 0 iterations of code change — verification only. This is
the most complete screen encountered in the whole pass.
