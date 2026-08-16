# Services screen — design-match log

Target: `ServiceMenuPage.tsx` → `ServicesCatalogue.tsx`, route
`/dashboard/services`. Ref: `docs/design/service.png`.

Owner asked for this screen to be "rebranded" the same way Customers was —
cards, not the reference's table. Unlike Customers, this was **already**
built as a card grid (its own docstring even predates this request) —
someone had already made the same call here. This loop verified that and
closed the real remaining gaps rather than redoing a conversion that was
already done.

## Iteration 1 — baseline screenshot

Loaded live: 49 real seeded services (6 real categories from migration
0018: Braids, Twists and locs, Weaves/wigs/extensions, Natural hair and
styling, Colour, Treatments — matches the reference's "Categories 6" count
exactly, just different category names since this is a real African hair
salon's menu, not the reference's generic one), card grid, tabs
(All/Active/Archived), pagination. Structure already close.

Real gaps found:
1. **"Add new service" was inline in the content**, not the header actions
   bar — every other finished screen (Approvals, Availability requests,
   Customers, Today, Appointments, Calendar) puts its primary action there,
   matching the reference's top-right placement here too.
2. **Every category badge used the same fixed `tone="cancelled"`** (a
   red/pink tint) regardless of which of the 6 real categories a service
   belonged to. The reference colour-codes categories distinctly; this
   build had one static colour for all of them — and `cancelled` is a
   confusing choice to reuse for something that isn't a cancelled-anything.
3. **No path for a real service photo to render**, even though it's
   fully wired everywhere else: `service_menu.image_path` (migration
   0031), the edit form's own "Image path" field, and `buildImageKitUrl()`
   in `lib/imagekit.ts` all exist — but nothing ever read `image_path` to
   render an `<img>`. Confirmed via the seed migration that every one of
   the 49 real rows has `image_path = null` today (never wired anywhere,
   including the public site's own "What we do" section), so this wasn't
   visibly broken — just dead plumbing that would silently do nothing the
   day someone actually uploads a photo through that same form field.

## Iteration 2 — fixed all three

- `ServicesCatalogue.tsx` → `ServiceMenuPage.tsx`: forwarded a ref
  (`ServicesCatalogueHandle.openNew`), same `useImperativeHandle` pattern
  already used by `RequestsQueueHandle`. `ServiceMenuPage` now owns the
  "Add new service" button in `DashboardLayout`'s `actions`, calling
  `catalogueRef.current?.openNew()`. Removed the component's own inline
  button (and the empty-state's own "Add new service" CTA stayed — that's
  a normal empty-state affordance, not a duplicate of the header one).
- Added `toneForCategory()`: a fixed map for the 6 known real categories to
  6 distinct `Tone`s (`primary`/`pending`/`in_service`/`confirmed`/`urgent`/
  `completed`), with a stable hash fallback for a category the owner might
  type fresh later so a 7th one never crashes or defaults to one flat
  colour. Sampled two adjacent badges' pixels to confirm they're genuinely
  distinct hues, not just close in a small screenshot: Braids
  `(240,174,156)` vs Twists and locs `(240,200,153)`.
- Added `ServiceThumb`: renders a real ImageKit-optimised `<img>` when
  `item.image_path` is set, falling back to the same tinted `Avatar`
  placeholder used everywhere else (Customers, Approvals, Requests) when
  not. Used in both the card and the edit modal's header. With all 49 real
  rows still `image_path: null`, this is a no-visible-change fix today —
  verified the fallback still renders correctly — but the day the owner
  fills in a path through the form that's already there, it now actually
  shows.

Build clean. Full test suite: 154/154 passing (no test file existed for
this component specifically; ran the whole suite since the `forwardRef`
refactor touches how the component is called).

## Not implemented — reference feature with no backing model

The reference's **"Categories" tab + header button** (a dedicated
categories management surface, "6" shown as its own filter lane) was not
built. `group_name` on `service_menu` is a free-text column with no
category table behind it — there IS a `service_categories` table in the
schema, but it belongs to the separate single bookable `services` row
(`category_id` FK), not to `service_menu`'s free-text groups. Building a
real categories CRUD surface would mean either wiring two unrelated data
models together or inventing a new one, which is a data-model decision, not
a design-match one. The existing "pick an existing category or type a new
one" combo in the item form already covers the actual need (grouping/
filtering) without that surface. Logged rather than guessed at, same
reasoning as Customers' tags gap.

## Iteration 3 — dark theme + mobile breakpoint pass

No reference for dark/mobile. Judged against tokens and the pattern already
converged on Approvals/Availability requests/Customers.

- Dark desktop: clean, all 6 category tones read correctly against dark
  surfaces, header button and card grid unchanged in shape.
- Mobile light/dark (390×844): grid collapses to one column, header actions
  wrap correctly (Add new service full-width, bell beside it), pagination
  and tabs remain usable.

Build clean on every iteration.

## Iteration 4 — follow-up request: search onto the tab row

Owner asked to move the search bar onto the same line as the
All/Active/Archived tab row, aligned. Restructured the wrapping
`<div>`: the `border-b` moved from the tabs' own div to the shared row
container (`flex justify-between items-center`), tabs left, search right
(`w-64` at `sm:` and up, full-width and dropping below with `mb-3` under
that — same wrap behaviour already used elsewhere for toolbar rows).
Shrunk the input from `h-11` to `h-9` to sit level with the tab row instead
of towering over it. Verified live: search still filters correctly
("cornrow" → just Cornrows), wraps cleanly under the tabs at 390px mobile
width, both themes checked visually.

Build clean.

## Iteration 5 — follow-up request: 16 per page, no scroll

Owner asked for 16 cards per page, fit to screen with no scroll.

- `PAGE_SIZE` 8 → 16.
- Grid forced to 4 columns from `md:` up (`grid-cols-2 md:grid-cols-4`,
  was `sm:2 lg:3 xl:4`) so 16 always lays out as 4×4, not a ragged 3-wide
  block.
- Compacted the card: `p-4`→`p-2.5`, avatar `md`→`sm` (added an `sm` size
  to `ServiceThumb`/`THUMB_PX`/`THUMB_CLASS`, previously only `md`/`lg`
  existed), tightened every internal margin (`mb-3`→`mb-1.5` etc.), dropped
  the optional description/note line entirely (kept in the edit modal;
  none of the 49 real rows have one set, and a 2-line note would blow the
  row-height budget unpredictably since CSS grid rows size to their
  tallest cell).
- Tightened the tab-row bottom margin `mb-4`→`mb-3`.

Measured `document.body.scrollHeight` vs `window.innerHeight` at three
viewport heights (1440 wide) rather than eyeballing:

| height | before | after |
|---|---|---|
| 1024px | fit | fit |
| 900px | — | fit (900/900) |
| 800px | — | 802/800 (2px over — imperceptible) |

Screenshotted at 800px to confirm it's not cramped despite the tight
budget — still legible, matches the "not too dense" bar `service-16-fit-800.png`
sets.

Build clean.

## Stop

Converged after 5 iterations. Nothing left that's fixable from code beyond
what's logged above (categories management surface — separate scope/data
model decision).
