import { describe, expect, it } from 'vitest';
import {
  analyzeDayOfWeekTrend,
  findScheduleConflicts,
  forecastCancellationRisk,
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

describe('forecastCancellationRisk', () => {
  it('scores a first-time, short-notice, walk-in booking higher than a routine one', () => {
    const risky = appt({
      id: 'risky',
      customer_id: 'newcomer',
      customer_completed_count: 0,
      source: 'owner',
      created_at: '2026-08-11T08:00:00.000Z',
      starts_at: '2026-08-11T09:00:00.000Z', // 1 hour lead time
    });
    const routine = appt({
      id: 'routine',
      customer_id: 'regular',
      customer_completed_count: 5,
      source: 'web',
      created_at: '2026-07-01T09:00:00.000Z',
      starts_at: '2026-08-11T09:00:00.000Z', // weeks of lead time
    });

    const ranked = forecastCancellationRisk([routine, risky], new Map([['newcomer', 2]]));
    const first = ranked[0]!;
    const second = ranked[1]!;
    expect(first.appointment.id).toBe('risky');
    expect(first.reasons).toEqual(
      expect.arrayContaining([
        'First-time customer',
        'Booked with very little notice',
        'Has missed appointments before',
        'Booked by phone, not online',
      ]),
    );
    expect(second.appointment.id).toBe('routine');
    expect(second.score).toBe(0);
  });

  it('caps the score at 1', () => {
    const risk = forecastCancellationRisk(
      [
        appt({
          customer_id: 'x',
          customer_completed_count: 0,
          source: 'owner',
          created_at: '2026-08-11T08:59:00.000Z',
          starts_at: '2026-08-11T09:00:00.000Z',
        }),
      ],
      new Map([['x', 3]]),
    )[0]!;
    expect(risk.score).toBeLessThanOrEqual(1);
  });
});
