import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Hash, Mail, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input, Textarea } from '@/components/ui/Field';
import { ACTION_LABELS, useAppointmentActions } from '@/hooks/useAppointmentActions';
import { formatDateLong, formatDuration, formatMoney, formatTime } from '@/lib/format';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/** Statuses that already mean "this is over" — deleting one of these is
 * pure housekeeping. Anything else is still deletable, just with a
 * stronger warning below (see `deleteWarning`). */
const ALREADY_CLOSED = new Set(['cancelled', 'rejected', 'no_show']);

/**
 * The Appointments / Calendar popup's full editor — a stacked, spacious
 * layout built for a modal rather than an inline row, but sharing every
 * stateful control with `AppointmentCard` via `useAppointmentActions` so the
 * two layouts don't carry two copies of the same save/confirm logic.
 */
export function AppointmentDetailModal({
  appointment,
  timezone,
  onClose,
  onStatusChange,
  onNoteSave,
  onLogPayment,
  onBookFollowUp,
  onMove,
  onDelete,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  onClose: () => void;
  onStatusChange?: (id: string, status: AppointmentStatus) => Promise<void>;
  onNoteSave?: (id: string, note: string) => Promise<void>;
  onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>;
  onBookFollowUp?: (appointment: AppointmentDetailed) => void;
  /** Opens the reschedule step in place. Omit to hide "Change time". */
  onMove?: (appointment: AppointmentDetailed) => void;
  /** Omit to hide "Delete appointment" entirely. */
  onDelete?: (id: string) => Promise<void>;
}): JSX.Element {
  const a = useAppointmentActions({
    appointment,
    onStatusChange,
    onNoteSave,
    onLogPayment,
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteWarning = ALREADY_CLOSED.has(appointment.status)
    ? 'This removes it entirely — not the same as cancelling. There is no undo.'
    : `This appointment is still ${appointment.status.replace('_', ' ')} — deleting it removes the record entirely and, unlike Cancel, does not notify the customer. There is no undo.`;

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={appointment.customer_name ?? 'Customer'} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-serif text-lg font-semibold text-foreground">
                {appointment.customer_name}
              </p>
              <StatusChip status={appointment.status} />
              {appointment.customer_completed_count === 0 && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  First visit
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3">
        <div className="space-y-1.5 text-sm text-foreground">
          <p className="flex items-center gap-2">
            <Clock
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            {formatTime(appointment.starts_at, timezone)} –{' '}
            {formatTime(appointment.ends_at, timezone)}{' '}
            <span className="text-muted-foreground">
              (
              {formatDuration(
                (new Date(appointment.ends_at).getTime() -
                  new Date(appointment.starts_at).getTime()) /
                  60000,
              )}
              )
            </span>
          </p>
          <p className="flex items-center gap-2">
            <CalendarIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            {formatDateLong(appointment.starts_at, timezone)}
          </p>
          <p className="flex items-center gap-2">
            <Hash
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <span className="font-mono text-muted-foreground">
              {appointment.reference}
            </span>
          </p>
        </div>
        {onMove &&
          (appointment.status === 'confirmed' ||
            appointment.status === 'pending_approval') && (
            <Button size="sm" variant="secondary" onClick={() => onMove(appointment)}>
              Change time
            </Button>
          )}
      </div>

      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Service
          </p>
          <p className="text-sm text-foreground">{appointment.service_name}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact
          </p>
          <p className="flex items-center gap-2 text-sm">
            <Mail
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <a
              href={`mailto:${appointment.customer_email}`}
              className="truncate text-foreground hover:underline hover:underline-offset-4"
            >
              {appointment.customer_email}
            </a>
          </p>
          {appointment.customer_mobile && (
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Phone
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              <a
                href={`tel:${appointment.customer_mobile.replace(/\s/g, '')}`}
                className="truncate text-foreground hover:underline hover:underline-offset-4"
              >
                {appointment.customer_mobile}
              </a>
            </p>
          )}
        </div>
      </div>

      {appointment.customer_note && (
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          &ldquo;{appointment.customer_note}&rdquo;
        </p>
      )}

      {/* Owner's own record — never sent to the customer. */}
      {onNoteSave && (
        <div className="border-t border-border pt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
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
                <Button
                  size="sm"
                  loading={a.savingNote}
                  onClick={() => void a.saveNote()}
                >
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
          ) : appointment.owner_note ? (
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-foreground">{appointment.owner_note}</p>
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
          ) : (
            <Button size="sm" variant="ghost" onClick={() => a.setNoteOpen(true)}>
              Add note
            </Button>
          )}
        </div>
      )}

      {/* What the customer actually paid. */}
      {onLogPayment && (
        <div className="border-t border-border pt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payment
          </p>
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
          ) : (appointment.paid_pence ?? 0) > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                Paid {formatMoney(appointment.paid_pence ?? 0)}
              </p>
              <Button size="sm" variant="ghost" onClick={() => a.setPaymentOpen(true)}>
                Log another
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => a.setPaymentOpen(true)}>
              Log payment
            </Button>
          )}
        </div>
      )}

      {/* nowrap + overflow-x-auto, not flex-wrap: up to five buttons here
          (four status actions plus Book follow-up) — wrapping put a lone
          button stranded on its own row depending on exactly how many were
          showing. One line always, scrolling sideways on a narrow viewport
          instead of reflowing unpredictably. */}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-t border-border pt-4">
        {onStatusChange &&
          a.actions.map((status) => (
            <Button
              key={status}
              size="sm"
              className="shrink-0"
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
        {onBookFollowUp && (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => onBookFollowUp(appointment)}
          >
            Book follow-up
          </Button>
        )}
      </div>

      {onDelete && (
        <div className="border-t border-border pt-4">
          <Button
            size="sm"
            variant="ghost"
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            loading={deleting}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete appointment
          </Button>
        </div>
      )}

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
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this appointment?"
        message={deleteWarning}
        tone="destructive"
        confirmLabel="Delete appointment"
        onConfirm={() => {
          setConfirmingDelete(false);
          if (!onDelete) return;
          setDeleting(true);
          void onDelete(appointment.id).finally(() => setDeleting(false));
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Card>
  );
}
