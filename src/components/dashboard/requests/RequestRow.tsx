import { Calendar, CalendarCheck, Clock, MoreHorizontal } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatDateShort, formatDateTime, formatRelative } from '@/lib/format';
import {
  PRIORITY_LABELS,
  PRIORITY_TONE,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONE,
  laneForStatus,
  priorityFromWaitingHours,
} from '@/lib/requestStatus';
import { TONE_TEXT } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { QueuedRequest } from '@/services/requestService';

const FLEXIBILITY_LABELS: Record<string, string> = {
  any: 'Any time',
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
};

/** One row in the requests queue — the reference's table condensed into a card, selectable into the detail panel on the right. */
export function RequestRow({
  request,
  selected,
  onSelect,
}: {
  request: QueuedRequest;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const lane = laneForStatus(request.status);
  const isOpen = lane === 'new' || lane === 'awaiting_response';
  const priority = priorityFromWaitingHours(request.waiting_hours);

  return (
    <Card
      className={cn(
        'cursor-pointer p-5 transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'hover:border-foreground/20',
      )}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={request.full_name} size="md" />

        <div className="min-w-[11rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-serif text-base font-semibold text-foreground">
              {request.full_name}
            </p>
            <Badge tone={REQUEST_STATUS_TONE[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{request.email}</p>
          {request.mobile && (
            <p className="text-sm text-muted-foreground">{request.mobile}</p>
          )}
        </div>

        <div className="min-w-[8rem] text-sm">
          <p className="font-medium text-foreground">
            {request.service_name ?? 'Not sure yet'}
          </p>
        </div>

        <div className="min-w-[10rem] text-sm">
          {isOpen ? (
            <>
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
                Preferred
              </p>
              <p className="mb-1.5 ml-5 text-muted-foreground">
                {request.preferred_dates.length > 0
                  ? request.preferred_dates
                      .map((d) => formatDateShort(`${d}T00:00:00Z`))
                      .join(' – ')
                  : 'Any date'}
              </p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Clock
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={2}
                />
                {FLEXIBILITY_LABELS[request.flexibility] ?? request.flexibility}
              </p>
            </>
          ) : lane === 'converted' ? (
            <>
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
                Offered
              </p>
              <p className="mb-1.5 ml-5 text-muted-foreground">
                {request.responded_at ? formatDateTime(request.responded_at) : '—'}
              </p>
              <p
                className={cn(
                  'flex items-center gap-1.5 font-medium',
                  TONE_TEXT.completed,
                )}
              >
                <CalendarCheck
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={2}
                />
                Booked
              </p>
              <p className="ml-5 text-muted-foreground">
                {request.converted_starts_at
                  ? formatDateTime(request.converted_starts_at)
                  : '—'}
              </p>
            </>
          ) : (
            // declined / expired — no offer was ever made, just when they asked.
            <>
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                />
                Requested
              </p>
              <p className="ml-5 text-muted-foreground">
                {formatDateTime(request.created_at)}
              </p>
            </>
          )}
        </div>

        <div className="min-w-[7rem] text-sm">
          {isOpen ? (
            <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Badge>
          ) : (
            <Badge tone={REQUEST_STATUS_TONE[request.status]}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {isOpen
              ? formatRelative(request.created_at)
              : formatRelative(request.updated_at)}
          </p>
        </div>

        <button
          type="button"
          aria-label="More options"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </Card>
  );
}
