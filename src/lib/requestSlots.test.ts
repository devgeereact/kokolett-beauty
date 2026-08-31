import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, salonToday } from '@/lib/format';
import type { OwnerDaySlot } from '@/services/availabilityService';

/**
 * `@/services/availabilityService` constructs a Supabase client at module
 * scope, and CI has no `.env` — mock it rather than importing the real thing
 * (same pattern as `useAvailability.test.ts`).
 */
const listDaySlots = vi.fn();

vi.mock('@/services/availabilityService', () => ({
  listDaySlots: (...args: unknown[]): unknown => listDaySlots(...args),
}));

const { suggestSlotsForRequest } = await import('@/lib/requestSlots');

const TZ = 'Europe/London';

// `date < today` is a real guard in the function under test, so candidate
// dates must be computed relative to the real clock, not hard-coded — a
// hard-coded date silently drifts into the past as the calendar moves on.
const TODAY = salonToday(TZ).date;
const D1 = addDays(TODAY, 1);
const D2 = addDays(TODAY, 2);
const D3 = addDays(TODAY, 3);

function slot(
  localTime: string,
  opts: { booked?: boolean; past?: boolean } = {},
): OwnerDaySlot {
  return {
    starts_at: `${D1}T${localTime}:00.000Z`,
    local_time: localTime,
    is_booked: opts.booked ?? false,
    is_past: opts.past ?? false,
    reference: null,
    customer_name: null,
  };
}

describe('suggestSlotsForRequest', () => {
  beforeEach(() => {
    listDaySlots.mockReset();
  });

  it('returns the first open slot matching the flexibility on a preferred date', async () => {
    listDaySlots.mockResolvedValue([
      slot('09:00', { booked: true }),
      slot('10:00'),
      slot('14:00'),
    ]);

    const result = await suggestSlotsForRequest([D1], 'morning', 60, TZ);

    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe(D1);
    expect(listDaySlots).toHaveBeenCalledWith(D1);
  });

  it('skips a candidate date with no matching open slot', async () => {
    listDaySlots
      .mockResolvedValueOnce([slot('09:00', { booked: true })]) // day 1: nothing open
      .mockResolvedValueOnce([slot('10:00')]); // day 2: open

    const result = await suggestSlotsForRequest([D1, D2], 'any', 60, TZ);

    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe(D2);
  });

  it('skips a date whose fetch throws rather than failing the whole search', async () => {
    listDaySlots
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([slot('10:00')]);

    const result = await suggestSlotsForRequest([D1, D2], 'any', 60, TZ);

    expect(result).toHaveLength(1);
    expect(result[0]?.date).toBe(D2);
  });

  it('skips a candidate date that has already passed', async () => {
    const yesterday = addDays(TODAY, -1);
    listDaySlots.mockResolvedValue([slot('10:00')]);

    const result = await suggestSlotsForRequest([yesterday, D1], 'any', 60, TZ);

    // The past date is skipped before ever calling listDaySlots for it.
    expect(listDaySlots).not.toHaveBeenCalledWith(yesterday);
    expect(result[0]?.date).toBe(D1);
  });

  it('stops once maxSuggestions is reached without querying further dates', async () => {
    listDaySlots.mockResolvedValue([slot('10:00')]);

    const result = await suggestSlotsForRequest([D1, D2, D3], 'any', 60, TZ, 2);

    expect(result).toHaveLength(2);
    expect(listDaySlots).toHaveBeenCalledTimes(2);
  });

  it('filters candidates by time-of-day flexibility (morning/afternoon/evening boundaries)', async () => {
    listDaySlots.mockResolvedValue([
      slot('11:59'),
      slot('12:00'),
      slot('16:59'),
      slot('17:00'),
    ]);

    const morning = await suggestSlotsForRequest([D1], 'morning', 30, TZ);
    expect(morning[0]?.date).toBe(D1);

    const afternoon = await suggestSlotsForRequest([D1], 'afternoon', 30, TZ);
    expect(afternoon[0]?.date).toBe(D1);

    listDaySlots.mockResolvedValue([slot('16:59'), slot('17:00')]);
    const evening = await suggestSlotsForRequest([D1], 'evening', 30, TZ);
    expect(evening[0]?.date).toBe(D1);
  });

  it('finds nothing when every slot is booked or in the past', async () => {
    listDaySlots.mockResolvedValue([
      slot('09:00', { booked: true }),
      slot('10:00', { past: true }),
    ]);

    const result = await suggestSlotsForRequest([D1], 'any', 60, TZ);
    expect(result).toHaveLength(0);
  });

  it('falls back to scanning the next 14 days when no preferred dates are given', async () => {
    listDaySlots.mockResolvedValue([]); // nothing open anywhere

    const result = await suggestSlotsForRequest([], 'any', 60, TZ);

    expect(result).toHaveLength(0);
    expect(listDaySlots).toHaveBeenCalledTimes(14);
  });
});
