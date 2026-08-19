# Customers screen — design-match log

Target: `CustomersPage.tsx`, route `/dashboard/customers`. Ref:
`docs/design/customer.png`.

**Explicit deviation from the reference, requested by the user up front:**
the reference is a table (rows). The owner asked for a card grid instead.
Followed that instruction over the reference — everything else (tokens,
detail panel, header actions) still targets the reference as closely as
possible.

## Iteration 1 — table → card grid

- New `CustomerCard.tsx`: same fields the old `CustomerTable.tsx` row
  carried (avatar, name + "New" badge, email/mobile, last visit, total
  visits, active/inactive badge, favourite-service badges, "…" menu),
  restyled as a `Card` following the exact pattern already established by
  `ApprovalCard`/`RequestRow` (selected state via `border-primary
ring-1 ring-primary`, hover via `hover:border-foreground/20`) rather than
  inventing a new card shape.
- `CustomersPage.tsx`: swapped the `<CustomerTable>` for a
  `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4` of `CustomerCard`s.
- Deleted `CustomerTable.tsx` — grepped first, confirmed no other importer.

Build clean. Screenshot: 14 real customers render as cards, 3 columns at
desktop width, all data present and correct.

## Iteration 2 — header action gap

Real gap independent of the cards-vs-table change: `Export` was inline
above the grid, and there was no `New booking` button at all — every other
finished screen (Approvals, Availability requests, Today, Appointments,
Calendar) puts both in `DashboardLayout`'s `actions` (top bar), matching the
reference's top-right `Export` + `+ New booking` placement here too.

- Moved `Export` into `actions`, added `New booking` (same `NewBookingPanel`
  in a `Modal` pattern used everywhere else).
