import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input, Textarea } from '@/components/ui/Field';
import { ACTION_LABELS, useAppointmentActions } from '@/hooks/useAppointmentActions';
import { formatDuration, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/**
 * One booking, as the owner sees it — the compact row layout used inline
 * (Today page, Appointments list). The stateful logic behind every control
 * here lives in `useAppointmentActions`, shared with `AppointmentDetailModal`
 * (the popup's stacked layout) so the two arrangements don't duplicate the
 * same save/confirm plumbing.
 *
 * The quoted price is never shown. What the appointment cost is agreed in the
 * chair and `price_pence` is a placeholder, so printing it here would put a
 * number in front of the owner that she cannot rely on. What she actually
 * logged as paid is different: it is her own attestation, not a placeholder,
 * so that figure — and only that one — is printed.
 */
export function AppointmentCard({
  appointment,
  timezone,
  onStatusChange,
  onNoteSave,
  onLogPayment,
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
  /** What the customer actually paid. Omit to hide the payment control entirely. */
  onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>;
  /** Opens the booking form with this customer already filled in. */
  onBookFollowUp?: (appointment: AppointmentDetailed) => void;
  /** Opens the Move panel for this appointment. Omit to hide the control. */
  onMove?: (appointment: AppointmentDetailed) => void;
  /** Opens an inline reschedule picker for this appointment. Omit to hide the control. */
  onReschedule?: (appointment: AppointmentDetailed) => void;
  className?: string;
}): JSX.Element {
  const a = useAppointmentActions({ appointment, onStatusChange, onNoteSave, onLogPayment });

  return (
    <>
      <article
        className={cn(
          'rounded-md border border-border bg-card p-4',
          appointment.status === 'completed' && 'border-l-4 border-l-status-completed',
          className,
        )}
      >
        {/* Actions get their own full-width row rather than sharing one with
            the customer info — up to six buttons competing with a flex-1
            name/email column for space squeezed that column down to a sliver
            and truncated it hard, worst in the wider Edit-appointment popup
            where there was no `sm:` stacking to fall back on. */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="shrink-0 md:w-20">
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
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {onStatusChange &&
            a.actions.map((status) => (
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
                loading={a.busy === status}
                onClick={() => a.requestStatusChange(status)}
              >
                {ACTION_LABELS[status]}
              </Button>
            ))}
          {onNoteSave && (
            <Button size="sm" variant="ghost" onClick={() => a.setNoteOpen((v) => !v)}>
              {appointment.owner_note ? 'Note ✓' : 'Add note'}
            </Button>
          )}
          {onLogPayment && (
            <Button size="sm" variant="ghost" onClick={() => a.setPaymentOpen((v) => !v)}>
              {(appointment.paid_pence ?? 0) > 0
                ? `Paid ${formatMoney(appointment.paid_pence ?? 0)}`
                : 'Log payment'}
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
            <Button size="sm" variant="ghost" onClick={() => onBookFollowUp(appointment)}>
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

        {/* The owner's own record. Never sent to the customer, never shown to
          them: it is what she wants to remember for next time. */}
        {onNoteSave && (a.noteOpen || appointment.owner_note) && (
          <div className="mt-3 border-t border-border pt-3">
            {a.noteOpen ? (
              <>
                <Textarea
                  aria-label="Your note about this appointment"
                  rows={3}
                  placeholder="Formula used, how long it actually took, what she wants next time."
                  value={a.note}
                  onChange={(e) => a.setNote(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" loading={a.savingNote} onClick={() => void a.saveNote()}>
                    Save note
                  </Button>
                  <Button size="sm" variant="ghost" onClick={a.cancelNoteEdit}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Only you see this. It is not sent to the customer.
                </p>
              </>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Your note: </span>
                  {appointment.owner_note}
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => a.setNoteOpen(true)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={a.deletingNote}
                    onClick={() => void a.deleteNote()}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {onLogPayment && (a.paymentOpen || (appointment.paid_pence ?? 0) > 0) && (
          <div className="mt-3 border-t border-border pt-3">
            {a.paymentOpen ? (
              <>
                <Input
                  aria-label="Amount paid"
                  inputMode="decimal"
                  placeholder="£0.00"
                  value={a.amountInput}
                  onChange={(e) => a.setAmountInput(e.target.value)}
                />
                <Textarea
                  aria-label="Payment note"
                  rows={2}
                  placeholder="Cash, gave 10% off, etc. (optional)"
                  value={a.paymentNote}
                  onChange={(e) => a.setPaymentNote(e.target.value)}
                  className="mt-2"
                />
                {a.paymentError && (
                  <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                    {a.paymentError}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    loading={a.savingPayment}
                    onClick={() => void a.savePayment()}
                  >
                    Save payment
                  </Button>
                  <Button size="sm" variant="ghost" onClick={a.cancelPaymentEdit}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  What she agreed in the chair, not a quoted price.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Paid: </span>
                {formatMoney(appointment.paid_pence ?? 0)}
              </p>
            )}
          </div>
        )}
      </article>

      <ConfirmDialog
        open={a.pendingConfirm === 'no_show'}
        title="Mark this customer as a no show?"
        message="This is recorded on their history and cannot be undone from here."
        tone="destructive"
        confirmLabel="Mark as no show"
        onConfirm={a.confirmPendingStatus}
        onCancel={() => a.setPendingConfirm(null)}
      />
      <ConfirmDialog
        open={a.pendingConfirm === 'cancelled'}
        title="Cancel this appointment?"
        message="The customer will be emailed."
        tone="destructive"
        confirmLabel="Cancel appointment"
        onConfirm={a.confirmPendingStatus}
        onCancel={() => a.setPendingConfirm(null)}
      />
    </>
  );
}
