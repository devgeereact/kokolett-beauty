import type { JSX } from 'react';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDateTime, formatMoney } from '@/lib/format';
import { STATUS_DOTS } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

/**
 * KOKO_GAP.md P3: "History shown as a flat list, not a timeline
 * visualisation... no dedicated Timeline component." `ScheduleTimeline.tsx`
 * exists but is day-schedule-specific (one calendar day, many customers) —
 * this is the inverse shape (one customer, every appointment they've ever
 * had), so it earns its own small component rather than a re-parameterised
 * version of that one.
 *
 * A connected line of dots, newest first (matches `listForCustomer()`'s own
 * ordering) — colour comes from the same `STATUS_DOTS` map the calendar and
 * status pills already use, so a cancelled/no-show visit reads the same
 * everywhere in the app.
 */
export function CustomerTimeline({
  history,
  timezone,
}: {
  history: AppointmentDetailed[];
  timezone: string;
}): JSX.Element {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No appointments yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {history.map((a, i) => {
        const reason = a.cancellation_reason ?? a.rejection_reason;
        return (
          <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < history.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[4.5px] top-3 h-full w-px bg-border"
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-background',
                STATUS_DOTS[a.status],
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {a.service_name}
                </span>
                <StatusChip status={a.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.starts_at, timezone)} · {formatMoney(a.price_pence)}
              </p>
              {reason && <p className="mt-1 text-xs text-status-no-show">{reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
