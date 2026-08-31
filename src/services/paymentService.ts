import { supabase } from '@/lib/supabase';
import type { Payment } from '@/types';

/**
 * What the owner actually charged, logged after the fact — there is no
 * fixed price to bill against. Append-only: this always adds a new row,
 * there is no update/delete. `appointments_detailed.paid_pence` sums
 * every row for a booking, so logging a correction is a second call, not
 * an edit of the first.
 *
 * `correctsPaymentId` (migration 0059) links a correction back to the
 * payment it adjusts and is the only way `amount_pence` may be negative —
 * a plain payment (no link) must still be positive, enforced server-side
 * by `log_payment()`.
 */
export async function logPayment(
  appointmentId: string,
  amountPence: number,
  note: string,
  correctsPaymentId?: string,
): Promise<void> {
  const { error } = await supabase.rpc('log_payment', {
    p_appointment_id: appointmentId,
    p_amount_pence: amountPence,
    p_note: note.trim() || undefined,
    p_corrects_payment_id: correctsPaymentId,
  });

  if (error) throw error;
}

/** Every payment row logged against one appointment, oldest first. */
export async function listPayments(appointmentId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
