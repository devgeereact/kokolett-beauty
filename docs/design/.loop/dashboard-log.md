# Dashboard (TodayPage.tsx) — design-match log

Ref: `docs/design/dashboard.png`. Route: `/dashboard`.

## Baseline

`TodayPage.tsx` was already substantially built (schedule, next up, glance grid,
approvals queue, bookings chart, availability requests, recent activity, assistant
insights row) — this loop is refinement, not a from-scratch build.

## Iteration 1 (light, desktop, 1536×1024)

Screenshot: `dashboard-1.png`.

Diffs found vs ref:

1. **"New booking" button had no leading `+` icon** — ref shows `+ New booking ⌄`.
   Fixed: added a `Plus` icon (`lucide-react`, `h-4 w-4`) before the label in
   `TodayPage.tsx`. Did **not** add the trailing chevron/dropdown — ref implies a
   split-button with variant options that don't exist as a spec'd feature; inventing
   dropdown behaviour would violate "don't invent a different layout." Logged as
   inferred/skipped.
2. **Sidebar/top-bar chrome is flat-dark in ref, grouped-light in the shipped app.**
   Out of scope — `docs/design/build-loop.md` and recent commits
   (`feat(dashboard): rebuild sidebar nav onto the grouped Owner Console IA`)
   establish the shell as already shipped and deliberately superseding this static
   mockup. Not touched.
3. **Top bar has a clock / "Live" connection indicator / Refresh button** that ref's
   static mockup doesn't show. These are real `TodayPage`-owned functionality
   (realtime connection status, manual refresh), not decorative — kept, not removed.
4. **"Today's schedule" header action is a plain text link ("View calendar"), ref
   shows it as a bordered button.** Already a documented, deliberate prior decision
   (see inline comment in `TodayPage.tsx`: bordered button "sat heavier than its
   siblings and squeezed the title onto two lines"). Left as-is — reverting would
   undo an intentional consistency fix for a cosmetic ref mismatch.
5. **Avatars are tinted silhouette placeholders, not photos.** Also documented and
   intentional (`Avatar.tsx`: "No customer photo exists anywhere in the schema...
   without fabricating anyone's likeness"). Left as-is.
6. **"Next up" card's client-notes callout (⭐ box) never renders** in the current
   demo data — the component (`NextUpCard.tsx`) already conditionally renders it
   from `appointment.customer_note`, matching ref exactly when that field is set.
   The two demo appointments picked as "next up" today simply have no
   `customer_note`. This is a data gap, not a code defect — did not touch the live
   Supabase demo data to force it (out of scope: seeding/editing live rows is a
   separate, higher-blast-radius action from a per-screen visual-match pass).

Inferred values used: none new — button icon sized to existing `Button` icon-gap
convention (`gap-2` from the shared component), not a fabricated token.

## Iteration 2 (light, desktop) — verify fix

Screenshot: `dashboard-2.png`. Build clean (`npm run build`). Plus icon renders
correctly; button now matches ref's weight/shape. No new diffs found — layout,
spacing, card grid (schedule spans 2 rows col 1 · next-up/glance row 1 col 2-3 ·
bookings-overview row 2 col 2-3 · approvals/requests/notifications stacked col 4),
typography (sans throughout per `docs/DESIGN.md` §4 "dashboard leans utilitarian",
correcting my own initial misread of serif in the stat numbers), status colours,
radii, shadows, and icon set all resolve to existing tokens already.

Light/desktop: **converged after iteration 2.**

## Iteration 3 — user-reported bug (light + dark, desktop)

User flagged unusual dead space at the bottom of "Today's schedule" and "Bookings
overview". Measured via `browse js` bounding rects rather than guessing:

- **Today's schedule**: the `Card` was `flex h-full flex-col` inside a grid with
  `lg:items-stretch`, forced to stretch across both grid rows (`lg:row-span-2`) to
  match the taller neighbouring column. `ScheduleTimeline` itself is deliberately
  fixed-height ("does not stretch to match a neighbouring card" — its own comment).
  Stretching the _card_ while the _timeline_ refused to stretch left ~240px of blank
  space trailing after the "3 appointments / View full day" footer.
- **Bookings overview**: same root cause. The chart's `flex-1 justify-center` wrapper
  was centering correctly (measured: 137px equal padding top and bottom) — not a bug
  in that component — but the card was stretched to match the tall Availability
  requests + Recent activity stack beside it, so a small fixed 160px chart sat in a
  ~434px pocket, reading as wasted space even though it was technically centered.

Fix: both grid items now use `lg:self-start` instead of `h-full`/stretch — same grid
placement (columns/rows unchanged), but sized to their own content instead of the
row track's height. Removed the now-dead `h-full` from `BookingsOverviewChart`'s
`Card` and the `flex-1 justify-center` wrapper around its chart (no longer needed
once the card stops stretching). Comments updated to match.

Screenshots: `dashboard-3.png` (light), `dashboard-dark-2.png` (dark). Both cards now
end right after their content — no dead space. Mobile unaffected (single-column
stack was never stretched). Build clean.

## Iteration 4 — user request: remove Recent notifications, align all cards

Removed `RecentActivityCard` ("Recent notifications") from the dashboard entirely —
deleted `src/components/dashboard/today/RecentActivityCard.tsx` (only consumer was
this page) and its usage/import in `TodayPage.tsx`. The header bell badge count
(`getRecentActivity` call for `recentNotificationCount`) is independent and stays.

That removal collapsed col4/row2 from a 2-card stack down to a single
`AvailabilityRequestsCard` (added a `className` prop to it, matching the pattern
already used by `ApprovalsQueueCard`/`GlanceGrid`/`NextUpCard`).

With the stack gone, re-measured (`browse js` bounding rects) instead of guessing:
row2's tallest natural card is now `Availability requests` at 347px vs `Bookings
overview`'s 330px — only 17px apart (previously the 2-card stack made this ~250px+).
`Today's schedule`'s own natural content height (769px) turned out to already equal
row1 (406) + gap (16) + row2 (347) exactly — the fixed-hour timeline for today's real
opening hours (08:00–17:00) coincidentally sums to the same figure.

Given the gap is now small either way, switched back from the iteration-3 `self-start`
fix to real grid stretch (`h-full` on the schedule Card and the Bookings-overview
wrapper, `flex-1 justify-center` restored around the chart) — CSS grid now guarantees
exact alignment rather than relying on matching content coincidentally, and the
stretch is small enough (≤17px) to be invisible rather than the old multi-hundred-px
dead zone. Verified via bounding rects: all of schedule/bookings/availreq bottom at
y=880, nextUp/glance/approvals bottom at y=517, col4 right edge at x=1512 — everything
lines up.

Screenshots: `dashboard-4.png` (light desktop), `dashboard-dark-3.png` (dark desktop),
`dashboard-mobile-light-2.png` (mobile, unaffected — single column). Build clean.
