import { STATUS_DOTS } from '@/lib/status';
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
}

/**
 * One positioned block on the hour-axis grid — a booking or a published,
 * unbooked time. `STATUS_DOTS` already resolves to a solid `bg-status-*`
 * class per status, so a booked block's fill reuses it directly rather than
 * introducing a second status-to-colour mapping.
 */
export function EventBlock({
  topPercent,
  heightPercent,
  variant,
  status,
  time,
  label,
  onClick,
}: EventBlockProps): JSX.Element {
  const style = { top: `${topPercent}%`, height: `${heightPercent}%` };

  if (variant === 'open') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={cn(
          'absolute inset-x-1 flex items-center justify-center rounded-md border-2 border-dashed',
          'border-border text-xs text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          onClick && 'hover:border-primary hover:text-primary',
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-left text-xs text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        status ? STATUS_DOTS[status] : 'bg-muted-foreground',
      )}
    >
      <span className="block font-mono text-[11px] font-semibold">{time}</span>
      <span className="block truncate">{label}</span>
    </button>
  );
}
