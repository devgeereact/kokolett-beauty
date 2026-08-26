import { type CSSProperties, type JSX, type PointerEvent, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { buildImageKitUrl } from '@/lib/imagekit';
import { photoPlaceholderBackground } from '@/lib/photoPlaceholder';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

interface PhotoCardProps {
  /** ImageKit path, once real photography exists. Falls back to a warm
      placeholder gradient when absent. */
  imagePath?: string | null;
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
}

const MAX_TILT_DEG = 7;

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

  const groundStyle: CSSProperties = imagePath
    ? {
        backgroundImage: `url(${buildImageKitUrl(imagePath, { width: 640, height: 800 })})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: photoPlaceholderBackground(placeholderTone) };

  const body = (
    <>
      {tag && (
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-hero-fg/60">
          {tag}
        </span>
      )}
      <h3 className="font-serif text-lg font-semibold text-hero-fg">{title}</h3>
      {description && <p className="mt-1 text-sm text-hero-fg/80">{description}</p>}
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
      <div className="absolute inset-0" style={groundStyle} aria-hidden="true" />
      <div
        className="bg-grain absolute inset-0 opacity-20 mix-blend-overlay"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"
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
