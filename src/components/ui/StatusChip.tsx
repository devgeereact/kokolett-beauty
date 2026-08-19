import { cn } from '@/lib/utils';
import { STATUS_DOTS, STATUS_LABELS, statusPillClass } from '@/lib/status';
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
 *
 * `variant="pill"` is the filled treatment the Appointments table uses, where
 * the status is a column of its own and a row of grey dots would be harder to
 * scan than a row of colour. It used to be a separate `StatusPill` component
 * with one consumer, reading the same `STATUS_LABELS` and rendering the same
 * information a second way. Two components for one concept is how a status
 * ends up looking different depending on which screen you are on.
 */
export function StatusChip({
  status,
  variant = 'chip',
  className,
}: {
  status: AppointmentStatus;
  variant?: 'chip' | 'pill';
  className?: string;
}): JSX.Element {
  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
          statusPillClass(status),
          className,
        )}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  }

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
