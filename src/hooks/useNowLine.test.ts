import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNowLine } from '@/hooks/useNowLine';

describe('useNowLine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the current salon-local minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T09:15:00Z')); // 10:15 BST
    const { result } = renderHook(() => useNowLine('Europe/London'));
    expect(result.current).toBe(10 * 60 + 15);
  });

  it('advances on the interval while mounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T09:15:00Z'));
    const { result } = renderHook(() => useNowLine('Europe/London'));

    act(() => {
      vi.setSystemTime(new Date('2026-08-11T09:20:00Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).toBe(10 * 60 + 20);
  });
});
