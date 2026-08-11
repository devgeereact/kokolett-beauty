import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatMoney,
  minutesSinceMidnight,
  parseMoney,
  salonDayRange,
  salonInstant,
  toSalonDate,
} from '@/lib/format';

/**
 * Money and time are the two things this app must never get subtly wrong: a
 * price is what the customer is charged and a slot is when she is expected to
 * turn up. Both have a house rule — integer pence, and the salon's clock rather
 * than the browser's — and both rules are invisible until they are broken.
 *
 * The BST cases matter most. CI pins `TZ=UTC` precisely so a Europe/London
 * machine cannot hide an off-by-one-hour error, so these assert the salon
 * timezone explicitly rather than relying on the host.
 */

describe('money is integer pence', () => {
  it('formats pence as pounds without float drift', () => {
    expect(formatMoney(4250)).toBe('£42.50');
    expect(formatMoney(0)).toBe('£0.00');
    expect(formatMoney(1)).toBe('£0.01');
    expect(formatMoney(999999)).toBe('£9,999.99');
  });

  it('parses pounds back to whole pence, rounding rather than truncating', () => {
    expect(parseMoney('42.50')).toBe(4250);
    expect(parseMoney('£42.50')).toBe(4250);
    expect(parseMoney('0.01')).toBe(1);
    // 0.1 + 0.2 territory: this must not land on 4249.
    expect(parseMoney('42.49')).toBe(4249);
  });

  it('round-trips every pence value without losing a penny', () => {
    for (const pence of [1, 7, 99, 100, 4250, 12345, 999999]) {
      expect(parseMoney(formatMoney(pence))).toBe(pence);
    }
  });

  it('rejects input that is not money', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('the salon clock, not the browser clock', () => {
  it('maps an instant to the salon calendar date', () => {
    // 23:30 UTC on 5 Jan is already 23:30 GMT — same day.
    expect(toSalonDate('2026-01-05T23:30:00Z', 'Europe/London')).toBe('2026-01-05');
    // 23:30 UTC on 5 July is 00:30 BST on the 6th — the next salon day.
    expect(toSalonDate('2026-07-05T23:30:00Z', 'Europe/London')).toBe('2026-07-06');
  });

  it('starts a GMT day at 00:00 UTC', () => {
    const { start } = salonDayRange('2026-01-15', 'Europe/London');
    expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('starts a BST day an hour earlier in UTC', () => {
    const { start } = salonDayRange('2026-07-15', 'Europe/London');
    expect(start.toISOString()).toBe('2026-07-14T23:00:00.000Z');
  });

  it('handles the spring-forward day, where local midnight is still GMT', () => {
    // BST begins 01:00 on the last Sunday of March 2026 (the 29th). The day
    // still *starts* at 00:00 GMT; the naive single-pass conversion gets this
    // wrong, which is why salonDayRange re-checks the offset.
    const { start } = salonDayRange('2026-03-29', 'Europe/London');
    expect(start.toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('handles the autumn-back day', () => {
    const { start } = salonDayRange('2026-10-25', 'Europe/London');
    expect(start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });

  it('resolves a local wall-clock time to the right instant either side of DST', () => {
    expect(salonInstant('2026-01-15', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-01-15T09:00:00.000Z',
    );
    // 09:00 BST is 08:00 UTC. A slot published as 09:00 must not drift an hour.
    expect(salonInstant('2026-07-15', '09:00', 'Europe/London').toISOString()).toBe(
      '2026-07-15T08:00:00.000Z',
    );
  });

  it('adds days on the calendar, not by adding 86400 seconds', () => {
    // Across the spring-forward boundary a 24-hour addition lands on the wrong
    // date; string date arithmetic does not.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('minutesSinceMidnight', () => {
  it('reads the salon-local wall clock, not UTC', () => {
    // 09:15 UTC in August is 10:15 BST for Europe/London.
    expect(minutesSinceMidnight('2026-08-11T09:15:00Z', 'Europe/London')).toBe(
      10 * 60 + 15,
    );
  });

  it('reads UTC directly when the timezone is UTC', () => {
    expect(minutesSinceMidnight('2026-08-11T14:30:00Z', 'UTC')).toBe(14 * 60 + 30);
  });

  it('treats local midnight as 0, not 24 times 60', () => {
    // 23:00 UTC in August is 00:00 BST the next day.
    expect(minutesSinceMidnight('2026-08-11T23:00:00Z', 'Europe/London')).toBe(0);
  });
});
