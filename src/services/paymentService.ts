import { supabase } from '@/lib/supabase';

/**
 * What the owner actually charged, logged after the fact — there is no
 * fixed price to bill against. Append-only: this always adds a new row,
 * there is no update/delete. `appointments_detailed.paid_pence` sums
 * every row for a booking, so logging a correction is a second call, not
 * an edit of the first.
 */
export async function logPayment(
  appointmentId: string,
  amountPence: number,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('log_payment', {
    p_appointment_id: appointmentId,
    p_amount_pence: amountPence,
    p_note: note.trim() || undefined,
  });

  if (error) throw error;
}
