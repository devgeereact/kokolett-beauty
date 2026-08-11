import { STATUS_BORDERS, STATUS_DOTS } from '@/lib/status';
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
 * unbooked time.
 *
 * The booked variant does not fill with a solid `bg-status-*` colour and
 * white text — that fails WCAG contrast at 10-11px (`#d97706` on white is
 * ~3.2:1, needs 4.5:1) and colour would be the only thing carrying status,
 * which docs/DESIGN.md §3 forbids. Instead it follows the same pattern
 * `AppointmentCard` already uses for its "completed" accent: a neutral
 * `bg-card` surface, `text-foreground` text (passes by construction), and the
 * status hue reduced to a `border-l-4` accent plus a small redundant dot.
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
        disabled={!onClick}
        style={style}
        className={cn(
          'absolute inset-x-1 flex items-center justify-center rounded-md border-2 border-dashed',
          'border-border text-xs text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          onClick ? 'hover:border-primary hover:text-primary' : 'cursor-not-allowed opacity-50',
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
        'absolute inset-x-1 overflow-hidden rounded-md border border-border border-l-4 bg-card px-2 py-1',
        'text-left text-xs text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        status ? STATUS_BORDERS[status] : 'border-l-muted-foreground',
      )}
    >
      <span className="flex items-center gap-1 font-mono text-[11px] font-semibold">
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status ? STATUS_DOTS[status] : 'bg-muted-foreground')}
        />
        {time}
      </span>
      <span className="block truncate">{label}</span>
    </button>
  );
}
