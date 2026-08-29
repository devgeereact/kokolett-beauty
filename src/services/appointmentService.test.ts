import { describe, expect, it } from 'vitest';
import { filterUnpaidCompleted } from '@/services/appointmentService';
import type { AppointmentDetailed } from '@/types';

/**
 * `paid_pence` sums `payments` rows for the appointment (view
 * `appointments_detailed`, migration 0027) — 0 or null both mean nothing
 * has been logged yet, so both must count as unpaid.
 */
function row(paid_pence: number | null): AppointmentDetailed {
  return { id: 'a1', paid_pence } as AppointmentDetailed;
}

describe('filterUnpaidCompleted', () => {
  it('keeps rows with paid_pence of 0', () => {
    expect(filterUnpaidCompleted([row(0)])).toHaveLength(1);
  });

  it('keeps rows with a null paid_pence', () => {
    expect(filterUnpaidCompleted([row(null)])).toHaveLength(1);
  });

  it('drops rows with a logged payment', () => {
    expect(filterUnpaidCompleted([row(6500)])).toHaveLength(0);
  });

  it('handles a mix, preserving order', () => {
    const rows = [row(0), row(6500), row(null), row(100)];
    expect(filterUnpaidCompleted(rows).map((r) => r.paid_pence)).toEqual([0, null]);
  });

  it('returns an empty array for no rows', () => {
    expect(filterUnpaidCompleted([])).toEqual([]);
  });
});
