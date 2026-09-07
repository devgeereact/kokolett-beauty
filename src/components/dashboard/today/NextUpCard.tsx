import type { JSX } from 'react';
import { Clock, Star } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeading } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDuration, formatRelative, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function NextUpRow({
  appointment,
  timezone,
  now,
  onViewDetails,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  now: Date;
  onViewDetails: (id: string) => void;
}): JSX.Element {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Avatar name={appointment.customer_name ?? '?'} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-serif text-base font-semibold text-foreground">
              {appointment.customer_name}
            </p>
            <span className="shrink-0 text-xs font-medium text-brand-ink">
              {capitalize(formatRelative(appointment.starts_at, now))}
            </span>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {appointment.service_name}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2} />
            {formatTime(appointment.starts_at, timezone)}
            {' to '}
            {formatTime(appointment.ends_at, timezone)}
            {' ('}
            {/* Measured from the two times printed either side of it, not from
                `service_duration_min`. The booked block is the service length
                plus its buffer, so reading the service length here rendered
                "17:00 – 17:55 (45m)" — a card contradicting itself, and
                disagreeing with the Appointments list and detail panel, which
                both show the block. */}
            {formatDuration(
              Math.max(
                0,
                Math.round(
                  (new Date(appointment.ends_at).getTime() -
                    new Date(appointment.starts_at).getTime()) /
                    60_000,
                ),
              ),
            )}
            {')'}
          </p>
          <StatusChip status={appointment.status} className="mt-2" />
        </div>
      </div>

      {appointment.customer_note && (
        <div className="mt-3 rounded-lg bg-tint-brand p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-ink">
            <Star aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            Client notes
          </p>
          <p className="mt-1 text-sm text-foreground">{appointment.customer_note}</p>
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="mt-4 self-start"
        onClick={() => onViewDetails(appointment.id)}
      >
        View details
      </Button>
    </div>
  );
}

/**
 * The next couple of appointments, not just the very next one — enough to
 * glance ahead without opening the full schedule. Sized to its own content
 * (one row or two), never stretched or squashed to match a neighbouring
 * card's height.
 */
export function NextUpCard({
  appointments,
  timezone,
  now,
  onViewDetails,
  className,
}: {
  appointments: AppointmentDetailed[];
  timezone: string;
  now: Date;
  onViewDetails: (id: string) => void;
  className?: string;
}): JSX.Element {
  return (
    <Card pad="compact" className={cn('flex h-full flex-col', className)}>
      <CardHeading size="compact" title="Next up" />

      {appointments.length === 0 && (
        <EmptyState
          size="compact"
          title="Nothing on the books"
          description="Once something's confirmed, it'll show up here."
        />
      )}

      {appointments.map((appointment, index) => (
        <div key={appointment.id}>
          {index > 0 && <div className="my-4 border-t border-border" />}
          <NextUpRow
            appointment={appointment}
            timezone={timezone}
            now={now}
            onViewDetails={onViewDetails}
          />
        </div>
      ))}
    </Card>
  );
}
