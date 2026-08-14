Build the [SCREEN NAME] screen by closely recreating the UI from @docs/design/[FILE].png

Your goal is to match the reference design as accurately as possible, including:
* Layout and spacing
* Typography, font sizes, and font weights
* Colors and gradients
* Button styles
* Input fields
* Border radius
* Shadows and depth
* Icons and imagery
* Alignment and padding
* Overall visual hierarchy

Use the existing project structure and styling system — NativeWind/Tailwind classes only,
tokens from `tailwind.config.ts` / `src/index.css` (see docs/DESIGN.md). Never write a raw
hex value. TypeScript strict, explicit return types. Do not redesign or improvise unless
something is missing from the reference.

This is a static PWA (no native shell, no simulator). Verify in the real browser:
1. Start the dev server (`npm run dev`, port 5082, see CLAUDE.md) if not already running.
2. Use the `/browse` skill to load the route and screenshot the implemented screen.
3. Compare that screenshot against @docs/design/[FILE].png.

Then iterate:
1. Identify all visual differences.
2. Update the implementation.
3. Re-screenshot with `/browse`.
4. Compare again.
5. Repeat until implementation is visually as close to the reference as possible.

Check both light and dark theme (ThemeProvider, `.dark` on `<html>`), and both mobile
and desktop breakpoints — this dashboard is used on a phone during the day and a
desktop at close-out.

Be strict with the comparison. Pay attention to small details: spacing, text
positioning, button height, shadows, image cropping, color accuracy, icon weight.

Do not stop after the first implementation. Keep refining until the browser
screenshot and the reference design look nearly identical.

---

Swap `[SCREEN NAME]` / `[FILE]` per run — e.g. `Dashboard` / `dashboard.png`, `Calendar` /
`calendar.png`, `Availability` / `availability.png` (note: `avalability.png` also exists,
likely dupe/typo — check which is intended before use).
