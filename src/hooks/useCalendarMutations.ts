import { useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import {
  deleteAppointmentAsOwner,
  setAppointmentStatus,
  setOwnerNote,
} from '@/services/appointmentService';
import { logPayment } from '@/services/paymentService';
import { errorMessage } from '@/lib/errors';
import { statusLabel } from '@/lib/status';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

interface UseCalendarMutations {
  changeStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  saveNote: (id: string, note: string) => Promise<void>;
  logPaymentHandler: (
    id: string,
    amountPence: number,
    note: string,
    correctsPaymentId?: string,
  ) => Promise<void>;
  deleteHandler: (id: string) => Promise<void>;
}

/**
 * The write side of the calendar: status changes (with an Undo toast,
 * matching `TodayPage.changeStatus`), owner notes, payments and deletes.
 * Every call reloads the page's data afterwards via `reload`.
 */
export function useCalendarMutations(
  appointments: AppointmentDetailed[],
  reload: () => Promise<void>,
  onDeleted: () => void,
): UseCalendarMutations {
  const { showToast } = useToast();

  const changeStatus = useCallback(
    async (id: string, status: AppointmentStatus): Promise<void> => {
      try {
        const app = appointments.find((a) => a.id === id);
        if (!app) {
          await setAppointmentStatus(id, status);
          await reload();
          return;
        }
        const prevStatus = app.status;

        await setAppointmentStatus(id, status);
        await reload();

        showToast({
          message: `Action applied: ${statusLabel(status)}.`,
          action: {
            label: 'Undo',
            onClick: () => {
              void (async (): Promise<void> => {
                try {
                  await setAppointmentStatus(id, prevStatus);
                  await reload();
                } catch (e) {
                  showToast({ message: errorMessage(e) });
                }
              })();
            },
          },
        });
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [appointments, reload, showToast],
  );

  const saveNote = useCallback(
    async (id: string, note: string): Promise<void> => {
      try {
        await setOwnerNote(id, note);
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [showToast],
  );

  const logPaymentHandler = useCallback(
    async (
      id: string,
      amountPence: number,
      note: string,
      correctsPaymentId?: string,
    ): Promise<void> => {
      try {
        await logPayment(id, amountPence, note, correctsPaymentId);
        await reload();
      } catch (e) {
        showToast({ message: errorMessage(e) });
        throw e;
      }
    },
    [reload, showToast],
  );

  const deleteHandler = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteAppointmentAsOwner(id);
        showToast({ message: 'Appointment deleted.' });
        onDeleted();
        await reload();
      } catch (e) {
        showToast({ message: errorMessage(e) });
      }
    },
    [reload, showToast, onDeleted],
  );

  return { changeStatus, saveNote, logPaymentHandler, deleteHandler };
}
