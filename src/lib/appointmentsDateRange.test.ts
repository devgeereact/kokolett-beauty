import { describe, expect, it } from 'vitest';
import {
  computeDateRange,
  dateRangeLabel,
  stepDateMode,
} from '@/lib/appointmentsDateRange';

const TZ = 'Europe/London';

describe('computeDateRange', () => {
  it('today spans exactly the salon-local day', () => {
    const { from, to } = computeDateRange('today', '2026-06-15', '2026-06-15', TZ);
    // BST (UTC+1) in June: local midnight is 23:00 UTC the day before.
    expect(from.toISOString()).toBe('2026-06-14T23:00:00.000Z');
    expect(to.toISOString()).toBe('2026-06-15T23:00:00.000Z');
  });

  it('week spans Monday to end of Sunday, anchored anywhere in that week', () => {
    // 2026-06-17 is a Wednesday.
    const { from, to } = computeDateRange('week', '2026-06-17', '2026-06-17', TZ);
    expect(from.toISOString()).toBe('2026-06-14T23:00:00.000Z'); // Mon 15th 00:00 local
    expect(to.toISOString()).toBe('2026-06-21T23:00:00.000Z'); // Sun 21st 24:00 local
  });

  it('month spans the 1st through the last day of the anchor month, including a 31-day month', () => {
    // January is GMT (no DST), so local midnight equals UTC midnight.
    const { from, to } = computeDateRange('month', '2026-01-15', '2026-01-15', TZ);
    expect(from.toISOString()).toBe('2026-01-01T00:00:00.000Z'); // Jan 1 00:00 GMT
    expect(to.toISOString()).toBe('2026-02-01T00:00:00.000Z'); // Feb 1 00:00 GMT
  });

  it('month handles February in a leap year (29 days)', () => {
    const { from, to } = computeDateRange('month', '2028-02-10', '2028-02-10', TZ);
    expect(from.toISOString()).toBe('2028-02-01T00:00:00.000Z');
    expect(to.toISOString()).toBe('2028-03-01T00:00:00.000Z');
  });

  it('last7 ends the day before today, not including today', () => {
    const { from, to } = computeDateRange('last7', 'x', '2026-06-15', TZ);
    expect(from.toISOString()).toBe('2026-06-07T23:00:00.000Z'); // June 8 00:00 local
    expect(to.toISOString()).toBe('2026-06-14T23:00:00.000Z'); // June 14 24:00 local
  });

  it('last30 spans 30 days ending the day before today', () => {
    const { from, to } = computeDateRange('last30', 'x', '2026-06-15', TZ);
    expect(from.toISOString()).toBe('2026-05-15T23:00:00.000Z');
    expect(to.toISOString()).toBe('2026-06-14T23:00:00.000Z');
  });

  it('all is wide but bounded, not unbounded', () => {
    const { from, to } = computeDateRange('all', 'x', '2026-06-15', TZ);
    // ~2 years back, ~1 year forward — sanity-check the order of magnitude
    // rather than the exact instant, since it composes addDays + salonDayRange.
    const fromYear = from.getUTCFullYear();
    const toYear = to.getUTCFullYear();
    expect(fromYear).toBeLessThanOrEqual(2024);
    expect(toYear).toBeGreaterThanOrEqual(2027);
    expect(from.getTime()).toBeLessThan(to.getTime());
  });
});

describe('dateRangeLabel', () => {
  it('formats today as a long date', () => {
    expect(dateRangeLabel('today', '2026-06-15')).toBe('Monday, 15 June 2026');
  });

  it('formats week as a short Monday to Sunday range', () => {
    expect(dateRangeLabel('week', '2026-06-17')).toBe('Mon 15 Jun to Sun 21 Jun');
  });

  it('formats month as month + year', () => {
    expect(dateRangeLabel('month', '2026-01-15')).toBe('January 2026');
  });

  it('gives fixed labels for last7/last30/all', () => {
    expect(dateRangeLabel('last7', 'x')).toBe('Last 7 days');
    expect(dateRangeLabel('last30', 'x')).toBe('Last 30 days');
    expect(dateRangeLabel('all', 'x')).toBe('All time');
  });
});

describe('stepDateMode', () => {
  it('steps today by one day', () => {
    expect(stepDateMode('today', '2026-06-15', 1)).toBe('2026-06-16');
    expect(stepDateMode('today', '2026-06-15', -1)).toBe('2026-06-14');
  });

  it('steps week by seven days', () => {
    expect(stepDateMode('week', '2026-06-15', 1)).toBe('2026-06-22');
    expect(stepDateMode('week', '2026-06-15', -1)).toBe('2026-06-08');
  });

  it('steps month to the 1st of the next/prev month, crossing a year boundary', () => {
    expect(stepDateMode('month', '2026-12-15', 1)).toBe('2027-01-01');
    expect(stepDateMode('month', '2026-01-15', -1)).toBe('2025-12-01');
  });

  it('leaves last7/last30/all anchor unchanged — they have no anchor to step', () => {
    expect(stepDateMode('last7', '2026-06-15', 1)).toBe('2026-06-15');
    expect(stepDateMode('last30', '2026-06-15', -1)).toBe('2026-06-15');
    expect(stepDateMode('all', '2026-06-15', 1)).toBe('2026-06-15');
  });
});
