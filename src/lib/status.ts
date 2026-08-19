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

/**
 * Filled status pill classes — pale `--tint-*` background, full-saturation
 * text (docs/design/appointment.png's table). Different direction from
 * `STATUS_DOTS`'s neutral-surface-plus-dot (a solid status colour behind
 * *white* text is what fails contrast; a status colour used as small text on
 * its own near-white tint clears 4.5:1 easily, so the label itself can carry
 * the hue here without repeating that mistake).
 */
const STATUS_PILL_BG: Record<AppointmentStatus, string> = {
  pending_approval: 'bg-tint-pending',
  confirmed: 'bg-tint-confirmed',
  checked_in: 'bg-tint-confirmed',
  in_service: 'bg-tint-in-service',
  completed: 'bg-tint-completed',
  cancelled: 'bg-tint-cancelled',
  rejected: 'bg-tint-cancelled',
  rescheduled: 'bg-tint-cancelled',
  no_show: 'bg-tint-no-show',
};

const STATUS_PILL_TEXT: Record<AppointmentStatus, string> = {
  pending_approval: 'text-status-pending',
  confirmed: 'text-status-confirmed',
  checked_in: 'text-status-confirmed',
  in_service: 'text-status-in-service',
  completed: 'text-status-completed',
  cancelled: 'text-status-cancelled',
  rejected: 'text-status-cancelled',
  rescheduled: 'text-status-cancelled',
  no_show: 'text-status-no-show',
};

export function statusPillClass(status: AppointmentStatus): string {
  return `${STATUS_PILL_BG[status]} ${STATUS_PILL_TEXT[status]}`;
}

/**
 * The 6 status families the calendar's legend and status filter group by —
 * coarser than `AppointmentStatus` itself, e.g. `checked_in` reads as
 * "Confirmed" and `rejected`/`rescheduled` read as "Cancelled/Rejected".
 * Matches the legend on `docs/design/calendar.png`.
 */
export type StatusCategory =
  'pending_approval' | 'confirmed' | 'in_service' | 'completed' | 'cancelled' | 'no_show';

export const STATUS_CATEGORY: Record<AppointmentStatus, StatusCategory> = {
  pending_approval: 'pending_approval',
  confirmed: 'confirmed',
  checked_in: 'confirmed',
  in_service: 'in_service',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled',
  rescheduled: 'cancelled',
  no_show: 'no_show',
};

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  pending_approval: 'Pending approval',
  confirmed: 'Confirmed',
  in_service: 'In service',
  completed: 'Completed',
  cancelled: 'Cancelled / Rejected',
  no_show: 'No-show',
};

/** One representative status per category, for looking up a dot colour. */
export const STATUS_CATEGORY_DOT: Record<StatusCategory, AppointmentStatus> = {
  pending_approval: 'pending_approval',
  confirmed: 'confirmed',
  in_service: 'in_service',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
};

export const STATUS_CATEGORIES: StatusCategory[] = [
  'pending_approval',
  'confirmed',
  'in_service',
  'completed',
  'cancelled',
  'no_show',
];
