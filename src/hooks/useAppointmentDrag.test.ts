import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAppointmentDrag } from '@/hooks/useAppointmentDrag';
import { rescheduleAppointmentAsOwner } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import type { AppointmentDetailed } from '@/types';

vi.mock('@/services/appointmentService', () => ({
  rescheduleAppointmentAsOwner: vi.fn(),
}));

const RANGE = { startMin: 480, endMin: 720 }; // 08:00-12:00
const TIMEZONE = 'UTC';

const APPOINTMENT = {
  id: 'appt-1',
  starts_at: '2026-08-11T09:00:00.000Z',
  ends_at: '2026-08-11T10:00:00.000Z',
} as unknown as AppointmentDetailed;

const COLUMN_RECT = { top: 0, height: 240 } as DOMRect;
const COLUMN_EL = { getBoundingClientRect: () => COLUMN_RECT } as unknown as HTMLElement;

function firePointer(
  type: string,
  clientX: number,
  clientY: number,
  pointerId?: number,
): void {
  const event = new Event(type);
  Object.assign(event, { clientX, clientY, pointerId });
  window.dispatchEvent(event);
}

function fakePointerDownEvent(
  clientX: number,
  clientY: number,
  pointerId?: number,
): React.PointerEvent {
  return {
    preventDefault: vi.fn(),
    clientX,
    clientY,
    pointerId,
  } as unknown as React.PointerEvent;
}

describe('useAppointmentDrag', () => {
  beforeEach(() => {
    document.elementFromPoint = vi.fn(() => null);
  });

  afterEach(() => {
    vi.mocked(rescheduleAppointmentAsOwner).mockReset();
  });

  it('treats a press released without movement as a click, not a drag', () => {
    const onMoved = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useAppointmentDrag(RANGE, TIMEZONE, onMoved));

    act(() => {
      result.current.beginDrag(
        fakePointerDownEvent(100, 60),
        APPOINTMENT,
        '2026-08-11',
        COLUMN_EL,
        onClick,
      );
    });
    act(() => {
      firePointer('pointerup', 100, 60);
    });

    expect(onClick).toHaveBeenCalledOnce();
    expect(rescheduleAppointmentAsOwner).not.toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
  });

  it('drags past the threshold, shows a preview, and reschedules on drop', async () => {
    vi.mocked(rescheduleAppointmentAsOwner).mockResolvedValue({
      appointment_id: 'appt-1',
      reference: 'REF1',
    });
    const onMoved = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useAppointmentDrag(RANGE, TIMEZONE, onMoved));

    act(() => {
      result.current.beginDrag(
        fakePointerDownEvent(100, 60),
        APPOINTMENT,
        '2026-08-11',
        COLUMN_EL,
        onClick,
      );
    });

    act(() => {
      firePointer('pointermove', 100, 120); // 10:00 — past the drag threshold
    });
    expect(result.current.preview).toEqual({
      appointmentId: 'appt-1',
      date: '2026-08-11',
      minutes: 600,
      durationMin: 60,
    });

    act(() => {
      firePointer('pointerup', 100, 120);
    });

    expect(onClick).not.toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
    expect(rescheduleAppointmentAsOwner).toHaveBeenCalledWith(
      'appt-1',
      new Date('2026-08-11T10:00:00.000Z'),
    );

    await waitFor(() => expect(onMoved).toHaveBeenCalledOnce());
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does nothing when the drop lands back on the original slot', () => {
    const onMoved = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useAppointmentDrag(RANGE, TIMEZONE, onMoved));

    act(() => {
      result.current.beginDrag(
        fakePointerDownEvent(100, 60),
        APPOINTMENT,
        '2026-08-11',
        COLUMN_EL,
        onClick,
      );
    });
    act(() => {
      firePointer('pointermove', 100, 120); // moves away, past the threshold
    });
    act(() => {
      firePointer('pointerup', 100, 60); // back to 09:00, the original slot
    });

    expect(rescheduleAppointmentAsOwner).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
  });

  it('surfaces a failed reschedule as an error and clears busy', async () => {
    vi.mocked(rescheduleAppointmentAsOwner).mockRejectedValue(new Error('SLOT_TAKEN'));
    const onMoved = vi.fn();
    const { result } = renderHook(() => useAppointmentDrag(RANGE, TIMEZONE, onMoved));

    act(() => {
      result.current.beginDrag(
        fakePointerDownEvent(100, 60),
        APPOINTMENT,
        '2026-08-11',
        COLUMN_EL,
        vi.fn(),
      );
    });
    act(() => {
      firePointer('pointermove', 100, 120);
    });
    act(() => {
      firePointer('pointerup', 100, 120);
    });

    await waitFor(() =>
      expect(result.current.error).toBe(errorMessage(new Error('SLOT_TAKEN'))),
    );
    expect(result.current.busy).toBe(false);
    expect(onMoved).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissError();
    });
    expect(result.current.error).toBeNull();
  });

  it('ignores a pointerup from a different pointerId than the one that started the drag', () => {
    const onMoved = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useAppointmentDrag(RANGE, TIMEZONE, onMoved));

    act(() => {
      result.current.beginDrag(
        fakePointerDownEvent(100, 60, 1),
        APPOINTMENT,
        '2026-08-11',
        COLUMN_EL,
        onClick,
      );
    });
    act(() => {
      // A second finger's pointerup — must not resolve the first finger's drag.
      firePointer('pointerup', 999, 999, 2);
    });

    expect(onClick).not.toHaveBeenCalled();
    expect(rescheduleAppointmentAsOwner).not.toHaveBeenCalled();

    act(() => {
      // The real pointer's own pointerup still resolves it as a click.
      firePointer('pointerup', 100, 60, 1);
    });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('treats pointercancel as an abort, never a drop, even mid-drag', () => {
    const onMoved = vi.fn();
    const onClick = vi.fn();
    const { result } = renderHook(() => useAppointmentDrag(RANGE, TIMEZONE, onMoved));

    act(() => {
      result.current.beginDrag(
        fakePointerDownEvent(100, 60, 1),
        APPOINTMENT,
        '2026-08-11',
        COLUMN_EL,
        onClick,
      );
    });
    act(() => {
      firePointer('pointermove', 100, 120, 1); // past the drag threshold
    });
    expect(result.current.preview).not.toBeNull();

    act(() => {
      firePointer('pointercancel', 100, 120, 1);
    });

    expect(result.current.preview).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
    expect(rescheduleAppointmentAsOwner).not.toHaveBeenCalled();

    // A stray pointerup after the cancel (already-detached listeners) is a no-op.
    act(() => {
      firePointer('pointerup', 100, 120, 1);
    });
    expect(onClick).not.toHaveBeenCalled();
    expect(rescheduleAppointmentAsOwner).not.toHaveBeenCalled();
  });
});
