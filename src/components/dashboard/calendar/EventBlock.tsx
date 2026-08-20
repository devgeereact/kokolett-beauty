import { type JSX, memo } from 'react';
import { STATUS_DOTS, STATUS_PILL_BG } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types';

export interface EventBlockProps {
  topPercent: number;
  heightPercent: number;
  variant: 'booked' | 'open';
  /** Required when `variant` is `'booked'`. */
  status?: AppointmentStatus;
  time: string;
  label: string;
  onClick?: () => void;
  /**
   * Wired up only for `confirmed`/`pending_approval` blocks — dragging them
   * reschedules via `useAppointmentDrag`. When set, this replaces `onClick`
   * as the block's interaction: the hook decides whether a press turns out
   * to be a tap (and calls `onClick` itself) or an actual drag.
   */
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  draggable?: boolean;
}

/**
 * One positioned block on the hour-axis grid — a booking or a published,
 * unbooked time.
 *
 * The booked variant does not fill with a solid `bg-status-*` colour and
 * white text — that fails WCAG contrast at 10-11px (`#d97706` on white is
 * ~3.2:1, needs 4.5:1) and colour would be the only thing carrying status,
 * which docs/DESIGN.md §3 forbids. It uses the pale `STATUS_PILL_BG` fill —
 * the same `--tint-*` background `statusPillClass()` uses elsewhere — with
 * `text-foreground` text instead (passes by construction at 15% mix against
 * `--card`), plus the status dot — colour supports the block, the dot and
 * label still carry it on their own.
 */
function EventBlockImpl({
  topPercent,
  heightPercent,
  variant,
  status,
  time,
  label,
  onClick,
  onPointerDown,
  draggable,
}: EventBlockProps): JSX.Element {
  const style = { top: `${topPercent}%`, height: `${heightPercent}%` };

  if (variant === 'open') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        style={style}
        className={cn(
          'absolute inset-x-1 flex items-center justify-center rounded-md border-2 border-dashed',
          'border-border text-xs text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          onClick
            ? 'hover:border-primary hover:text-primary'
            : 'cursor-not-allowed opacity-50',
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        // A real pointer click on a draggable block is already handled by
        // useAppointmentDrag's finishDrag (it calls onClick itself when a
        // press never crosses the drag threshold) — calling onClick here too
        // would double-fire it. A keyboard-triggered click (Enter/Space)
        // never goes through pointerdown at all, so it must still reach
        // onClick here. Native MouseEvent.detail is 0 for a keyboard-
        // synthesized click and >=1 for a real pointer click — that's the
        // one reliable way to tell them apart.
        if (onPointerDown && e.detail !== 0) return;
        onClick?.();
      }}
      onPointerDown={onPointerDown}
      style={style}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-md border border-border px-2 py-1',
        status ? STATUS_PILL_BG[status] : 'bg-card',
        'text-left text-xs text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        draggable && 'cursor-grab touch-none active:cursor-grabbing',
      )}
    >
      <span className="flex items-center gap-1 font-mono text-2xs font-semibold">
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            status ? STATUS_DOTS[status] : 'bg-muted-foreground',
          )}
        />
        {time}
      </span>
      <span className="block truncate">{label}</span>
    </button>
  );
}

/**
 * Memoized: WeekView/DayView re-render on every drag pointermove and every
 * 30s now-line tick, and there can be dozens of these on screen at once.
 * Callers must pass a referentially stable `onClick`/`onPointerDown` (see
 * `WeekAppointmentBlock`/`WeekOpenSlotBlock`) or this memoization is a no-op.
 */
export const EventBlock = memo(EventBlockImpl);
