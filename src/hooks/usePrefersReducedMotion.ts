import { useEffect, useState } from 'react';

/** DESIGN.md §7 — motion that isn't already covered by the global CSS rule
    (e.g. a pointer-driven effect computed in JS, not a CSS transition) must
    check this itself. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (): void => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
