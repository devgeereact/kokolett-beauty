import { type JSX, type ReactNode, useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

/**
 * Three warm-wash tones, cross-fading behind the hero copy — a stand-in for
 * a real photo rotation once photography exists (`docs` — 2026-08 rebrand).
 * Each is the same colour-wash treatment as the static hero it replaced,
 * just angled and weighted differently so the cross-fade reads as motion,
 * not a flicker.
 */
const TONES = [
  'radial-gradient(130% 95% at 12% -6%, rgba(240,163,120,.38), transparent 55%), ' +
    'linear-gradient(195deg, rgba(84,46,32,.18) 0%, rgba(58,32,24,.5) 55%, rgba(40,24,20,.86) 100%), ' +
    'linear-gradient(125deg, #c07a4e 0%, #a2593b 24%, #6b3d34 55%, #3a2a2c 82%, #2a2124 100%)',
  'radial-gradient(130% 95% at 82% -6%, rgba(214,150,140,.32), transparent 55%), ' +
    'linear-gradient(195deg, rgba(60,40,42,.2) 0%, rgba(45,30,34,.55) 55%, rgba(30,20,24,.88) 100%), ' +
    'linear-gradient(125deg, #8a5a4a 0%, #6b3d3a 30%, #4a2e30 60%, #2a1f24 100%)',
  'radial-gradient(130% 95% at 50% 100%, rgba(230,180,120,.3), transparent 55%), ' +
    'linear-gradient(195deg, rgba(70,42,30,.18) 0%, rgba(50,30,24,.55) 55%, rgba(32,20,18,.88) 100%), ' +
    'linear-gradient(125deg, #b5754a 0%, #8a4a34 30%, #52302a 60%, #291d1f 100%)',
] as const;

const SLIDE_MS = 5500;

/**
 * The hero's background: cross-fading tones with dot/arrow navigation.
 * Auto-advances unless `prefers-reduced-motion` is set — manual controls
 * still work either way. `children` renders on top, unchanged.
 */
export function HeroCarousel({ children }: { children: ReactNode }): JSX.Element {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % TONES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const go = (delta: number): void => {
    setIndex((i) => (i + delta + TONES.length) % TONES.length);
  };

  return (
    <section
      className="relative flex flex-col justify-end overflow-hidden text-hero-fg"
      style={{ minHeight: '80vh' }}
    >
      {TONES.map((tone, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ background: tone, opacity: i === index ? 1 : 0 }}
          aria-hidden="true"
        />
      ))}
      <div
        className="bg-grain pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        aria-hidden="true"
      />

      {children}

      <div
        className="absolute inset-x-0 z-10 flex justify-center gap-2"
        style={{ bottom: 20 }}
        role="tablist"
        aria-label="Hero photo"
      >
        {TONES.map((_, i) => (
          <button
            key={i}
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
    </section>
  );
}
