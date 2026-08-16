import { memo, useMemo } from 'react';
import {
  CALENDAR_GRID_HEIGHT_CLASS,
  dayNumber,
  dayOfWeek,
  hourGridlines,
  hourLabels,
  openingHoursRange,
  offsetPercent,
  WEEKDAY_HEADINGS,
  type HourRange,
} from '@/lib/calendar';
import { formatTime, gmtOffsetLabel, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { useAppointmentDrag, type UseAppointmentDrag } from '@/hooks/useAppointmentDrag';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
import { DragGhost } from '@/components/dashboard/calendar/DragGhost';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { cn } from '@/lib/utils';
import type { OwnerDaySlot } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface WeekViewProps {
  dates: string[];
  today: string;
  timezone: string;
  appointmentsByDate: Map<string, AppointmentDetailed[]>;
  openSlotsByDate: Map<string, OwnerDaySlot[]>;
  /** Longest active service's duration, in minutes — pads the axis close time. */
  maxServiceDurationMin: number;
  onSelectAppointment: (appointment: AppointmentDetailed) => void;
  onSelectDate: (date: string) => void;
  onSelectOpenSlot: (date: string, slot: OwnerDaySlot) => void;
  /** Reload after a drag successfully reschedules an appointment. */
  onChanged: () => void;
}

const DRAGGABLE_STATUSES = new Set(['confirmed', 'pending_approval']);

/**
 * Memoized so a drag pointermove or the 30s now-line tick — both of which
 * re-render the whole `WeekView` — skip every open-slot block whose own
 * props (date, slot, range) haven't actually changed. `onSelectOpenSlot` is
 * this component's own prop, not baked into an inline closure at the call
 * site, so its identity only changes when `WeekView`'s own `onSelectOpenSlot`
 * prop changes.
 */
const WeekOpenSlotBlock = memo(function WeekOpenSlotBlock({
  date,
  slot,
  range,
  timezone,
  onSelectOpenSlot,
}: {
  date: string;
  slot: OwnerDaySlot;
  range: HourRange;
  timezone: string;
  onSelectOpenSlot: (date: string, slot: OwnerDaySlot) => void;
}): JSX.Element {
  const start = minutesSinceMidnight(slot.starts_at, timezone);
  return (
    <EventBlock
      variant="open"
      time={slot.local_time}
      label={`+ Add · ${slot.local_time}`}
      topPercent={offsetPercent(start, range)}
      heightPercent={offsetPercent(start + 60, range) - offsetPercent(start, range)}
      onClick={() => onSelectOpenSlot(date, slot)}
    />
  );
});

/** Same memoization rationale as `WeekOpenSlotBlock`, for booked blocks. */
const WeekAppointmentBlock = memo(function WeekAppointmentBlock({
  appointment,
  date,
  range,
  timezone,
  onSelectAppointment,
  beginDrag,
}: {
  appointment: AppointmentDetailed;
  date: string;
  range: HourRange;
  timezone: string;
  onSelectAppointment: (appointment: AppointmentDetailed) => void;
  beginDrag: UseAppointmentDrag['beginDrag'];
}): JSX.Element {
  const start = minutesSinceMidnight(appointment.starts_at, timezone);
  const end = minutesSinceMidnight(appointment.ends_at, timezone);
  const draggable = DRAGGABLE_STATUSES.has(appointment.status);
  return (
    <EventBlock
      variant="booked"
      status={appointment.status}
      time={formatTime(appointment.starts_at, timezone)}
      label={appointment.customer_name ?? 'Customer'}
      topPercent={offsetPercent(start, range)}
      heightPercent={offsetPercent(end, range) - offsetPercent(start, range)}
      onClick={() => onSelectAppointment(appointment)}
      draggable={draggable}
      onPointerDown={
        draggable
          ? (e) => {
              const columnEl = e.currentTarget.closest('td');
              if (columnEl) {
                beginDrag(e, appointment, date, columnEl, () =>
                  onSelectAppointment(appointment),
                );
              }
            }
          : undefined
      }
    />
  );
});

export function WeekView({
  dates,
  today,
  timezone,
  appointmentsByDate,
  openSlotsByDate,
  maxServiceDurationMin,
  onSelectAppointment,
  onSelectDate,
  onSelectOpenSlot,
  onChanged,
}: WeekViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);

  // Memoized so drag.preview changes (the highest-frequency re-render
  // trigger, firing on every pointermove) don't rebuild this array or hand
  // WeekAppointmentBlock/WeekOpenSlotBlock a new `range` object on every
  // frame — drag.preview isn't a dependency here, so during a drag this
  // returns the same object reference and those memoized blocks correctly
  // skip re-rendering. nowMinutes stays a real dependency (not just for
  // cache-busting): the live "now" line needs the axis to actually widen to
  // cover the current time as the day goes on, or it can silently stop
  // appearing once "now" drifts outside a range fitted at mount.
  //
  // Fitted to published slot times (any status — a booked slot's start is
  // still real evidence the salon is open then), not to appointment times —
  // an appointment sitting outside currently-published hours (a legacy row,
  // a demo artifact) doesn't get to stretch the whole week's grid to cover
  // it; it still renders, just clamped to the nearest edge.
  const { range, labels } = useMemo(() => {
    const slotStartMinutes: number[] = [];
    for (const date of dates) {
      for (const s of openSlotsByDate.get(date) ?? []) {
        slotStartMinutes.push(minutesSinceMidnight(s.starts_at, timezone));
      }
    }
    // The live "now" line needs the axis to actually cover the current time
    // — otherwise a day with only sparse published slots can auto-fit a
    // range that excludes "now" entirely, and the line silently never
    // appears.
    const computedRange = openingHoursRange(
      slotStartMinutes,
      maxServiceDurationMin,
      dates.includes(today) ? nowMinutes : undefined,
    );
    return { range: computedRange, labels: hourLabels(computedRange) };
  }, [dates, openSlotsByDate, maxServiceDurationMin, timezone, today, nowMinutes]);

  const drag = useAppointmentDrag(range, timezone, onChanged);

  /**
   * A real `<table>`, not a `<div>` grid — docs/DESIGN.md §7 requires proper
   * headers on the calendar, not ARIA bolted onto generic elements. Row 0's
   * day cells `rowSpan` the full hour count, so there is exactly one `<td>`
   * per day acting as the positioning container for that day's blocks —
   * later rows contribute only their `<th scope="row">` time label.
   */
  return (
    <div>
      {drag.error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {drag.error}{' '}
          <button type="button" onClick={drag.dismissError} className="underline">
            Dismiss
          </button>
        </p>
      )}
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-md border border-border bg-card',
          CALENDAR_GRID_HEIGHT_CLASS,
        )}
      >
        <table className="w-full flex-1 border-collapse text-sm">
          <caption className="sr-only">
            Week of {dates[0]} to {dates[6]}. Select a day heading, or switch to Day view,
            for a full list of that day&apos;s times.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-[52px] py-2.5 text-center">
                <span className="text-[11px] font-medium text-muted-foreground">Time</span>
                <span className="block text-[10px] text-muted-foreground">
                  {gmtOffsetLabel(timezone)}
                </span>
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  scope="col"
                  className="border-l border-border py-2.5 text-center font-medium"
                >
                  <button
                    type="button"
                    onClick={() => onSelectDate(date)}
                    className={cn(
                      'flex w-full flex-col items-center gap-0.5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {WEEKDAY_HEADINGS[(dayOfWeek(date) + 6) % 7]}
                    </span>
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[15px]',
                        date === today
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'text-foreground',
                      )}
                    >
                      {dayNumber(date)}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="h-full">
            {labels.map((label, i) => (
              <tr key={label} style={{ height: `${100 / labels.length}%` }}>
                <th
                  scope="row"
                  className="pr-2 text-right align-top text-[10px] font-normal text-muted-foreground"
                >
                  {label}
                </th>
                {i === 0 &&
                  dates.map((date) => {
                    const isToday = date === today;
                    return (
                      <td
                        key={date}
                        data-day-date={date}
                        rowSpan={labels.length}
                        className="relative border-l border-border align-top"
                        style={
                          isToday
                            ? {
                                backgroundColor:
                                  'color-mix(in srgb, var(--primary) 4%, transparent)',
                              }
                            : undefined
                        }
                      >
                        <div
                          className="absolute inset-0"
                          style={{ backgroundImage: hourGridlines(labels.length) }}
                        >
                          {(openSlotsByDate.get(date) ?? [])
                            .filter((s) => !s.is_booked && !s.is_past)
                            .map((slot) => (
                              <WeekOpenSlotBlock
                                key={slot.starts_at}
                                date={date}
                                slot={slot}
                                range={range}
                                timezone={timezone}
                                onSelectOpenSlot={onSelectOpenSlot}
                              />
                            ))}

                          {(appointmentsByDate.get(date) ?? []).map((appointment) => (
                            <WeekAppointmentBlock
                              key={appointment.id}
                              appointment={appointment}
                              date={date}
                              range={range}
                              timezone={timezone}
                              onSelectAppointment={onSelectAppointment}
                              beginDrag={drag.beginDrag}
                            />
                          ))}

                          {drag.preview && drag.preview.date === date && (
                            <DragGhost
                              label={`Move here · ${String(Math.floor(drag.preview.minutes / 60)).padStart(2, '0')}:${String(drag.preview.minutes % 60).padStart(2, '0')}`}
                              topPercent={offsetPercent(drag.preview.minutes, range)}
                              heightPercent={
                                offsetPercent(
                                  drag.preview.minutes + drag.preview.durationMin,
                                  range,
                                ) - offsetPercent(drag.preview.minutes, range)
                              }
                            />
                          )}

                          {isToday &&
                            nowMinutes >= range.startMin &&
                            nowMinutes <= range.endMin && (
                              <NowLine topPercent={offsetPercent(nowMinutes, range)} />
                            )}
                        </div>
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
