import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSalonToday } from '@/hooks/useSalonToday';

/**
 * The dashboard's Today screen is left open on a salon tablet overnight. When
 * "today" was computed once at mount, the header rendered a fresh date on every
 * render while the appointment list stayed pinned to yesterday's window — and
 * the realtime handler re-queried that stale window, so bookings for the new day
 * never appeared at all.
 */
describe('useSalonToday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on the current salon day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T10:00:00Z'));

    const { result } = renderHook(() => useSalonToday('Europe/London'));
    expect(result.current.date).toBe('2026-07-15');
  });

  it('uses the salon timezone, not the host clock, near midnight', () => {
    vi.useFakeTimers();
    // 23:30 UTC in July is 00:30 BST the next day — already tomorrow for the salon.
    vi.setSystemTime(new Date('2026-07-15T23:30:00Z'));

    const { result } = renderHook(() => useSalonToday('Europe/London'));
    expect(result.current.date).toBe('2026-07-16');
  });

  it('rolls over to the new day while it stays mounted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T23:59:00Z'));

    const { result } = renderHook(() => useSalonToday('Europe/London'));
    expect(result.current.date).toBe('2026-01-15');

    // Two minutes later it is the next salon day. Nothing was clicked and the
    // component never remounted; this is the tablet-left-open case.
    act(() => {
      vi.setSystemTime(new Date('2026-01-16T00:01:00Z'));
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.date).toBe('2026-01-16');
    expect(result.current.start.toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('catches up on visibilitychange, for a tablet woken from sleep', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    const { result } = renderHook(() => useSalonToday('Europe/London'));
    expect(result.current.date).toBe('2026-01-15');

    // Timers are throttled or suspended while the device sleeps, so the interval
    // alone cannot be relied on to notice.
    act(() => {
      vi.setSystemTime(new Date('2026-01-17T09:00:00Z'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.date).toBe('2026-01-17');
  });

  it('keeps the same object while the day has not changed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    const { result } = renderHook(() => useSalonToday('Europe/London'));
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // A re-render on every tick would restart the appointments query every
    // minute, because the range is a dependency of that fetch.
    expect(result.current).toBe(first);
  });
});
