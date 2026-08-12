import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveClock } from '@/hooks/useLiveClock';

describe('useLiveClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T09:15:00Z'));
    const { result } = renderHook(() => useLiveClock());
    expect(result.current.getTime()).toBe(new Date('2026-08-11T09:15:00Z').getTime());
  });

  it('advances on the interval while mounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T09:15:00Z'));
    const { result } = renderHook(() => useLiveClock());

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.getTime()).toBe(new Date('2026-08-11T09:15:30Z').getTime());
  });
});
