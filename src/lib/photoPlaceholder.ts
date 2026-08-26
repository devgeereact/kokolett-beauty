/**
 * Warm duotone stand-ins for real photography.
 *
 * Every marketing photo slot (services, gallery, About) accepts a real
 * ImageKit path once photos exist; until then it falls back to one of these
 * six gradients rather than an empty grey box, the same "always render
 * something believable" approach `ServicesCatalogue`'s `Avatar` fallback
 * already uses for owner-uploaded photos. Swapping in a real photo is a
 * data change (set `imagePath`), never a code change.
 *
 * Colours are inline rather than Tailwind classes because they are
 * generated per index, not a fixed set of utility classes — the same
 * "genuinely dynamic" carve-out `docs/RULES.md` gives `style={{}}`.
 */
const TONES = [
  'linear-gradient(150deg,#8a4a34,#3a2a2c 70%)',
  'linear-gradient(150deg,#c2653f,#4a2e2a 70%)',
  'linear-gradient(160deg,#734334,#221a1d 75%)',
  'linear-gradient(140deg,#a05b3c,#2b2224 72%)',
  'linear-gradient(160deg,#9c5636,#31262a 68%)',
  'linear-gradient(150deg,#7a4a3a,#26201f 70%)',
] as const;

export function photoPlaceholderBackground(tone: number): string {
  return TONES[Math.abs(tone) % TONES.length] ?? TONES[0];
}
