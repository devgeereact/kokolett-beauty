import { describe, expect, it } from 'vitest';
import {
  openingHoursRange,
  offsetPercent,
  hourLabels,
  weekDates,
  shiftAnchor,
  minutesFromPercent,
  snapMinutes,
} from '@/lib/calendar';

describe('openingHoursRange', () => {
  it('is always fixed to 08:00–20:00', () => {
    expect(openingHoursRange()).toEqual({ startMin: 480, endMin: 1200 });
  });
});

describe('offsetPercent', () => {
  const range = { startMin: 480, endMin: 720 }; // 08:00-12:00, 240 min span

  it('places the range start at 0% and the end at 100%', () => {
    expect(offsetPercent(480, range)).toBe(0);
    expect(offsetPercent(720, range)).toBe(100);
  });

  it('places the midpoint at 50%', () => {
    expect(offsetPercent(600, range)).toBe(50);
  });

  it('clamps outside the range instead of overflowing', () => {
    expect(offsetPercent(0, range)).toBe(0);
    expect(offsetPercent(2000, range)).toBe(100);
  });
});

describe('minutesFromPercent', () => {
  const range = { startMin: 480, endMin: 720 }; // 08:00-12:00, 240 min span

  it('is the exact inverse of offsetPercent', () => {
    expect(minutesFromPercent(0, range)).toBe(480);
    expect(minutesFromPercent(100, range)).toBe(720);
    expect(minutesFromPercent(50, range)).toBe(600);
    expect(minutesFromPercent(offsetPercent(633, range), range)).toBeCloseTo(633, 5);
  });

  it('clamps outside 0-100 instead of extrapolating past the axis', () => {
    expect(minutesFromPercent(-20, range)).toBe(480);
    expect(minutesFromPercent(150, range)).toBe(720);
  });
});

describe('snapMinutes', () => {
  it('rounds to the nearest 15-minute mark', () => {
    expect(snapMinutes(603)).toBe(600); // 10:03 -> 10:00
    expect(snapMinutes(608)).toBe(615); // 10:08 -> 10:15
    expect(snapMinutes(600)).toBe(600); // already on the grid
  });

  it('rounds a value exactly halfway up, matching Math.round', () => {
    expect(snapMinutes(607.5)).toBe(615);
  });

  it('clamps below midnight instead of rounding up to 1440 ("24:00")', () => {
    expect(snapMinutes(1440)).toBe(1425); // exactly midnight
    expect(snapMinutes(1433)).toBe(1425); // would otherwise round up to 1440
    expect(snapMinutes(1420)).toBe(1425); // still snaps normally below the clamp
  });
});

describe('hourLabels', () => {
  it('lists one label per hour, half-open', () => {
    expect(hourLabels({ startMin: 540, endMin: 720 })).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
  });
});

describe('weekDates', () => {
  it('returns the Monday-first week containing the anchor', () => {
    // 2026-08-11 is a Tuesday
    expect(weekDates('2026-08-11')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });

  it('handles a Sunday anchor as the last day of its own week', () => {
    expect(weekDates('2026-08-16')[0]).toBe('2026-08-10');
    expect(weekDates('2026-08-16')[6]).toBe('2026-08-16');
  });
});

describe('shiftAnchor', () => {
  it('moves a week anchor by 7 days', () => {
    expect(shiftAnchor('week', '2026-08-11', 1)).toBe('2026-08-18');
    expect(shiftAnchor('week', '2026-08-11', -1)).toBe('2026-08-04');
  });

  it('moves a day anchor by 1 day', () => {
    expect(shiftAnchor('day', '2026-08-11', 1)).toBe('2026-08-12');
  });

  it('moves a month anchor to the 1st of the next/previous month', () => {
    expect(shiftAnchor('month', '2026-08-11', 1)).toBe('2026-09-01');
    expect(shiftAnchor('month', '2026-08-11', -1)).toBe('2026-07-01');
  });
});
