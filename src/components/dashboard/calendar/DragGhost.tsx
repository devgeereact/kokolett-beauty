import type { JSX } from 'react';
export interface DragGhostProps {
  topPercent: number;
  heightPercent: number;
  label: string;
}

/** Non-interactive preview of where a dragged appointment will land. */
export function DragGhost({
  topPercent,
  heightPercent,
  label,
}: DragGhostProps): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        // `color-mix`, not a Tailwind opacity modifier — this codebase's tokens
        // are CSS custom properties, and `bg-primary/10` fails against those.
        backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
      }}
      className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-md border-2 border-dashed border-primary px-2 py-1 text-xs text-primary"
    >
      <span className="block truncate font-medium">{label}</span>
    </div>
  );
}
