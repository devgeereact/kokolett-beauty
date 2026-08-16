import { describe, expect, it } from 'vitest';
import {
  analyzeDayOfWeekTrend,
  analyzeHourOfDayTrend,
  analyzeWeekBookings,
  buildAppointmentActivity,
  findNextUp,
  findScheduleConflicts,
  percentChange,
  rankRepeatCustomers,
  summarizeBusiness,
} from '@/lib/insights';
import type { AppointmentDetailed, Customer } from '@/types';

function appt(overrides: Partial<AppointmentDetailed>): AppointmentDetailed {
  return {
    id: 'a1',
    customer_id: 'c1',
    starts_at: '2026-08-11T09:00:00.000Z',
    ends_at: '2026-08-11T10:00:00.000Z',
    created_at: '2026-08-01T09:00:00.000Z',
    status: 'confirmed',
    source: 'web',
    customer_completed_count: 1,
    ...overrides,
  } as AppointmentDetailed;
}

function customer(overrides: Partial<Customer>): Customer {
  return {
    id: 'c1',
    full_name: 'Koko Beauty',
    email: 'koko@example.com',
    mobile: null,
    ...overrides,
  } as Customer;
}

describe('findScheduleConflicts', () => {
  it('flags two appointments whose times overlap', () => {
    const a = appt({
      id: 'a',
      starts_at: '2026-08-11T09:00:00.000Z',
      ends_at: '2026-08-11T10:00:00.000Z',
    });
    const b = appt({
      id: 'b',
      starts_at: '2026-08-11T09:30:00.000Z',
      ends_at: '2026-08-11T10:30:00.000Z',
    });
    const conflicts = findScheduleConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.a.id).toBe('a');
    expect(conflicts[0]!.b.id).toBe('b');
  });

  it('does not flag back-to-back appointments that only touch', () => {
    const a = appt({
      id: 'a',
      starts_at: '2026-08-11T09:00:00.000Z',
      ends_at: '2026-08-11T10:00:00.000Z',
    });
    const b = appt({
      id: 'b',
      starts_at: '2026-08-11T10:00:00.000Z',
      ends_at: '2026-08-11T11:00:00.000Z',
    });
    expect(findScheduleConflicts([a, b])).toHaveLength(0);
  });

  it('does not flag appointments on different days', () => {
    const a = appt({
      id: 'a',
      starts_at: '2026-08-11T09:00:00.000Z',
      ends_at: '2026-08-11T10:00:00.000Z',
    });
    const b = appt({
      id: 'b',
      starts_at: '2026-08-12T09:00:00.000Z',
      ends_at: '2026-08-12T10:00:00.000Z',
    });
    expect(findScheduleConflicts([a, b])).toHaveLength(0);
  });
});

describe('summarizeBusiness', () => {
  it('computes rates over the window and the month count separately', () => {
    const window = [
      appt({ status: 'completed', customer_completed_count: 2 }),
      appt({ status: 'no_show', customer_completed_count: 0 }),
      appt({ status: 'cancelled', customer_completed_count: 0 }),
      appt({ status: 'confirmed', customer_completed_count: 3 }),
    ];
    const month = [window[0]!, window[3]!];

    const summary = summarizeBusiness(window, month);
    expect(summary.bookingsThisMonth).toBe(2);
    expect(summary.totalInWindow).toBe(4);
    expect(summary.returningRate).toBe(0.5); // 2 of 4 have a prior completed visit
    expect(summary.noShowRate).toBe(0.25);
    expect(summary.cancellationRate).toBe(0.25);
  });

  it('returns zero rates instead of dividing by zero on an empty window', () => {
    const summary = summarizeBusiness([], []);
    expect(summary).toEqual({
      bookingsThisMonth: 0,
      totalInWindow: 0,
      returningRate: 0,
      noShowRate: 0,
      cancellationRate: 0,
    });
  });
});

describe('analyzeDayOfWeekTrend', () => {
  it('groups by salon-local day of week and flags closed template days', () => {
    // 2026-08-11 is a Tuesday (dow 2); 2026-08-16 is a Sunday (dow 0).
    const appointments = [
      appt({ starts_at: '2026-08-11T09:00:00.000Z' }),
      appt({ starts_at: '2026-08-11T11:00:00.000Z' }),
      appt({ starts_at: '2026-08-16T09:00:00.000Z' }),
    ];
    const template = [
      { day_of_week: 0, times: [] }, // Sunday: closed
      { day_of_week: 2, times: ['09:00'] }, // Tuesday: open
    ];

    const trend = analyzeDayOfWeekTrend(appointments, template, 'UTC');
    expect(trend[0]!).toEqual({ dayOfWeek: 0, count: 1, templateOpen: false });
    expect(trend[2]!).toEqual({ dayOfWeek: 2, count: 2, templateOpen: true });
    expect(trend[1]!).toEqual({ dayOfWeek: 1, count: 0, templateOpen: false });
  });
});

