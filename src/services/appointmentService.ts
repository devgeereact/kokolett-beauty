import { supabase } from '@/lib/supabase';
import { LIVE_STATUSES } from '@/types';
import type {
  Appointment,
  AppointmentDetailed,
  AppointmentStatus,
  BookingResult,
} from '@/types';

/**
 * Owner-side appointment access.
 *
 * Reads go through the `appointments_detailed` view so every row arrives with
 * the customer and service already attached. Writes go through the RPCs in
 * migration 0003 rather than direct updates: each transition has to set several
 * columns together, and a status change with no matching timestamp is a row
 * nothing downstream can trust.
 */

export interface AppointmentQuery {
  from: Date;
  to: Date;
  statuses?: AppointmentStatus[];
}

export async function listAppointments(
  query: AppointmentQuery,
): Promise<AppointmentDetailed[]> {
  let request = supabase
    .from('appointments_detailed')
    .select('*')
    .gte('starts_at', query.from.toISOString())
    .lt('starts_at', query.to.toISOString())
    .order('starts_at', { ascending: true });

  if (query.statuses?.length) {
    request = request.in('status', query.statuses);
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as AppointmentDetailed[];
}

/**
 * The approvals queue. Not date-bounded: a hold placed for a date three months
 * out still needs answering today, so bounding this by "this week" would hide
 * exactly the bookings the owner is on the hook for.
 */
export async function listPendingApprovals(): Promise<AppointmentDetailed[]> {
  const { data, error } = await supabase
    .from('appointments_detailed')
    .select('*')
    .eq('status', 'pending_approval')
    .order('approval_deadline', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as AppointmentDetailed[];
}

/** Everything live on one salon-local day, for the "today" view. */
export async function listForDay(
  dayStart: Date,
  dayEnd: Date,
): Promise<AppointmentDetailed[]> {
  return listAppointments({
    from: dayStart,
    to: dayEnd,
    statuses: [...LIVE_STATUSES],
  });
}

export async function listForCustomer(
  customerId: string,
): Promise<AppointmentDetailed[]> {
  const { data, error } = await supabase
    .from('appointments_detailed')
    .select('*')
    .eq('customer_id', customerId)
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AppointmentDetailed[];
}

export async function approveAppointment(id: string): Promise<Appointment> {
  const { data, error } = await supabase.rpc('approve_appointment', {
    p_appointment_id: id,
  });

  if (error) throw error;
  return data;
}

export async function rejectAppointment(
  id: string,
  reason?: string,
): Promise<Appointment> {
  const { data, error } = await supabase.rpc('reject_appointment', {
    p_appointment_id: id,
    p_reason: reason,
  });

  if (error) throw error;
  return data;
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  reason?: string,
): Promise<Appointment> {
  const { data, error } = await supabase.rpc('set_appointment_status', {
    p_appointment_id: id,
    p_status: status,
    p_reason: reason,
  });

  if (error) throw error;
  return data;
}

export interface OwnerBookingInput {
  startsAt: Date;
  fullName: string;
  email: string;
  mobile?: string;
  note?: string;
}

/** Phone and walk-in bookings. Skips the trust gate, never the overlap constraint. */
export async function createAppointmentAsOwner(
  input: OwnerBookingInput,
): Promise<Pick<BookingResult, 'appointment_id' | 'reference'>> {
  const { data, error } = await supabase.rpc('create_appointment_as_owner', {
    p_starts_at: input.startsAt.toISOString(),
    p_full_name: input.fullName,
    p_email: input.email,
    p_mobile: input.mobile,
    p_note: input.note,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

/** Owner's private note on a booking. The one field safe to write directly. */
export async function setOwnerNote(id: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ owner_note: note.trim() || null })
    .eq('id', id);

  if (error) throw error;
}
