import type { JSX } from 'react';
import { STATUS_DOTS, STATUS_PILL_BG } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types';

export interface AgendaEntry {
  key: string;
  time: string;
  label: string;
  variant: 'booked' | 'open';
  status?: AppointmentStatus;
  onClick?: () => void;
}

/**
 * The accessible, chronological alternative to the visual grid — required
 * by docs/DESIGN.md §7, not decorative. Every entry a real `<button>` so it
 * works with no drag and no mouse.
 */
export function AgendaList({
  entries,
  emptyLabel,
}: {
  entries: AgendaEntry[];
  emptyLabel: string;
}): JSX.Element {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    // gap-1 between rows, not `divide-y`: each booked row now carries its
    // own status tint (the same `STATUS_PILL_BG` fill Day/Week/Month use), so
    // a full-width divider line would cut across that colour block instead of
    // separating rows cleanly.
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => (
        <li key={entry.key}>
          <button
            type="button"
            onClick={entry.onClick}
            disabled={!entry.onClick}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              entry.variant === 'booked' && entry.status && STATUS_PILL_BG[entry.status],
              entry.onClick ? 'hover:text-brand-ink' : 'cursor-not-allowed opacity-50',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                entry.variant === 'open'
                  ? 'border border-dashed border-muted-foreground'
                  : entry.status
                    ? STATUS_DOTS[entry.status]
                    : 'bg-muted-foreground',
              )}
            />
            {/* Same 52px column width as Day/Week's time gutter, so the
                three grid views and this list line up when switched between. */}
            <span className="w-[52px] shrink-0 font-mono text-xs text-muted-foreground">
              {entry.time}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
