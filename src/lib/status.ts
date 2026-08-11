import type { AppointmentStatus } from '@/types';

/**
 * Human labels for appointment status.
 *
 * Kept out of the component file so React Fast Refresh keeps working — a module
 * that exports both a component and a plain function loses its refresh boundary.
 */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_approval: 'Awaiting approval',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  in_service: 'In service',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  rescheduled: 'Rescheduled',
  no_show: 'No show',
};

/**
 * The hue used for the status dot. The label never relies on it: these values
 * do not reach 4.5:1 as small text, so colour supports the word rather than
 * replacing it (docs/DESIGN.md §3, §7).
 */
export const STATUS_DOTS: Record<AppointmentStatus, string> = {
  pending_approval: 'bg-status-pending',
  confirmed: 'bg-status-confirmed',
  checked_in: 'bg-status-confirmed',
  in_service: 'bg-status-in-service',
  completed: 'bg-status-completed',
  cancelled: 'bg-status-cancelled',
  rejected: 'bg-status-cancelled',
  rescheduled: 'bg-status-cancelled',
  no_show: 'bg-status-no-show',
};

/**
 * The status hue as a left-border accent, for surfaces (EventBlock's booked
 * variant) that need a neutral fill with `text-foreground` text rather than a
 * solid colour fill with white text — the latter fails WCAG contrast at small
 * sizes (docs/DESIGN.md §3; see StatusChip's doc comment for the numbers).
 * Kept as its own literal-string record, not derived from `STATUS_DOTS` by
 * string substitution, so every class name Tailwind needs to see stays static
 * in source and survives the production content scan.
 */
export const STATUS_BORDERS: Record<AppointmentStatus, string> = {
  pending_approval: 'border-l-status-pending',
  confirmed: 'border-l-status-confirmed',
  checked_in: 'border-l-status-confirmed',
  in_service: 'border-l-status-in-service',
  completed: 'border-l-status-completed',
  cancelled: 'border-l-status-cancelled',
  rejected: 'border-l-status-cancelled',
  rescheduled: 'border-l-status-cancelled',
  no_show: 'border-l-status-no-show',
};

export function statusLabel(status: AppointmentStatus): string {
  return STATUS_LABELS[status];
}
