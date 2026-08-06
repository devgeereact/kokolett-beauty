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

export function statusLabel(status: AppointmentStatus): string {
  return STATUS_LABELS[status];
}
