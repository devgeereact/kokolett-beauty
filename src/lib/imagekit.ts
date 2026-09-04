import { env } from '@/lib/env';

export interface ImageTransform {
  width?: number;
  height?: number;
  /** 1–100; defaults to 80. */
  quality?: number;
  crop?: 'maintain_ratio' | 'force' | 'at_max';
}

/**
 * Build a real-time ImageKit delivery URL.
 * Transformations are passed via the `tr:` query segment, e.g.
 *   .../image.jpg?tr=w-400,h-300,q-80,f-auto
 */
export function buildImageKitUrl(path: string, t: ImageTransform = {}): string {
  const endpoint = env.imagekitUrlEndpoint.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');

  const params: string[] = [];
  if (t.width) params.push(`w-${t.width}`);
  if (t.height) params.push(`h-${t.height}`);
  params.push(`q-${t.quality ?? 80}`);
  params.push('f-auto'); // let ImageKit pick webp/avif per browser
  if (t.crop) params.push(`c-${t.crop}`);

  return `${endpoint}/${cleanPath}?tr=${params.join(',')}`;
}

/** Widths a hero or full-bleed photo is actually rendered at, in CSS pixels. */
const RESPONSIVE_WIDTHS = [640, 960, 1280, 1600, 1920];

/**
 * A `srcSet` for a full-bleed image, so a phone fetches a phone-sized file.
 *
 * ImageKit renders any width on demand, so the only thing stopping this was
 * that nothing asked for it: the home page's hero requested `w-1920` and
 * nothing else, and a 390px phone downloaded a 1920px file for every slide.
 * Pair it with `sizes` at the call site (`100vw` for a full-bleed photo).
 */
export function buildImageKitSrcSet(
  path: string,
  t: Omit<ImageTransform, 'width'> = {},
): string {
  return RESPONSIVE_WIDTHS.map(
    (w) => `${buildImageKitUrl(path, { ...t, width: w })} ${w}w`,
  ).join(', ');
}