- The existing booking modal only rendered `NewBookingPanel` when a customer
  was `selected` (it was wired for "book a follow-up for this specific
  customer" from the detail panel). Made `prefill` nullable so the header
  button can open a blank booking with no customer context — `onBooked`
  branches: reload that customer's detail if one was selected, otherwise
  just reload the list.

Build clean. Verified live: header `New booking` opens a genuinely blank
form (empty name/email, not stale prefill); clicking a card still opens its
detail modal with working "Book again" → prefilled modal, unchanged.

## Not implemented — reference features with no backing data

- **"All tags" filter + tag chips** ("Loyal client", "Blonde tones" in the
  reference's detail panel/toolbar): no `tags` column exists on `customers`
  in the schema (`supabase/migrations/0002_salon.sql` — checked directly,
  full column list has no tags/labels field of any kind). Implementing this
  for real needs a migration, which is a data-model decision, not a
  design-match one. Left out rather than fabricating a fake tag list.
- **"All time"/"All services"/"More filters"** toolbar richness: the
  reference's filter row has 5 controls, current build has 2 (search +
  status). Status/date/service filtering is all technically feasible today
  without schema changes, but the user's ask this round was specifically
  "change list to cards" — treated the fuller filter bar as separate scope
  rather than smuggling it in unasked. Flagging here so it's a known gap,
  not a missed one, if the next pass wants it.

## Iteration 3 — dark theme + mobile breakpoint pass

No reference for dark/mobile. Judged against tokens and the pattern already
converged on Approvals/Availability requests.

- Dark desktop: clean, card borders/badges/tokens all read correctly.
- Mobile light/dark (390×844): grid collapses to a single column, each card
  full width, all content fits with no overflow or clipped buttons.

Build clean on every iteration.

## Stop (first pass)

Converged after 3 iterations for what was in scope. Outstanding, logged
above rather than guessed at: tags (no schema), and toolbar filter richness
(separate scope from the requested list→cards change).

## Iteration 4 — follow-up request: move messages into the profile, drop two sections

Owner asked to (1) move "Customer messages" into the customer profile for
easy per-customer replying, (2) remove "Cancellation risk" outright — not
needed for this app, (3) stop showing "Repeat customers" for now but keep
it for a future priority pass.

- `CommunicationAssistancePanel.tsx`: added an optional `customerEmail`
  prop. When set, filters `getRecentMessages()`'s results to that one
  customer (case-insensitive match on `customerEmail`) and auto-selects the
  top message so there's a draft ready immediately — scoped to one person,
  the old "pick a message first" step was pure friction. Empty-state copy
  branches on whether it's scoped ("Nothing from them yet…") vs salon-wide.
- `CustomerDetailPanel.tsx`: added a 4th tab, "Message", rendering
  `<CommunicationAssistancePanel timezone={timezone}
customerEmail={customer.email} />`. Verified live against real data:
  Bianca Chukwu (2 real notes) shows exactly her 2, correctly filtered out
  of the other 12 customers' notes; Funmi Ade (0 notes) shows the scoped
  empty state; both read/act correctly in dark mode too.
- **Cancellation risk — deleted, not hidden**, per "not needed for this
  app": `CancellationForecastingPanel.tsx`, `getCancellationForecast()`
  (`assistantService.ts`), `forecastCancellationRisk()` +
  `CancellationRisk` type (`lib/insights.ts`), and its test suite
  (`insights.test.ts`) are all gone. Also dropped the PRD's mention of it
  (`docs/PRD.md` §AI assistant) so the docs don't describe a feature that no
  longer exists. Checked first that `CancellationRisk`/
  `forecastCancellationRisk` weren't used anywhere outside this cluster —
  they weren't.
- **Repeat customers — kept, just unmounted**, per "noted for someday":
  `RepeatCustomerInsightsPanel.tsx` is untouched on disk. Removed the
  `<AdvisorySection>` that rendered it on this page and left an inline
  comment at the removal site pointing at the file and explaining it's
  deprioritised for a single-owner salon today, not gone — the way back is
  re-adding one `<AdvisorySection>` line, not rebuilding anything.
- Removed the now-empty `AdvisorySection`/`CommunicationAssistancePanel` /
  `RepeatCustomerInsightsPanel` / `CancellationForecastingPanel` imports
  from `CustomersPage.tsx`.

Build clean. Full test suite run (`npx vitest run`) — 154/154 passing,
including the trimmed `insights.test.ts`. Verified live: Customers page now
ends right after the card grid, no trailing advisory sections; a customer's
own Message tab works standalone. Also reconfirmed the login session
(browse daemon had restarted and dropped it mid-session) using the
Keychain-stored owner credential, per [[kokolett-accounts]] — piped inline,
never printed standalone.

## Iteration 5 — follow-up request: 9 per page, no scroll

Owner asked for 9 cards per page, fit to screen with no scroll (same ask as
Services, different number — 3×3 here vs 4×4 there, since this card
carries more fields).

- Added real pagination — there wasn't any before, `filtered.map()` just
  rendered every match. Added `page`/`PAGE_SIZE=9` state, a `pageCustomers`
  slice, a `<Pagination>` (same component `ServicesCatalogue`/
  `RequestsQueue` already use), and a `useEffect` resetting to page 1 on
  search/status-filter change — otherwise changing a filter could strand
  the view on a now-out-of-range page.
- Compacted `CustomerCard.tsx`: `p-5`→`p-3`, avatar `md`→`sm`, every
  internal gap/margin tightened (`gap-4`→`gap-1.5`, `pt-3`→`pt-1.5`, etc).
- **Capped the favourite-services row to one line unconditionally**
  (`flex-wrap`→`flex-nowrap overflow-hidden`, `shrink-0` on each badge,
  slice 3→2 before the "+N" badge). This one isn't just cosmetic: with
  `flex-wrap` a customer with 3 favourite services could wrap that row to 2
  lines, and since CSS grid sizes each row to its tallest cell, one such
  customer landing in the visible 9 would blow the fit budget for the whole
  row of cards — capped it so the card height is that same regardless of
  data instead of being a happy accident of the current 14 demo rows never
  triggering the wrap.
- Tightened the toolbar: `mb-4`→`mb-2` on the count line, `mb-6`→`mb-3` on
  the search/filter row.

Measured `document.body.scrollHeight` vs `window.innerHeight` at 1440 wide,
same method as Services:

| height | fit?                |
| ------ | ------------------- |
| 1024px | yes                 |
| 900px  | yes (900/900 exact) |
| 800px  | 836/800 (36px over) |

Stopped at 900px as the practical baseline rather than chasing 800px like
Services did — this card carries meaningfully more content (2 contact
lines, a stats row, a favourites row vs Services' 2 lines total), and
compacting further started to feel cramped. 900px covers real laptop/
desktop use; 800px is an unusually short viewport.

Build clean. Full test suite: 154/154 passing. Verified live: pagination
count text ("Showing 1 to 9 of 14 customers"), page 2 navigation, and both
themes all correct.

## Stop
