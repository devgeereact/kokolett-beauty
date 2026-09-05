import { type JSX, type ReactNode, useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { buildImageKitSrcSet, buildImageKitUrl } from '@/lib/imagekit';
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

  /**
   * WCAG 2.2.2 (Pause, Stop, Hide, Level A) wants a MECHANISM to stop motion
   * that starts automatically and lasts more than five seconds. Honouring
   * `prefers-reduced-motion` is not that mechanism: that exemption belongs to
   * 2.3.3, and a visitor who simply wants to finish reading a caption has no
   * OS setting to reach for. So: an explicit toggle, plus an automatic pause
   * whenever the pointer or keyboard focus is inside the hero, which is the
   * moment someone is most likely to be reading it.
   */
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const running = !reducedMotion && !paused && !interacting;

  /**
   * How far through the carousel anyone has actually got.
   *
   * Every slide used to render its `<img>` on mount, all six of them, all at
   * `w-1920`, all eagerly — the home page pulled the entire carousel down
   * before showing one frame of it, and `loading="lazy"` is no help because
   * the slides are stacked in the viewport, merely transparent. Rendering
   * only up to `reached` means the first paint fetches one photo. The `+ 1`
   * keeps one slide ahead of the customer so a cross-fade never starts
   * against an empty box.
   */
  const [reached, setReached] = useState(0);
  useEffect(() => {
    setReached((r) => Math.max(r, index));
  }, [index]);

  useEffect(() => {
    if (!running || slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [running, slides.length]);

  const go = (delta: number): void => {
    setIndex((i) => (i + delta + slides.length) % slides.length);
  };

  return (
    <section
      className="relative flex flex-col justify-end overflow-hidden text-hero-fg"
      style={{ minHeight: '80vh' }}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={() => setInteracting(false)}
    >
      {slides.map((slide, i) => (
        <div
          key={slide.photoPath}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden="true"
        >
          {i <= reached + 1 && (
            <img
              src={buildImageKitUrl(slide.photoPath, { width: 1920, quality: 85 })}
              /* The first slide is the largest thing on the page and almost
                 certainly its LCP element, so it is fetched at high priority
                 and never deferred. The rest are explicitly low, so they
                 cannot compete with it or with the JavaScript. */
              srcSet={buildImageKitSrcSet(slide.photoPath, { quality: 85 })}
              sizes="100vw"
              fetchPriority={i === 0 ? 'high' : 'low'}
              decoding={i === 0 ? 'sync' : 'async'}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: slide.objectPosition }}
            />
          )}
          <div className="absolute inset-0" style={{ background: SCRIM }} />
        </div>
      ))}
      <div
        className="bg-grain pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        aria-hidden="true"
      />

      {children}

      {/* Plain buttons, not `role="tablist"`/`role="tab"`. A tab has to control
          a `tabpanel` via `aria-controls`, and these control slides that are
          themselves `aria-hidden`, so the ARIA contract was one a screen
          reader could not follow. `aria-current` says the same thing honestly.
          Each dot stays 3px tall visually but carries a transparent 24px
          touch area (WCAG 2.5.8), since below `md` the arrows are hidden and
          these are the only manual control a phone gets. */}
      {slides.length > 1 && (
        <div
          className="absolute inset-x-0 flex items-center justify-center gap-1"
          style={{ bottom: 12 }}
        >
          {slides.map((slide, i) => (
            <button
              key={slide.photoPath}
              type="button"
              aria-label={`Show photo ${i + 1} of ${slides.length}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
              className="grid h-6 w-8 place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block w-6 rounded-full transition-colors',
                  i === index ? 'bg-hero-fg' : 'bg-hero-fg/35',
                )}
                style={{ height: 3 }}
              />
            </button>
          ))}
          <button
            type="button"
            aria-label={
              paused ? 'Resume the photo slideshow' : 'Pause the photo slideshow'
            }
            aria-pressed={paused}
            onClick={() => setPaused((p) => !p)}
            className="ml-2 grid h-6 w-6 place-items-center rounded-full text-hero-fg/70 hover:text-hero-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="currentColor"
              aria-hidden="true"
            >
              {paused ? (
                <path d="M8 5v14l11-7z" />
              ) : (
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              )}
            </svg>
          </button>
        </div>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-4 right-5 hidden gap-1.5 md:right-8 md:flex">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-hero-fg/35 bg-hero-fg/10 text-hero-fg backdrop-blur hover:bg-hero-fg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-hero-fg/35 bg-hero-fg/10 text-hero-fg backdrop-blur hover:bg-hero-fg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
