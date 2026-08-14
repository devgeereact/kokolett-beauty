import { STATUS_LABELS, statusPillClass } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types';

/** A filled status pill — the Appointments table's own status treatment. */
export function StatusPill({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        statusPillClass(status),
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
