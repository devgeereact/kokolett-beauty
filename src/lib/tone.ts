/**
 * The pale-tint-background / saturated-text pairing used for anything that
 * needs to read as "coloured, but still a small UI element" — badges, stat
 * tile icons, countdown chips. One map, so a new tone (or a token rename)
 * only has to change here rather than in every component that uses one.
 *
 * Not the same job as `STATUS_PILL_BG`/`STATUS_DOTS` in `lib/status.ts`,
 * which are keyed by the literal `AppointmentStatus` enum. `Tone` is for
 * anything else that wants the same visual language — a fact about a row
 * ("First-time customer"), a headline number, a deadline — without being an
 * appointment status itself.
 */
export type Tone =
  | 'pending'
  | 'confirmed'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'primary'
  | 'neutral'
  | 'urgent';

export const TONE_BG: Record<Tone, string> = {
  pending: 'bg-tint-pending',
  confirmed: 'bg-tint-confirmed',
  in_service: 'bg-tint-in-service',
  completed: 'bg-tint-completed',
  cancelled: 'bg-tint-cancelled',
  primary: 'bg-tint-primary',
  neutral: 'bg-muted',
  // Same red used for a no-show appointment — the highest-severity status
  // colour already in the system, reused here for "high priority" rather
  // than inventing a second red.
  urgent: 'bg-tint-no-show',
};

export const TONE_TEXT: Record<Tone, string> = {
  pending: 'text-status-pending',
  confirmed: 'text-status-confirmed',
  in_service: 'text-status-in-service',
  completed: 'text-status-completed',
  cancelled: 'text-status-cancelled',
  primary: 'text-primary',
  neutral: 'text-muted-foreground',
  urgent: 'text-status-no-show',
};
