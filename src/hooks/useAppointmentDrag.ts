import { useCallback, useRef, useState } from 'react';
import { minutesFromPercent, snapMinutes, type HourRange } from '@/lib/calendar';
import { salonInstant } from '@/lib/format';
import { rescheduleAppointmentAsOwner } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import type { AppointmentDetailed } from '@/types';

/** Pixels the pointer must move before a press counts as a drag, not a click. */
const DRAG_THRESHOLD_PX = 6;

/** Where the dragged block is currently hovering, for rendering a ghost preview. */
export interface DragPreview {
  appointmentId: string;
  date: string;
  minutes: number;
  durationMin: number;
}

export interface UseAppointmentDrag {
  preview: DragPreview | null;
  busy: boolean;
  error: string | null;
  dismissError: () => void;
  /**
   * Wire to a draggable `EventBlock`'s `onPointerDown`. `columnEl` is the day
   * column whose top/height defines the vertical axis (every column in this
   * grid shares the same row-spanned height, so any one column's rect is
   * valid for all of them — only its `date` differs per column). `onClick`
   * fires instead of a reschedule when the pointer never moves past the drag
   * threshold, so the same block still opens its detail card on a tap.
   */
  beginDrag: (
    e: React.PointerEvent,
    appointment: AppointmentDetailed,
    date: string,
    columnEl: HTMLElement,
    onClick: () => void,
  ) => void;
}

/**
 * Custom pointer-events drag, not the HTML5 Drag and Drop API — HTML5 DnD's
 * touch support is unreliable, and the salon tablet this has to work on is
 * touch-first.
 *
 * A press is ambiguous until the pointer moves: this hook tracks it from
 * `pointerdown` but only commits to "dragging" (and shows a ghost) once
 * movement crosses `DRAG_THRESHOLD_PX`. Released before that, it is a click.
 *
 * Cross-day detection (`WeekView`) uses `elementFromPoint` + a `data-day-date`
 * attribute each day column carries, rather than tracking every column's
 * bounding rect on every pointer move — cheaper, and the DOM is the source of
 * truth for what is actually under the pointer.
 */
export function useAppointmentDrag(
  range: HourRange,
  timezone: string,
  onMoved: () => void,
): UseAppointmentDrag {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<{
    appointment: AppointmentDetailed;
    startDate: string;
    columnRect: DOMRect;
    startX: number;
    startY: number;
    dragging: boolean;
    onClick: () => void;
    pointerId: number;
  } | null>(null);

  const durationMinOf = (appointment: AppointmentDetailed): number =>
    (new Date(appointment.ends_at).getTime() -
      new Date(appointment.starts_at).getTime()) /
    60_000;

  const resolveFromPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      fallbackDate: string,
      rect: DOMRect,
    ): DragPreview => {
      const hovered = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>('[data-day-date]');
      const date = hovered?.getAttribute('data-day-date') ?? fallbackDate;
      const percent = ((clientY - rect.top) / rect.height) * 100;
      const minutes = snapMinutes(minutesFromPercent(percent, range));
      const appointment = stateRef.current?.appointment;
      return {
        appointmentId: appointment?.id ?? '',
        date,
        minutes,
        durationMin: appointment ? durationMinOf(appointment) : 0,
      };
    },
    [range],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (!s.dragging) {
        const moved = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
        if (moved < DRAG_THRESHOLD_PX) return;
        s.dragging = true;
      }
      setPreview(resolveFromPoint(e.clientX, e.clientY, s.startDate, s.columnRect));
    },
    [resolveFromPoint],
  );

  // pointercancel means the browser/OS revoked pointer ownership (a system
  // gesture, scroll, multi-touch) — it is not the user choosing a drop
  // location, so unlike finishDrag this never commits a reschedule and never
  // falls back to treating a non-dragging press as a click.
  const cancelDrag = useCallback(() => {
    stateRef.current = null;
    setPreview(null);
  }, []);

  const finishDrag = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      stateRef.current = null;
      if (!s) return;

      if (!s.dragging) {
        s.onClick();
        return;
      }

      const dropped = resolveFromPoint(e.clientX, e.clientY, s.startDate, s.columnRect);
      setPreview(null);

      const newStartsAt = salonInstant(
        dropped.date,
        `${String(Math.floor(dropped.minutes / 60)).padStart(2, '0')}:${String(dropped.minutes % 60).padStart(2, '0')}`,
        timezone,
      );

      if (newStartsAt.getTime() === new Date(s.appointment.starts_at).getTime()) {
        return; // dropped back where it started — nothing to do
      }

      setBusy(true);
      setError(null);
      rescheduleAppointmentAsOwner(s.appointment.id, newStartsAt)
        .then(() => {
          onMoved();
        })
        .catch((err: unknown) => {
          setError(errorMessage(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [onMoved, resolveFromPoint, timezone],
  );

  const beginDrag = useCallback(
    (
      e: React.PointerEvent,
      appointment: AppointmentDetailed,
      date: string,
      columnEl: HTMLElement,
      onClick: () => void,
    ) => {
      if (busy) return;
      e.preventDefault();
      const pointerId = e.pointerId;
      stateRef.current = {
        appointment,
        startDate: date,
        columnRect: columnEl.getBoundingClientRect(),
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        onClick,
        pointerId,
      };

      // Scoped to this one pointer/gesture: a second finger touching a
      // different draggable block mid-drag must not hijack stateRef, and
      // each listener set must detach itself, not the next drag's set.
      const detach = (): void => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleCancel);
      };
      const handleMove = (ev: PointerEvent): void => {
        if (ev.pointerId !== pointerId) return;
        onPointerMove(ev);
      };
      const handleUp = (ev: PointerEvent): void => {
        if (ev.pointerId !== pointerId) return;
        detach();
        finishDrag(ev);
      };
      const handleCancel = (ev: PointerEvent): void => {
        if (ev.pointerId !== pointerId) return;
        detach();
        cancelDrag();
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleCancel);
    },
    [busy, onPointerMove, finishDrag, cancelDrag],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { preview, busy, error, dismissError, beginDrag };
}
