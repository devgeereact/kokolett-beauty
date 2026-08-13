Build the [SCREEN NAME] screen by closely recreating the UI from @design/[screen]-ui-design.png.

Your goal is to match the reference design as accurately as possible, including:
* Layout and spacing
* Typography — Inter for UI/body, Source Serif 4 for display/marketing headings, JetBrains Mono for numerals, booking references and times
* Colors and gradients — pull exact values from the `--token` custom properties in `src/index.css` / `tailwind.config.ts`; never hardcode a raw hex
* Button styles (pill-shaped chips, primary terracotta fill with white text, secondary/muted variants)
* Input fields, labels, and focus rings (`:focus-visible` ring must stay visible — never remove it)
* Border radius (`--radius: 0.75rem` scale — `rounded-lg` default, `rounded-xl`/`rounded-2xl` for hero/marketing cards)
* Shadows and depth (single `shadow-card` token only — no stacked shadows)
* Icons and imagery
* Alignment and padding
* Overall visual hierarchy, in both light and dark mode if the reference covers both

Use the existing project structure and styling system — page in `src/pages`, components in `src/components`, tokens in `src/index.css` / `tailwind.config.ts`. Do not redesign, invent new tokens, or improvise unless something is genuinely missing from the reference.

After implementing the first version, start the dev server (`npm run dev`, port 5082) and use Playwright to drive the installed Chrome and screenshot the [SCREEN NAME] screen — the Claude Chrome extension isn't connected in this environment, so drive Chrome via a Playwright script in the session scratchpad, the same method used for prior UI verification on this project. Compare the screenshot against @design/[screen]-ui-design.png.

Then iterate:
1. Identify all visual differences.
2. Update the implementation.
3. Take another screenshot.
4. Compare again.
5. Repeat until the implemented screen is visually as close to the reference as possible.

Check both light and dark mode against the reference where applicable. Be strict with the comparison — pay attention to small details like spacing, text positioning, button height, touch-target size (44×44px minimum), shadow, image cropping, and color accuracy against the exact token values.

Do not stop after the first implementation. Keep refining until the screenshot and the reference design look nearly identical.
