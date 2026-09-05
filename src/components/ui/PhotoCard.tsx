import { type CSSProperties, type JSX, type PointerEvent, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { buildImageKitUrl } from '@/lib/imagekit';
import { photoPlaceholderBackground } from '@/lib/photoPlaceholder';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

/**
 * A card either shows a photograph, in which case it must describe it, or it
 * shows a placeholder gradient and takes no alt at all. Expressed as a union so
 * the compiler enforces it: `alt?: string` let a caller omit the description and
 * silently fall through to `alt=""`, which marks the photo decorative and drops
 * it from image search, the exact thing rendering a real `<img>` was for.
 */
type PhotoSource =
  | { imagePath: string | null | undefined; alt: string }
  | { imagePath?: undefined; alt?: undefined };

type PhotoCardProps = PhotoSource & {
  /** Selects which of the six placeholder gradients to use — pass the
      grid index so neighbouring cards don't repeat the same tone. */
  placeholderTone: number;
  tag?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  /** Internal route — rendered as a `Link`. External CTAs aren't a use
      case this component has yet. */
  ctaHref?: string;
  className?: string;
};

const MAX_TILT_DEG = 7;

/**
 * Bottom-anchored scrim for the text band, tuned so it never fades to fully
 * transparent — unlike a plain `to-t ... to-transparent` gradient, which
 * leaves the topmost text line (the `tag`) unreadable over a bright photo.
 * Unlike HeroCarousel's full-bleed `SCRIM`, this stays light over most of
 * the card so the photography itself still reads full-bleed above the text.
 */
export const PHOTO_SCRIM =
  'linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.62) 35%, rgba(0,0,0,.4) 55%, rgba(0,0,0,.14) 100%)';

/**
 * A full-bleed image card with a bottom scrim, used for the services and
 * gallery grids (docs — 2026-08 marketing rebrand). Cursor-tracked 3D tilt
 * plus a glare that follows the pointer; both are skipped under
 * `prefers-reduced-motion` and on touch devices, where there's no hover to
 * track.
 */
export function PhotoCard({
  imagePath,
  placeholderTone,
  alt,
  tag,
  title,
  description,
  ctaLabel,
  ctaHref,
  className,
}: PhotoCardProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (reducedMotion || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(px - 0.5) * MAX_TILT_DEG * 2}deg`);
    el.style.setProperty('--ry', `${(0.5 - py) * MAX_TILT_DEG * 2}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  };

  const onPointerLeave = (): void => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  /* A real `<img>` rather than a CSS background. Visually identical under the
     scrim, but a background-image carries no alt text and image search cannot
     index it, which for a salon whose work is the product was throwing away the
     whole of Google Images.

     `rounded-[inherit]` is load-bearing, not decoration. A background-image is
     painted by the element itself and is always clipped to its own
     border-radius. A child `<img>` relies on the parent's `overflow-hidden`,
     and WebKit does not reliably apply that clip once the parent carries a 3D
     transform, which this card does unconditionally via `perspective()`. Without
     it the photograph renders with square corners overflowing the rounded card
     on Safari and iOS, while the scrim and grain stay rounded. */
  const placeholderStyle: CSSProperties = {
    background: photoPlaceholderBackground(placeholderTone),
  };

  const body = (
    <>
      {tag && (
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-hero-fg/60">
          {tag}
        </span>
      )}
      {/* Clamped, not truncated at a character: the card's height is fixed
          by its 3/4 aspect ratio and the text block is anchored to the
          bottom, so a long title or a long description grew UPWARD and was
          cut by the card's own `overflow-hidden` — mid-line, with no ellipsis
          to say so. At 200% zoom that happened to ordinary-length copy too.
          Two lines each keeps the band inside the darkest part of the scrim,
          which is also where it stays readable over a bright photograph. */}
      <h3 className="line-clamp-2 font-serif text-lg font-semibold text-hero-fg">
        {title}
      </h3>
      {description && (
        <p className="mt-1 line-clamp-2 text-sm text-hero-fg/80">{description}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link
          to={ctaHref}
          className="mt-3 inline-flex min-h-touch items-center gap-1.5 rounded-full border border-hero-fg/40 bg-hero-fg/15 px-4 text-sm font-semibold text-hero-fg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ctaLabel}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </>
  );

  return (
    <Card
      ref={ref}
      variant="photo"
      className={cn(
        'group transition-[transform,box-shadow] duration-300 ease-out motion-reduce:transform-none',
        className,
      )}
      style={{
        aspectRatio: '3 / 4',
        transform: 'perspective(900px) rotateX(var(--ry, 0deg)) rotateY(var(--rx, 0deg))',
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {imagePath ? (
        <img
          src={buildImageKitUrl(imagePath, { width: 640, height: 800 })}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={placeholderStyle} aria-hidden="true" />
      )}
      <div
        className="bg-grain absolute inset-0 opacity-20 mix-blend-overlay"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{ background: PHOTO_SCRIM }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(220px 220px at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,.35), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 p-4">{body}</div>
    </Card>
  );
}
