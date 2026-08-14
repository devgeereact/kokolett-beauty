import type { AppointmentDetailed } from '@/types';

/**
 * DEMO ONLY — same reasoning as `today/ApprovalsQueueCard.tsx`'s own demo
 * builder. Under the salon's current live settings `approve_first_time` is
 * off, so the real queue this page reads (`listPendingApprovals()`) is
 * structurally empty; this stands in so the screen still shows a real,
 * working approvals view rather than nothing. Every timestamp is computed
 * from `now` at render time, never fixed, so nothing here goes stale.
 */
interface DemoRow {
  id: string;
  customerName: string;
  email: string;
  mobile: string;
  serviceName: string;
  durationMin: number;
  pricePence: number;
  slotHoursFromNow: number;
  deadlineHoursFromNow: number;
  requestedHoursAgo: number;
  note: string;
}

const DEMO_ROWS: DemoRow[] = [
  {
    id: 'demo-approval-1',
    customerName: 'Grace Allen',
    email: 'graceallen@email.com',
    mobile: '07712 345678',
    serviceName: 'Cut & Blow Dry',
    durationMin: 90,
    pricePence: 5800,
    slotHoursFromNow: 28,
    deadlineHoursFromNow: 11.4,
    requestedHoursAgo: 0.7,
    note: 'Looking for a fresh cut and a little volume please.',
  },
  {
    id: 'demo-approval-2',
    customerName: 'Emma Green',
    email: 'emma.green@email.com',
    mobile: '07945 678123',
    serviceName: 'Balayage',
    durationMin: 120,
    pricePence: 14500,
    slotHoursFromNow: 30,
    deadlineHoursFromNow: 14.2,
    requestedHoursAgo: 15.4,
    note: 'Want to go a couple of shades lighter than last time.',
  },
  {
    id: 'demo-approval-3',
    customerName: 'Chloe Smith',
    email: 'chloe.s@email.com',
    mobile: '07766 112233',
    serviceName: 'Hair Treatment',
    durationMin: 45,
    pricePence: 3500,
    slotHoursFromNow: 46,
    deadlineHoursFromNow: 15.6,
    requestedHoursAgo: 16.2,
    note: 'Hair is quite dry at the ends, hoping for something nourishing.',
  },
  {
    id: 'demo-approval-4',
    customerName: 'Olivia Brown',
    email: 'olivia.b@email.com',
    mobile: '07910 998877',
    serviceName: 'Blow Dry',
    durationMin: 45,
    pricePence: 2800,
    slotHoursFromNow: 49,
    deadlineHoursFromNow: 16.8,
    requestedHoursAgo: 18.6,
    note: 'Special occasion on the day, would love a soft curl finish.',
  },
];

const REFERENCE_SUFFIXES = ['7F4CX3', 'D9K2NQ', 'M3R7YV', 'X6P4WK'];

function hoursFromNow(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}

export function buildDemoApprovals(now: Date): AppointmentDetailed[] {
  return DEMO_ROWS.map((row, i) => {
    const startsAt = hoursFromNow(now, row.slotHoursFromNow);
    return {
      id: row.id,
      customer_id: row.id,
      customer_name: row.customerName,
      customer_email: row.email,
      customer_mobile: row.mobile,
      customer_note: row.note,
      customer_completed_count: 0,
      customer_marketing_consent: null,
      service_id: row.id,
      service_name: row.serviceName,
      service_slug: null,
      service_duration_min: row.durationMin,
      service_buffer_min: 0,
      starts_at: startsAt,
      ends_at: hoursFromNow(now, row.slotHoursFromNow + row.durationMin / 60),
      price_pence: row.pricePence,
      paid_pence: null,
      status: 'pending_approval',
      requires_approval: true,
      source: 'online',
      reference: `KB-${REFERENCE_SUFFIXES[i]}`,
      created_at: hoursFromNow(now, -row.requestedHoursAgo),
      updated_at: hoursFromNow(now, -row.requestedHoursAgo),
      approval_deadline: hoursFromNow(now, row.deadlineHoursFromNow),
      approved_at: null,
      approved_by: null,
      rejected_at: null,
      rejection_reason: null,
      cancelled_at: null,
      cancellation_reason: null,
      checked_in_at: null,
      completed_at: null,
      owner_note: null,
      rescheduled_from: null,
      review_requested_at: null,
    } satisfies AppointmentDetailed;
  });
}

/** Matches the stat row's shape from `getApprovalStats()`, for the same reason as `buildDemoApprovals`. */
export function buildDemoApprovalStats(): {
  avgWaitMinutes: number;
  approvedPercent: number;
  thisWeekCount: number;
} {
  return { avgWaitMinutes: 12 * 60 + 34, approvedPercent: 96, thisWeekCount: DEMO_ROWS.length };
}
