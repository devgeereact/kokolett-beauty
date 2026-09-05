import type { JSX } from 'react';
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
 * No opacity modifiers on a status token — but not because they fail to
 * compile. That claim was true of the old hex-valued custom properties and
 * stopped being true when the palette moved to space-separated channels
 * (docs/DESIGN.md §2.1): `bg-status-pending/10` resolves perfectly well now.
 * The reason to avoid it is that a translucent fill composites against
 * whatever surface it lands on, so the same chip is a different colour on a
 * card, on `muted` and on a tinted row. `bg-tint-*` is opaque and therefore
 * predictable, which is what §3.4 means by "tint vs alpha".
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
