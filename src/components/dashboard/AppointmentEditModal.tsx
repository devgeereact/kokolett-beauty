import { useEffect, useState } from 'react';
import { AppointmentDetailModal } from '@/components/dashboard/AppointmentDetailModal';
import { MoveAppointmentPanel } from '@/components/dashboard/calendar/MoveAppointmentPanel';
import { Modal } from '@/components/ui/Modal';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/**
 * The one popup for everything editable on an appointment — status actions,
 * notes, payment, and (via "Change time") a reschedule step that swaps in
 * place rather than closing this and opening a second surface. Shared by
 * Calendar and Appointments rather than each keeping its own copy of the
 * same Modal-plus-swap-content wiring.
 */
export function AppointmentEditModal({
  appointment,
  open,
  timezone,
  onClose,
  onStatusChange,
  onNoteSave,
  onLogPayment,
  onBookFollowUp,
  onDelete,
  onMoved,
  initialMoving = false,
}: {
  appointment: AppointmentDetailed | null;
  open: boolean;
  timezone: string;
  onClose: () => void;
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
  onNoteSave: (id: string, note: string) => Promise<void>;
  onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>;
  /** Opens the booking form with this customer already filled in. Omit to hide the control. */
  onBookFollowUp?: (appointment: AppointmentDetailed) => void;
  /** Hard-deletes the appointment (migration 0029). Omit to hide the control entirely. */
  onDelete?: (id: string) => Promise<void>;
  /** Called after a reschedule commits, so the caller can refresh its list. */
  onMoved: () => void;
  /** Open straight into the reschedule step — the rail's own "Reschedule" shortcut. */
  initialMoving?: boolean;
}): JSX.Element {
  const [moving, setMoving] = useState(initialMoving);

  useEffect(() => {
    if (open) setMoving(initialMoving);
  }, [open, initialMoving]);

  return (
    <Modal
      open={open && !!appointment}
      onClose={() => {
        onClose();
        setMoving(false);
      }}
      ariaLabel={moving ? 'Reschedule appointment' : 'Edit appointment'}
      className="max-w-3xl"
    >
      {appointment &&
        (moving ? (
          <MoveAppointmentPanel
            key={appointment.id}
            appointment={appointment}
            timezone={timezone}
            onClose={() => setMoving(false)}
            onMoved={() => {
              setMoving(false);
              onClose();
              onMoved();
            }}
          />
        ) : (
          <AppointmentDetailModal
            appointment={appointment}
            timezone={timezone}
            onClose={onClose}
            onStatusChange={onStatusChange}
            onNoteSave={onNoteSave}
            onLogPayment={onLogPayment}
            onBookFollowUp={onBookFollowUp}
            onDelete={
              onDelete
                ? async (id) => {
                    await onDelete(id);
                    onClose();
                  }
                : undefined
            }
            onMove={() => setMoving(true)}
          />
        ))}
    </Modal>
  );
}
