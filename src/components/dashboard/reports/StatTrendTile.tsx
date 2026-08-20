import type { JSX } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { Tone } from '@/lib/tone';
import { TONE_BG, TONE_TEXT } from '@/lib/tone';
import { cn } from '@/lib/utils';

/** `null` when the previous period had nothing to compare against — shown as "—", never a fake 0%. */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function StatTrendTile({
  icon: Icon,
  tone,
  label,
  value,
  current,
  previous,
  previousLabel,
  /** Lower is better (e.g. no-show rate) — flips the up/down colour semantics. */
  invert = false,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string;
  current: number;
  previous: number;
  previousLabel: string;
  invert?: boolean;
}): JSX.Element {
  const change = percentChange(current, previous);
  const positive = change !== null && (invert ? change < 0 : change > 0);
  const negative = change !== null && (invert ? change > 0 : change < 0);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</p>
        <span
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            TONE_BG[tone],
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn('h-4 w-4', TONE_TEXT[tone])}
            strokeWidth={2}
          />
        </span>
      </div>
      <p className="mb-1 font-serif text-2xl font-semibold text-foreground">{value}</p>
      <p className="flex items-center gap-1 text-xs">
        {change !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              positive && 'text-status-completed',
              negative && 'text-status-no-show',
              !positive && !negative && 'text-muted-foreground',
            )}
          >
            {change > 0 && (
              <ArrowUp aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
            )}
            {change < 0 && (
              <ArrowDown aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
            )}
            {Math.abs(change)}%
          </span>
        )}
        <span className="text-muted-foreground">vs {previousLabel}</span>
      </p>
    </Card>
  );
}
