import type { Tone } from '@/lib/tone';
import { SERVICE_GROUPS } from '@/lib/business';

// The 6 categories seeded in migration 0018 — one distinct tone each, so the
// badge colour actually carries information (matching the reference's
// per-category colour coding) instead of every card wearing the same tint.
// Falls back to a stable hash for a category the owner types fresh, so a
// 7th one never crashes or all lands on one colour.
const TONE_ROTATION: Tone[] = [
  'primary',
  'pending',
  'in_service',
  'confirmed',
  'urgent',
  'completed',
];

/* Derived from SERVICE_GROUPS rather than re-listing the six names here. The
   group names used to be written out twice, and when `0066` renamed "Twists and
   locs" to "Twists" only one copy was a compile error; the other degraded
   silently to a hashed colour. */
const CATEGORY_TONES: Record<string, Tone> = Object.fromEntries(
  SERVICE_GROUPS.map((group, i) => [group, TONE_ROTATION[i % TONE_ROTATION.length]!]),
);

export function toneForCategory(name: string): Tone {
  const known = CATEGORY_TONES[name];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < name.length; i += 1)
    hash = (hash + name.charCodeAt(i)) % TONE_ROTATION.length;
  return TONE_ROTATION[hash]!;
}
