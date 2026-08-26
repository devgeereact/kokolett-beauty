import { type JSX, type ReactNode, useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { buildImageKitUrl } from '@/lib/imagekit';
import { cn } from '@/lib/utils';

export interface HeroSlide {
  photoPath: string;
  /** CSS `object-position`, tuned per photo so the crop keeps the subject in frame. */
  objectPosition: string;
}

/**
 * One scrim, identical on every slide, dark enough to hold white text
 * legible over any source photo regardless of how bright that photo is —
 * a uniform gradient rather than per-slide tuning that would drift out of
 * sync as photos are swapped.
 */
const SCRIM =
  'radial-gradient(120% 90% at 15% 0%, rgba(240,163,120,.22), transparent 55%), ' +
  'linear-gradient(195deg, rgba(20,14,12,.5) 0%, rgba(20,14,12,.62) 45%, rgba(16,11,10,.8) 100%)';

const SLIDE_MS = 5500;

/**
 * The hero's background: cross-fading real photos with dot/arrow
 * navigation. Auto-advances unless `prefers-reduced-motion` is set —
 * manual controls still work either way. `children` renders on top,
 * unchanged.
 */
export function HeroCarousel({
  children,
  slides,
}: {
  children: ReactNode;
  slides: HeroSlide[];
}): JSX.Element {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion || slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, slides.length]);

  const go = (delta: number): void => {
    setIndex((i) => (i + delta + slides.length) % slides.length);
  };

  return (
    <section
      className="relative flex flex-col justify-end overflow-hidden text-hero-fg"
      style={{ minHeight: '80vh' }}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.photoPath}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden="true"
        >
          <img
            src={buildImageKitUrl(slide.photoPath, { width: 1920, quality: 85 })}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: slide.objectPosition }}
          />
          <div className="absolute inset-0" style={{ background: SCRIM }} />
        </div>
      ))}
      <div
        className="bg-grain pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        aria-hidden="true"
      />

      {children}

      {slides.length > 1 && (
        <div
          className="absolute inset-x-0 z-10 flex justify-center gap-2"
          style={{ bottom: 20 }}
          role="tablist"
          aria-label="Hero photo"
        >
          {slides.map((slide, i) => (
            <button
              key={slide.photoPath}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'w-6 rounded-full transition-colors',
                i === index ? 'bg-hero-fg' : 'bg-hero-fg/35',
              )}
              style={{ height: 3 }}
            />
          ))}
        </div>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-4 right-5 z-10 hidden gap-1.5 md:right-8 md:flex">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-hero-fg/35 bg-hero-fg/10 text-hero-fg backdrop-blur hover:bg-hero-fg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-hero-fg/35 bg-hero-fg/10 text-hero-fg backdrop-blur hover:bg-hero-fg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
