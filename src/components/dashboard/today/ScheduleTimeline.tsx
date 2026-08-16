import { memo, useEffect, useMemo, useState } from 'react';
import { HOUR_ROW_PX, hourLabels, hourRange, offsetPercent, type HourRange } from '@/lib/calendar';
import { formatTime, minutesSinceMidnight, toSalonDate } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { listDaySlots } from '@/services/availabilityService';
import { listActiveServices } from '@/services/serviceCatalogService';
import type { AppointmentDetailed } from '@/types';

/** "09:30" → 570. */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Today's actual published opening/closing, not a guess from which
 * appointments happen to be booked — a quiet late slot must still show, and
 * a fully-booked early morning must not make the axis start later than the
 * salon really opens. Closing pads the last bookable slot by the longest
 * active service, since that slot can run that long.
 */
function useOpeningHoursRange(timezone: string): HourRange | null {
  const [range, setRange] = useState<HourRange | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = toSalonDate(new Date(), timezone);
    Promise.all([listDaySlots(today), listActiveServices()])
      .then(([slots, services]) => {
        if (cancelled || slots.length === 0) return;
        const starts = slots.map((s) => timeToMinutes(s.local_time)).sort((a, b) => a - b);
        const maxDuration = Math.max(60, ...services.map((s) => s.duration_min));
        const openMin = Math.floor(starts[0]! / 60) * 60;
        const closeMin = Math.min(24 * 60, Math.ceil((starts.at(-1)! + maxDuration) / 60) * 60);
        setRange({ startMin: openMin, endMin: closeMin });
      })
      .catch(() => {
        if (!cancelled) setRange(null);
      });
    return () => {
      cancelled = true;
    };
  }, [timezone]);

  return range;
}

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
      for (let tries = 0; busy.has(CUSTOMER_TINTS[index]!) && tries < CUSTOMER_TINTS.length; tries += 1) {
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
 * Today's schedule as a proportional hour-axis timeline — the same fitted
 * range / positioning math `DayView` uses for the real Calendar page
 * (`@/lib/calendar`'s `hourRange`/`offsetPercent`), rendered with the
 * dashboard's own pastel per-customer block treatment rather than Calendar's
 * neutral `EventBlock` style — a summary widget, not the primary editing
 * surface. Sized to fit the whole day at a fixed hour height — it does not
 * stretch or shrink to match a neighbouring card.
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
  const openingHours = useOpeningHoursRange(timezone);

  const { range, labels, gridHeight } = useMemo(() => {
    // Prefer the day's real published hours; fall back to fitting the
    // booked appointments while that RPC is still in flight.
    const computedRange =
      openingHours ??
      hourRange([
        ...appointments.flatMap((a) => [
          minutesSinceMidnight(a.starts_at, timezone),
          minutesSinceMidnight(a.ends_at, timezone),
        ]),
        nowMinutes,
      ]);
    const computedLabels = hourLabels(computedRange);
    return {
      range: computedRange,
      labels: computedLabels,
      gridHeight: computedLabels.length * HOUR_ROW_PX,
    };
  }, [appointments, timezone, nowMinutes, openingHours]);

  const tints = useMemo(() => assignCustomerTints(appointments), [appointments]);

  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-card">
      <div>
        {labels.map((label) => (
          <div
            key={label}
            style={{ height: HOUR_ROW_PX }}
            className="w-12 pr-2 pt-1 text-right text-[10px] text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div
        className="relative flex-1"
        style={{
          height: gridHeight,
          backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent ${HOUR_ROW_PX - 1}px, var(--border) ${HOUR_ROW_PX - 1}px, var(--border) ${HOUR_ROW_PX}px)`,
        }}
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
