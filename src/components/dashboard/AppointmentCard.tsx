import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { Textarea } from '@/components/ui/Field';
import { formatDuration, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/**
 * One booking, as the owner sees it.
 *
 * The actions mirror `set_appointment_status` exactly. Complete is offered from
 * `confirmed` directly rather than only after check-in and start: a one-woman
 * salon marks the day off at the end of it, and forcing three taps per customer
 * to record something that already happened is how a diary stops being kept.
 *
 * No price is shown. What the appointment cost is agreed in the chair and the
 * stored figure is a placeholder, so printing it here would put a number in
 * front of the owner that she cannot rely on.
 */
const NEXT_ACTIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  confirmed: ['completed', 'checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed', 'in_service', 'cancelled'],
  in_service: ['completed', 'cancelled'],
};

const ACTION_LABELS: Record<string, string> = {
  checked_in: 'Check in',
  in_service: 'Start',
  completed: 'Mark complete',
  no_show: 'No show',
  cancelled: 'Cancel',
};

export function AppointmentCard({
  appointment,
  timezone,
  onStatusChange,
  onNoteSave,
  onBookFollowUp,
  onMove,
  onReschedule,
  className,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  onStatusChange?: (id: string, status: AppointmentStatus) => Promise<void>;
  /** Owner's private note. Omit to hide the notes control entirely. */
  onNoteSave?: (id: string, note: string) => Promise<void>;
  /** Opens the booking form with this customer already filled in. */
  onBookFollowUp?: (appointment: AppointmentDetailed) => void;
  /** Opens the Move panel for this appointment. Omit to hide the control. */
  onMove?: (appointment: AppointmentDetailed) => void;
  /** Opens an inline reschedule picker for this appointment. Omit to hide the control. */
  onReschedule?: (appointment: AppointmentDetailed) => void;
  className?: string;
}): JSX.Element {
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(appointment.owner_note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  // Which destructive status change (if any) is awaiting confirmation. Only
  // 'no_show' and 'cancelled' ever populate this — the other statuses in
  // NEXT_ACTIONS run immediately, no confirmation needed.
  const [pendingConfirm, setPendingConfirm] = useState<'no_show' | 'cancelled' | null>(
    null,
  );
  const actions = NEXT_ACTIONS[appointment.status] ?? [];

  // A refresh brings a new row object; the open editor should follow it rather
  // than keep showing what was there before the save.
  useEffect(() => {
    setNote(appointment.owner_note ?? '');
  }, [appointment.owner_note]);

  const run = async (status: AppointmentStatus): Promise<void> => {
    if (!onStatusChange) return;
    setBusy(status);
    try {
      await onStatusChange(appointment.id, status);
    } finally {
      setBusy(null);
    }
  };

  const requestStatusChange = (status: AppointmentStatus): void => {
    if (status === 'no_show' || status === 'cancelled') {
      setPendingConfirm(status);
      return;
    }
    void run(status);
  };

  const saveNote = async (): Promise<void> => {
    if (!onNoteSave) return;
    setSavingNote(true);
    try {
      await onNoteSave(appointment.id, note);
      setNoteOpen(false);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <>
      <article
        className={cn(
          'rounded-xl border border-border bg-card p-4',
          appointment.status === 'completed' && 'border-l-4 border-l-status-completed',
          className,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="shrink-0 sm:w-20">
            <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {formatTime(appointment.starts_at, timezone)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDuration(
                (new Date(appointment.ends_at).getTime() -
                  new Date(appointment.starts_at).getTime()) /
                  60000,
              )}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium text-foreground">
                {appointment.customer_name}
              </p>
              <StatusChip status={appointment.status} />
              {appointment.customer_completed_count === 0 && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  First visit
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              <a
                href={`mailto:${appointment.customer_email}`}
                className="hover:text-foreground hover:underline hover:underline-offset-4"
              >
                {appointment.customer_email}
              </a>
              {appointment.customer_mobile && (
                <>
                  {' · '}
                  <a
                    href={`tel:${appointment.customer_mobile.replace(/\s/g, '')}`}
                    className="hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    {appointment.customer_mobile}
                  </a>
                </>
              )}
              {' · '}
              <span className="font-mono">{appointment.reference}</span>
            </p>
            {appointment.customer_note && (
              <p className="mt-1 text-sm text-muted-foreground">
                &ldquo;{appointment.customer_note}&rdquo;
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {onStatusChange &&
              actions.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={
                    status === 'completed'
                      ? 'primary'
                      : status === 'cancelled' || status === 'no_show'
                        ? 'ghost'
                        : 'secondary'
                  }
                  loading={busy === status}
                  onClick={() => requestStatusChange(status)}
                >
                  {ACTION_LABELS[status]}
                </Button>
              ))}
            {onNoteSave && (
              <Button size="sm" variant="ghost" onClick={() => setNoteOpen((v) => !v)}>
                {appointment.owner_note ? 'Note ✓' : 'Add note'}
              </Button>
            )}
            {onMove &&
              (appointment.status === 'confirmed' ||
                appointment.status === 'pending_approval') && (
                <Button size="sm" variant="ghost" onClick={() => onMove(appointment)}>
                  Move
                </Button>
              )}
            {/* The best moment to book the next one is while this one is still
              in front of her, so the action lives on the booking itself. */}
            {onBookFollowUp && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onBookFollowUp(appointment)}
              >
                Book follow-up
              </Button>
            )}

            {onReschedule &&
              (appointment.status === 'confirmed' ||
                appointment.status === 'pending_approval') && (
                <Button size="sm" variant="ghost" onClick={() => onReschedule(appointment)}>
                  Reschedule
                </Button>
              )}
          </div>
        </div>

        {/* The owner's own record. Never sent to the customer, never shown to
          them: it is what she wants to remember for next time. */}
        {onNoteSave && (noteOpen || appointment.owner_note) && (
          <div className="mt-3 border-t border-border pt-3">
            {noteOpen ? (
              <>
                <Textarea
                  aria-label="Your note about this appointment"
                  rows={3}
                  placeholder="Formula used, how long it actually took, what she wants next time."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={savingNote} onClick={() => void saveNote()}>
                    Save note
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNote(appointment.owner_note ?? '');
                      setNoteOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Only you see this. It is not sent to the customer.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Your note: </span>
                {appointment.owner_note}
              </p>
            )}
          </div>
        )}
      </article>

      <ConfirmDialog
        open={pendingConfirm === 'no_show'}
        title="Mark this customer as a no show?"
        message="This is recorded on their history and cannot be undone from here."
        tone="destructive"
        confirmLabel="Mark as no show"
        onConfirm={() => {
          setPendingConfirm(null);
          void run('no_show');
        }}
        onCancel={() => setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={pendingConfirm === 'cancelled'}
        title="Cancel this appointment?"
        message="The customer will be emailed."
        tone="destructive"
        confirmLabel="Cancel appointment"
        onConfirm={() => {
          setPendingConfirm(null);
          void run('cancelled');
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </>
  );
}
