import type { JSX } from 'react';
/**
 * The live "now" marker. Reuses the `destructive` token (the closest
 * existing red in the palette, docs/DESIGN.md §3) rather than adding a new
 * one for a single line.
 */
export function NowLine({ topPercent }: { topPercent: number }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{ top: `${topPercent}%` }}
      className="pointer-events-none absolute inset-x-0 z-base border-t-2 border-destructive"
    >
      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-destructive" />
    </div>
  );
}
