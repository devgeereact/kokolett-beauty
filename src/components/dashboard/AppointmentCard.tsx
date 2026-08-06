import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDuration, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed, AppointmentStatus } from '@/types';

/** The transitions offered from each status, mirroring `set_appointment_status`. */
const NEXT_ACTIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  confirmed: ['checked_in', 'no_show'],
  checked_in: ['in_service'],
  in_service: ['completed'],
};

const ACTION_LABELS: Record<string, string> = {
  checked_in: 'Check in',
  in_service: 'Start',
  completed: 'Complete',
  no_show: 'No show',
  cancelled: 'Cancel',
};

export function AppointmentCard({
  appointment,
  timezone,
  onStatusChange,
  className,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  onStatusChange?: (id: string, status: AppointmentStatus) => Promise<void>;
  className?: string;
}): JSX.Element {
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const actions = NEXT_ACTIONS[appointment.status] ?? [];

  const run = async (status: AppointmentStatus): Promise<void> => {
    if (!onStatusChange) return;
    setBusy(status);
    try {
      await onStatusChange(appointment.id, status);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4',
        className,
      )}
    >
      <div className="shrink-0 sm:w-20">
        <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {formatTime(appointment.starts_at, timezone)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDuration(
            (new Date(appointment.ends_at).getTime() -
              new Date(appointment.starts_at).getTime()) /
              60000,
          )}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-foreground">
            {appointment.customer_name}
          </p>
          <StatusChip status={appointment.status} />
          {appointment.customer_completed_count === 0 && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              First visit
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {appointment.service_name} · {formatMoney(appointment.price_pence)} ·{' '}
          <span className="font-mono">{appointment.reference}</span>
        </p>
        {appointment.customer_note && (
          <p className="mt-1 text-sm text-muted-foreground">
            &ldquo;{appointment.customer_note}&rdquo;
          </p>
        )}
      </div>

      {actions.length > 0 && onStatusChange && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {actions.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'no_show' ? 'ghost' : 'primary'}
              loading={busy === status}
              onClick={() => void run(status)}
            >
              {ACTION_LABELS[status]}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
