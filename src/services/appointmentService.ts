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

export interface ApprovalStats {
  /** Mean minutes between request and decision, over holds decided in the last 7 days. `null` if none were decided. */
  avgWaitMinutes: number | null;
  /** Approved ÷ (approved + declined) over the last 7 days, as a whole percentage. `null` if none were decided. */
  approvedPercent: number | null;
  /** Every hold requested in the last 7 days, decided or not. */
  thisWeekCount: number;
}

/**
 * Historical shape of the approvals queue, for the stat row above it.
 * `approval_deadline is not null` scopes this to holds that actually went
 * through the approval flow — a directly-booked `confirmed` appointment
 * shares the `confirmed` status but never had a deadline.
 */
export async function getApprovalStats(): Promise<ApprovalStats> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('appointments_detailed')
    .select('created_at, approved_at, rejected_at')
    .not('approval_deadline', 'is', null)
    .gte('created_at', since);

  if (error) throw error;
  const rows = data ?? [];

  const waitMinutes: number[] = [];
  let approvedCount = 0;
  let decidedCount = 0;
  for (const row of rows) {
    const decidedAt = row.approved_at ?? row.rejected_at;
    if (!decidedAt || !row.created_at) continue;
    decidedCount += 1;
    if (row.approved_at) approvedCount += 1;
    waitMinutes.push(
      (new Date(decidedAt).getTime() - new Date(row.created_at).getTime()) / 60_000,
    );
  }

  return {
    avgWaitMinutes: waitMinutes.length
      ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length)
      : null,
    approvedPercent: decidedCount
      ? Math.round((approvedCount / decidedCount) * 100)
      : null,
    thisWeekCount: rows.length,
  };
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

/**
 * `appointments_detailed.paid_pence` sums `payments` for the row (migration
 * 0027), so "completed with nothing logged" is just a filter over data
 * already being fetched elsewhere — no new query or view needed.
 */
export function filterUnpaidCompleted(
  rows: AppointmentDetailed[],
): AppointmentDetailed[] {
  return rows.filter((r) => !r.paid_pence);
}

/** Completed appointments in the last `windowDays` with no payment logged against them. */
export async function listUnpaidCompletedAppointments(
  windowDays = 30,
): Promise<AppointmentDetailed[]> {
  const to = new Date();
  const from = new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await listAppointments({ from, to, statuses: ['completed'] });
  return filterUnpaidCompleted(rows);
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
  /** Overrides the appointment type's own length for this booking only. */
  durationMin?: number;
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
    p_duration_min: input.durationMin,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

/**
 * Move a booked appointment to a new time. Retire-and-recreate under the
 * hood (migration 0024) — the returned id and reference belong to the new
 * row, not the one that was there before.
 */
export async function rescheduleAppointmentAsOwner(
  id: string,
  newStartsAt: Date,
): Promise<Pick<BookingResult, 'appointment_id' | 'reference'>> {
  const { data, error } = await supabase.rpc('reschedule_appointment_as_owner', {
    p_appointment_id: id,
    p_new_starts_at: newStartsAt.toISOString(),
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

/**
 * A genuine hard delete (migration 0029) — deliberately narrow. Only
 * cancelled/rejected/no-show rows with no logged payment qualify; the RPC
 * itself refuses anything else (`NOT_DELETABLE`, `HAS_PAYMENT`). This is a
 * housekeeping tool for junk/duplicate entries, not a way to erase a live
 * or completed booking — Cancel is still the tool for that.
 */
export async function deleteAppointmentAsOwner(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_appointment_as_owner', {
    p_appointment_id: id,
  });

  if (error) throw error;
}
