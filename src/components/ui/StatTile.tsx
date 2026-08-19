import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TONE_BG, TONE_TEXT, type Tone } from '@/lib/tone';
import { cn } from '@/lib/utils';

/** A dashboard headline number, one glance: tinted icon square, value, label. */
export function StatTile({
  icon: Icon,
  value,
  label,
  tone = 'neutral',
  className,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: Tone;
  className?: string;
}): JSX.Element {
  return (
    <Card className={cn('flex items-center gap-3 p-4', className)}>
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          TONE_BG[tone],
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn('h-5 w-5', TONE_TEXT[tone])}
          strokeWidth={2}
        />
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-xl font-semibold text-foreground">
          {value}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </Card>
  );
}
