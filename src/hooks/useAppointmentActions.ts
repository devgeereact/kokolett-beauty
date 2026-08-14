import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { errorMessage } from '@/lib/errors';
import { parseMoney } from '@/lib/format';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/**
 * The status actions mirror `set_appointment_status` exactly (migration
 * 0003). Complete is offered from `confirmed` directly rather than only
 * after check-in and start: a one-woman salon marks the day off at the end
 * of it, and forcing three taps per customer to record something that
 * already happened is how a diary stops being kept.
 *
 * `completed` has no outgoing edge here on purpose — migration 0028 (adds
 * completed -> confirmed) is written and validated but not yet applied to
 * the live database (held back pending go-ahead), so an "Unmark complete"
 * button would just error against the current live constraint.
 */
export const NEXT_ACTIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  confirmed: ['completed', 'checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed', 'in_service', 'cancelled'],
  in_service: ['completed', 'cancelled'],
};

export const ACTION_LABELS: Record<string, string> = {
  checked_in: 'Check in',
  in_service: 'Start',
  completed: 'Mark complete',
  no_show: 'No show',
  cancelled: 'Cancel',
};

export interface UseAppointmentActions {
  actions: AppointmentStatus[];
  busy: AppointmentStatus | null;
  requestStatusChange: (status: AppointmentStatus) => void;
  pendingConfirm: 'no_show' | 'cancelled' | null;
  setPendingConfirm: Dispatch<SetStateAction<'no_show' | 'cancelled' | null>>;
  confirmPendingStatus: () => void;
  noteOpen: boolean;
  setNoteOpen: Dispatch<SetStateAction<boolean>>;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  savingNote: boolean;
  deletingNote: boolean;
  saveNote: () => Promise<void>;
  cancelNoteEdit: () => void;
  deleteNote: () => Promise<void>;
  paymentOpen: boolean;
  setPaymentOpen: Dispatch<SetStateAction<boolean>>;
  amountInput: string;
  setAmountInput: Dispatch<SetStateAction<string>>;
  paymentNote: string;
  setPaymentNote: Dispatch<SetStateAction<string>>;
  savingPayment: boolean;
  paymentError: string | null;
  savePayment: () => Promise<void>;
  cancelPaymentEdit: () => void;
}

/**
 * All the stateful plumbing behind one appointment's status/note/payment
 * controls — shared by `AppointmentCard` (the compact row layout) and
 * `AppointmentDetailModal` (the popup's stacked layout), so the two visual
 * arrangements don't carry two copies of the same save/confirm logic.
 */
export function useAppointmentActions({
  appointment,
  onStatusChange,
  onNoteSave,
  onLogPayment,
}: {
  appointment: AppointmentDetailed;
  onStatusChange?: (id: string, status: AppointmentStatus) => Promise<void>;
  onNoteSave?: (id: string, note: string) => Promise<void>;
  onLogPayment?: (id: string, amountPence: number, note: string) => Promise<void>;
}): UseAppointmentActions {
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(appointment.owner_note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // Which destructive status change (if any) is awaiting confirmation. Only
  // 'no_show' and 'cancelled' ever populate this — the other statuses in
  // NEXT_ACTIONS run immediately, no confirmation needed.
  const [pendingConfirm, setPendingConfirm] = useState<'no_show' | 'cancelled' | null>(
    null,
  );
  const actions = NEXT_ACTIONS[appointment.status] ?? [];

  // A refresh brings a new row object; the open editor should follow it
  // rather than keep showing what was there before the save.
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

  const cancelNoteEdit = (): void => {
    setNote(appointment.owner_note ?? '');
    setNoteOpen(false);
  };

  const deleteNote = async (): Promise<void> => {
    if (!onNoteSave) return;
    setDeletingNote(true);
    try {
      await onNoteSave(appointment.id, '');
      setNote('');
      setNoteOpen(false);
    } finally {
      setDeletingNote(false);
    }
  };

  const savePayment = async (): Promise<void> => {
    if (!onLogPayment) return;
    const pence = parseMoney(amountInput);
    if (pence === null) {
      setPaymentError('Enter a valid amount, e.g. 45.00');
      return;
    }
    setPaymentError(null);
    setSavingPayment(true);
    try {
      await onLogPayment(appointment.id, pence, paymentNote);
      setAmountInput('');
      setPaymentNote('');
      setPaymentOpen(false);
    } catch (e) {
      setPaymentError(errorMessage(e));
    } finally {
      setSavingPayment(false);
    }
  };

  const cancelPaymentEdit = (): void => {
    setAmountInput('');
    setPaymentNote('');
    setPaymentError(null);
    setPaymentOpen(false);
  };

  const confirmPendingStatus = (): void => {
    if (!pendingConfirm) return;
    const status = pendingConfirm;
    setPendingConfirm(null);
    void run(status);
  };

  return {
    actions,
    busy,
    requestStatusChange,
    pendingConfirm,
    setPendingConfirm,
    confirmPendingStatus,
    noteOpen,
    setNoteOpen,
    note,
    setNote,
    savingNote,
    deletingNote,
    saveNote,
    cancelNoteEdit,
    deleteNote,
    paymentOpen,
    setPaymentOpen,
    amountInput,
    setAmountInput,
    paymentNote,
    setPaymentNote,
    savingPayment,
    paymentError,
    savePayment,
    cancelPaymentEdit,
  };
}
