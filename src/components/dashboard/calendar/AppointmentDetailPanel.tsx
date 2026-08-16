import { Calendar as CalendarIcon, Clock, Hash, Mail, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Avatar } from '@/components/ui/Avatar';
import { formatDateLong, formatDuration, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

/**
 * The calendar's persistent right rail: the currently-selected appointment,
 * one card, always in the same place — replacing the old pattern of an
 * `AppointmentCard` that appeared and disappeared inline below the grid.
 *
 * "Edit appointment" doesn't invent a new editing surface: it asks the page
 * to reveal the real `AppointmentCard` (status actions, note, payment,
 * reschedule, cancel, follow-up) full-width in the main column, reusing
 * every control that already exists rather than duplicating it here — this
 * panel is a summary, not a second copy of the edit surface. It can't render
 * inline in this rail either way — `AppointmentCard`'s `sm:` layout switch
 * is a viewport-width media query, not a container query, so at this rail's
 * ~320px column it would fire full-row layout sized for a much wider box
 * and overlap.
 */
export function AppointmentDetailPanel({
  appointment,
  contextLabel,
  timezone,
  onClose,
  onEdit,
  className,
}: {
  appointment: AppointmentDetailed | null;
  /**
   * Why this appointment is showing when the owner didn't click it herself —
   * "Currently in service" / "Next up" — omitted for a real click-driven
   * selection, where `onClose` is also given so the X has something to do.
   */
  contextLabel?: string;
  timezone: string;
  /** Omit when `appointment` is an automatic default, not a real selection — hides the X. */
  onClose?: () => void;
  /** Opens the full `AppointmentCard` full-width in the main column — status
   * actions, reschedule ("Change time"), cancel, notes, payment, follow-up
   * all live there now, not as separate buttons on this panel. */
  onEdit: (appointment: AppointmentDetailed) => void;
  className?: string;
}): JSX.Element {
  return (
    <Card className={cn('flex flex-col gap-4 p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">
            Appointment details
          </h2>
          {contextLabel && (
            <p className="text-xs font-medium text-primary">{contextLabel}</p>
          )}
        </div>
        {appointment && onClose && (
          <button
            type="button"
            aria-label="Close appointment details"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {!appointment && (
        <p className="text-sm text-muted-foreground">
          Select an appointment on the calendar to see its details here.
        </p>
      )}

      {appointment && (
        <>
          <div className="flex items-start gap-3">
            <Avatar name={appointment.customer_name ?? 'Customer'} size="lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-serif text-base font-semibold leading-snug text-foreground">
                {appointment.customer_name}
              </p>
              <StatusChip status={appointment.status} />
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Clock aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
              {formatTime(appointment.starts_at, timezone)} –{' '}
              {formatTime(appointment.ends_at, timezone)} (
              {formatDuration(
                (new Date(appointment.ends_at).getTime() -
                  new Date(appointment.starts_at).getTime()) /
                  60000,
              )}
              )
            </p>
            <p className="flex items-center gap-2">
              <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
              {formatDateLong(appointment.starts_at, timezone)}
            </p>
            <p className="flex items-center gap-2">
              <Hash aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="font-mono">{appointment.reference}</span>
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Service
            </p>
            <p className="text-sm text-foreground">{appointment.service_name}</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contact
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <a
                href={`mailto:${appointment.customer_email}`}
                className="truncate text-foreground hover:underline hover:underline-offset-4"
              >
                {appointment.customer_email}
              </a>
            </p>
            {appointment.customer_mobile && (
              <p className="mt-1 flex items-center gap-2 text-sm">
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                <a
                  href={`tel:${appointment.customer_mobile.replace(/\s/g, '')}`}
                  className="truncate text-foreground hover:underline hover:underline-offset-4"
                >
                  {appointment.customer_mobile}
                </a>
              </p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </p>
            <p className="text-sm text-foreground">
              {appointment.customer_note ?? appointment.owner_note ?? (
                <span className="text-muted-foreground">No notes yet.</span>
              )}
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <Button size="sm" className="w-full" onClick={() => onEdit(appointment)}>
              Edit appointment
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
