# AI Assistant screen — design-match log

Target: `AssistantPage.tsx` → `AssistantChatTab.tsx`, route
`/dashboard/assistant`. Ref: `docs/design/ai.png`.

## Already built

Like Reports, this page's own docstring already documented a real,
complete rebuild onto this reference — a real Claude-backed chat
(`supabase/functions/ai-assistant-chat`), real category cards, real
suggestion chips, real quick-action buttons, real popular prompts, and
real conversation history persisted to `localStorage`. Matched the
reference almost exactly on the first screenshot.

**Advisory-only framing kept, not traded for pixel-matching.** CLAUDE.md is
explicit and binding: *"The AI assistant is advisory only and cannot mutate
business data."* The reference has no such disclaimer — this build carries
it twice (header subtitle, footer note under the chat) and that stays.
Every "quick action" here fills the chat input with a prompt for the model
to respond to in the transcript; none of them performs a real write
directly.

## Iteration 1 — two real gaps

1. **No "New booking" button in the header actions.** Every other finished
   screen in this loop (Approvals, Requests, Customers, Services) carries
   one; this page didn't. Added it — same `Modal` + `NewBookingPanel`
   pattern used everywhere else, `prefill={null}`.
2. **Missing the sidebar's 4th card** ("Smarter business. More time for
   you."). Reference's version ends in an "Explore AI features" button —
   **dropped the button, kept the message.** This page *is* the AI
   features; there's no separate features page to send someone to, so a
   button here would be decorative and point nowhere real. Rebuilt as a
   plain tinted info card (icon + heading + description, no action),
   matching the no-CTA card shape `ReportsPage`'s own Insights cards
   already use elsewhere in this app.

## Not implemented — logged, not guessed at

- "View all" links on Quick actions (5 shown, all of them) and Recent
  conversations (already capped and shown at 5) — no separate "all quick
  actions" or "all conversations" page exists, and both lists already show
  everything they have. Adding non-functional links would be worse than
  omitting them.
- The reference's rich assistant reply (a rendered data table of top 5
  customers) — the current chat renders plain text/markdown-style replies
  from the real model; building a structured-table-response renderer is a
  chat-protocol feature, not a static design-match change, and the model's
  own text formatting already covers the same information.
- **Recent conversations showing "Nothing yet"** — correct, honest empty
  state for this browser's real `localStorage`, not a bug. Didn't fabricate
  fake conversation history to match the reference's populated list, and
  didn't trigger a real call to the live Claude backend just to seed a
  screenshot (that's a real external API call with a real cost, not a free
  visual affordance).

## Verification

Tested the new "New booking" button live — modal opens, form is genuinely
blank (no stale prefill). Dark theme and mobile (390×844) both checked —
clean; card titles truncate at narrow width via the same `truncate` pattern
used everywhere else in the app, not a new issue. `npx vitest run`:
154/154 passing. Build clean.

## Stop

Converged after 1 iteration — same story as Reports: already close, this
pass found and closed the two real gaps (header action, sidebar card)
without touching what already matched or fabricating what shouldn't exist.