describe('analyzeWeekBookings', () => {
  it('splits each day into new vs returning by prior completed visits', () => {
    // 2026-08-11 is a Tuesday (dow 2).
    const appointments = [
      appt({ starts_at: '2026-08-11T09:00:00.000Z', customer_completed_count: 0 }),
      appt({ starts_at: '2026-08-11T11:00:00.000Z', customer_completed_count: 2 }),
      appt({ starts_at: '2026-08-11T14:00:00.000Z', customer_completed_count: 1 }),
    ];

    const week = analyzeWeekBookings(appointments, 'UTC');
    expect(week[2]).toEqual({ dayOfWeek: 2, newCount: 1, returningCount: 2 });
    expect(week[0]).toEqual({ dayOfWeek: 0, newCount: 0, returningCount: 0 });
  });

  it('drops rescheduled and rejected rows, same as analyzeDayOfWeekTrend', () => {
    const appointments = [
      appt({ starts_at: '2026-08-11T09:00:00.000Z', status: 'rescheduled' }),
      appt({ starts_at: '2026-08-11T09:00:00.000Z', status: 'rejected' }),
    ];
    const week = analyzeWeekBookings(appointments, 'UTC');
    expect(week[2]).toEqual({ dayOfWeek: 2, newCount: 0, returningCount: 0 });
  });
});

describe('findNextUp', () => {
  const now = new Date('2026-08-11T10:00:00.000Z');

  it('picks the soonest confirmed or checked-in appointment that has not started', () => {
    const past = appt({ id: 'past', status: 'confirmed', starts_at: '2026-08-11T09:00:00.000Z' });
    const soonest = appt({
      id: 'soonest',
      status: 'confirmed',
      starts_at: '2026-08-11T11:00:00.000Z',
    });
    const later = appt({
      id: 'later',
      status: 'checked_in',
      starts_at: '2026-08-11T14:00:00.000Z',
    });
    expect(findNextUp([past, later, soonest], now)?.id).toBe('soonest');
  });

  it('ignores in-progress and completed appointments', () => {
    const inService = appt({ id: 'in-service', status: 'in_service', starts_at: '2026-08-11T09:30:00.000Z' });
    const completed = appt({ id: 'done', status: 'completed', starts_at: '2026-08-11T09:00:00.000Z' });
    expect(findNextUp([inService, completed], now)).toBeNull();
  });

  it('returns null when nothing is left today', () => {
    expect(findNextUp([], now)).toBeNull();
  });
});

describe('percentChange', () => {
  it('computes a relative percentage change', () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(88, 100)).toBe(-12);
  });

  it('returns null instead of Infinity when there is nothing to compare against', () => {
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe('analyzeHourOfDayTrend', () => {
  it('groups by salon-local start hour', () => {
    const appointments = [
      appt({ starts_at: '2026-08-11T09:15:00.000Z' }),
      appt({ starts_at: '2026-08-11T09:45:00.000Z' }),
      appt({ starts_at: '2026-08-11T14:00:00.000Z' }),
    ];
    const trend = analyzeHourOfDayTrend(appointments, 'UTC');
    expect(trend).toHaveLength(24);
    expect(trend[9]!).toEqual({ hour: 9, count: 2 });
    expect(trend[14]!).toEqual({ hour: 14, count: 1 });
    expect(trend[10]!).toEqual({ hour: 10, count: 0 });
  });
});

describe('rankRepeatCustomers', () => {
  it('ranks customers by completed visits and drops customers with none', () => {
    const alice = customer({ id: 'alice' });
    const bob = customer({ id: 'bob' });
    const carol = customer({ id: 'carol' });

    const completed = [
      appt({ customer_id: 'alice', starts_at: '2026-01-01T09:00:00.000Z' }),
      appt({ customer_id: 'alice', starts_at: '2026-03-01T09:00:00.000Z' }),
      appt({ customer_id: 'bob', starts_at: '2026-02-01T09:00:00.000Z' }),
    ];

    const ranked = rankRepeatCustomers([alice, bob, carol], completed);
    expect(ranked.map((r) => r.customer.id)).toEqual(['alice', 'bob']);
    expect(ranked[0]!.completedCount).toBe(2);
    expect(ranked[0]!.lastVisitAt).toBe('2026-03-01T09:00:00.000Z');
  });
});

describe('buildAppointmentActivity', () => {
  it('emits a created event using the source label', () => {
    const events = buildAppointmentActivity([
      appt({ id: 'web', source: 'web', created_at: '2026-08-01T09:00:00.000Z' }),
      appt({ id: 'owner', source: 'owner', created_at: '2026-08-02T09:00:00.000Z' }),
    ]);
    const web = events.find((e) => e.id === 'web:created')!;
    const owner = events.find((e) => e.id === 'owner:created')!;
    expect(web.detail).toBe('New booking');
    expect(owner.detail).toBe('Phone booking taken');
  });

  it('emits a rescheduled event instead of created when rescheduled_from is set', () => {
    const events = buildAppointmentActivity([
      appt({
        id: 'new-row',
        rescheduled_from: 'old-row',
        created_at: '2026-08-05T09:00:00.000Z',
      }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('rescheduled');
  });

  it('emits one event per set timestamp, most recent first', () => {
    const events = buildAppointmentActivity([
      appt({
        id: 'a',
        created_at: '2026-08-01T09:00:00.000Z',
        completed_at: '2026-08-11T10:00:00.000Z',
      }),
    ]);
    expect(events.map((e) => e.kind)).toEqual(['completed', 'created']);
  });

  it('emits a no-show event for no-show status using updated_at', () => {
    const events = buildAppointmentActivity([
      appt({ id: 'a', status: 'no_show', updated_at: '2026-08-11T12:00:00.000Z' }),
    ]);
    const noShow = events.find((e) => e.kind === 'no_show')!;
    expect(noShow.at).toBe('2026-08-11T12:00:00.000Z');
  });
});
