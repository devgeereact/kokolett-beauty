import type { ReactNode } from 'react';
import { TONE_BG, TONE_TEXT, type Tone } from '@/lib/tone';
import { cn } from '@/lib/utils';

/**
 * A short, tinted label for a fact about a row that isn't its
 * `AppointmentStatus` — that's `StatusPill`/`StatusChip`. e.g. "First-time
 * customer", "Needs approval · 11h 24m remaining".
 */
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONE_BG[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
