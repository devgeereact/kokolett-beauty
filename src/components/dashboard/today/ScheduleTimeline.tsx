import { type JSX, memo, useMemo } from 'react';
import {
  hourGridlines,
  hourLabels,
  openingHoursRange,
  offsetPercent,
} from '@/lib/calendar';
import { formatTime, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

/**
 * One pastel tint per customer, off the `--tint-chart-*` tokens (docs/
 * DESIGN.md §7: explicit `color-mix()` tokens, not opacity against a
 * `var()` colour) — colour now identifies *who*, status is still visible on
 * its own via the `StatusChip` pill.
 */
const CUSTOMER_TINTS = [
  'bg-tint-chart-1',
  'bg-tint-chart-2',
  'bg-tint-chart-3',
  'bg-tint-chart-4',
  'bg-tint-chart-5',
] as const;

/**
 * Every customer gets their own colour, handed out in the order they first
 * appear today (so a quiet 5-customer day is five different tints, not one
 * repeated) and cycling once there are more customers than tints — but a new
 * customer never gets a colour that's currently running on someone else's
 * open appointment, so two appointments overlapping in time are never the
 * same colour even after the palette wraps.
 */
function assignCustomerTints(appointments: AppointmentDetailed[]): Map<string, string> {
  const sorted = [...appointments].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const customerTint = new Map<string, string>();
  const tintByAppointment = new Map<string, string>();
  const active: { endsAt: string; tint: string }[] = [];
  let nextPaletteIndex = 0;

  for (const appointment of sorted) {
    const key = appointment.customer_id;
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i]!.endsAt <= appointment.starts_at) active.splice(i, 1);
    }
    const busy = new Set(active.map((a) => a.tint));

    let tint = customerTint.get(key);
    if (!tint) {
      let index = nextPaletteIndex % CUSTOMER_TINTS.length;
      for (
        let tries = 0;
        busy.has(CUSTOMER_TINTS[index]!) && tries < CUSTOMER_TINTS.length;
        tries += 1
      ) {
        index = (index + 1) % CUSTOMER_TINTS.length;
      }
      tint = CUSTOMER_TINTS[index]!;
      nextPaletteIndex = index + 1;
      customerTint.set(key, tint);
    } else if (busy.has(tint)) {
      // Same customer, but a different open appointment already holds their
      // usual colour — borrow a free one for this block only.
      tint = CUSTOMER_TINTS.find((t) => !busy.has(t)) ?? tint;
    }

    tintByAppointment.set(appointment.id, tint);
    active.push({ endsAt: appointment.ends_at, tint });
  }

  return tintByAppointment;
}

const TimelineBlock = memo(function TimelineBlock({
  appointment,
  timezone,
  range,
  tint,
  isNextUp,
  expanded,
  onToggle,
}: {
  appointment: AppointmentDetailed;
  timezone: string;
  range: { startMin: number; endMin: number };
  tint: string;
  isNextUp: boolean;
  expanded: boolean;
  onToggle: () => void;
}): JSX.Element {
  const start = minutesSinceMidnight(appointment.starts_at, timezone);
  const end = minutesSinceMidnight(appointment.ends_at, timezone);
  const top = offsetPercent(start, range);
  const height = offsetPercent(end, range) - top;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      style={{ top: `${top}%`, height: `${height}%` }}
      className={cn(
        // z-sticky: above NowLine's z-base, so an opaque block occludes the
        // live time line where they overlap — the line should only ever be
        // visible in an empty gap, never cutting across a block's text.
        'absolute inset-x-1 z-sticky flex flex-col justify-between overflow-hidden rounded-lg',
        'border border-border px-2.5 py-1.5 text-left',
        'transition-colors duration-150 ease-out hover:brightness-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tint,
        // The soonest appointment still to come is called out with a ring
        // rather than a fill override, so it doesn't cost that customer's
        // colour identity.
        isNextUp && 'ring-2 ring-inset ring-primary',
      )}
    >
      <span className="truncate text-sm font-medium text-foreground">
        {appointment.customer_name}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {formatTime(appointment.starts_at, timezone)}
        </span>
        <StatusChip status={appointment.status} className="shrink-0" />
      </div>
    </button>
  );
});

/**
 * Today's schedule as a proportional hour-axis timeline — the same fixed
 * 08:00–20:00 axis and percentage-based positioning `DayView` uses for the
 * real Calendar page (`@/lib/calendar`'s `openingHoursRange`/`offsetPercent`),
 * rendered with the dashboard's own pastel per-customer block treatment
 * rather than Calendar's neutral `EventBlock` style — a summary widget, not
 * the primary editing surface. Stretches to fill whatever height the parent
 * card gives it, same as the Calendar grid does.
 */
export function ScheduleTimeline({
  appointments,
  timezone,
  nextUpId,
  expandedId,
  onToggle,
}: {
  appointments: AppointmentDetailed[];
  timezone: string;
  nextUpId: string | null;
  expandedId: string | null;
  onToggle: (id: string) => void;
}): JSX.Element {
  const nowMinutes = useNowLine(timezone);
  const range = openingHoursRange();
  const labels = hourLabels(range);

  const tints = useMemo(() => assignCustomerTints(appointments), [appointments]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col">
        {labels.map((label) => (
          <div
            key={label}
            className="w-12 flex-1 pr-2 pt-1 text-right text-2xs text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div
        className="relative flex-1"
        style={{ backgroundImage: hourGridlines(labels.length) }}
      >
        {appointments.map((appointment) => (
          <TimelineBlock
            key={appointment.id}
            appointment={appointment}
            timezone={timezone}
            range={range}
            tint={tints.get(appointment.id) ?? CUSTOMER_TINTS[0]}
            isNextUp={appointment.id === nextUpId}
            expanded={expandedId === appointment.id}
            onToggle={() => onToggle(appointment.id)}
          />
        ))}

        {nowMinutes >= range.startMin && nowMinutes <= range.endMin && (
          <NowLine topPercent={offsetPercent(nowMinutes, range)} />
        )}
      </div>
    </div>
  );
}
