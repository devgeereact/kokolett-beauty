import { formatCountdown } from '@/lib/format';
import { TONE_BG, TONE_TEXT, type Tone } from '@/lib/tone';
import { cn } from '@/lib/utils';

/** A boxed, two-line deadline — "11h 24m" / "remaining" — for a list row where a deadline needs to read at a glance. */
export function CountdownChip({
  deadline,
  tone = 'pending',
  className,
}: {
  deadline: string;
  tone?: Tone;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'w-24 shrink-0 rounded-lg px-2 py-1.5 text-center text-xs font-semibold',
        TONE_BG[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      {formatCountdown(deadline)}
    </div>
  );
}
