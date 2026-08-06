import { cn } from '@/lib/utils';
import { STATUS_DOTS, STATUS_LABELS } from '@/lib/status';
import type { AppointmentStatus } from '@/types';

/**
 * Appointment status, as colour *and* text.
 *
 * Two constraints shape this component:
 *
 *  - Colour never carries status alone (docs/DESIGN.md §3). The owner's
 *    calendar is the one screen where a misread is expensive.
 *  - The label is 12px, so it must clear 4.5:1. The status hues do not against
 *    a pale ground — `#d97706` on white is about 3.4:1. So the *dot* carries
 *    the hue and the label stays `text-foreground`, which always passes.
 *
 * No opacity modifiers anywhere: the palette resolves to `var(--token)` hex
 * values, and `bg-status-pending/10` silently produces nothing against those
 * (docs/DESIGN.md §8).
 */
export function StatusChip({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted',
        'px-2.5 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOTS[status])}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
