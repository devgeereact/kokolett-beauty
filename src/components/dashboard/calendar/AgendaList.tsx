import type { JSX } from 'react';
import { STATUS_DOTS } from '@/lib/status';
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
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.key}>
          <button
            type="button"
            onClick={entry.onClick}
            disabled={!entry.onClick}
            className={cn(
              'flex w-full items-center gap-2.5 py-2 text-left text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              entry.onClick ? 'hover:text-primary' : 'cursor-not-allowed opacity-50',
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
            <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">
              {entry.time}
            </span>
            <span className="min-w-0 flex-1 truncate">{entry.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
