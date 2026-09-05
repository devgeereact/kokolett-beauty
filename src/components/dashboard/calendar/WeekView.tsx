import { type JSX, memo } from 'react';
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
  onSelectAppointment,
  onSelectDate,
  onSelectOpenSlot,
  onChanged,
}: WeekViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);

  // Fixed 08:00–20:00 axis — doesn't stretch for slots, appointments, or
  // "now", so it's a plain constant rather than something to memoize.
  const range = openingHoursRange();
  const labels = hourLabels(range);

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
      {/* `drag.busy` was returned by the hook and rendered by nobody. On
          release the ghost disappears and the block snaps back to where it
          started until the reschedule round trip and the refetch complete, so
          on salon wifi a successful drag looks like one that did not take, and
          the natural response is to drag it again: a second reschedule of the
          same appointment. */}
      {drag.busy && (
        <p role="status" className="mb-3 text-sm font-medium text-muted-foreground">
          Moving the appointment...
        </p>
      )}
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-md border border-border/60 bg-card',
          CALENDAR_GRID_HEIGHT_CLASS,
        )}
      >
        <table className="h-full w-full border-collapse text-sm">
          <caption className="sr-only">
            Week of {dates[0]} to {dates[6]}. Select a day heading, or switch to Day view,
            for a full list of that day&apos;s times.
          </caption>
          <thead>
            <tr className="border-b border-border/50">
              <th scope="col" className="w-[52px] py-2.5 text-center">
                <span className="text-2xs font-medium text-muted-foreground">Time</span>
                <span className="block text-2xs text-muted-foreground">
                  {gmtOffsetLabel(timezone)}
                </span>
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  scope="col"
                  className="border-l border-border/40 py-2.5 text-center font-medium"
                >
                  <button
                    type="button"
                    onClick={() => onSelectDate(date)}
                    className={cn(
                      'flex w-full flex-col items-center gap-0.5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <span className="text-2xs font-medium text-muted-foreground">
                      {WEEKDAY_HEADINGS[(dayOfWeek(date) + 6) % 7]}
                    </span>
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-base',
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
                  className="pr-2 text-right align-top text-2xs font-normal text-muted-foreground"
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
                        className="relative border-l border-border/40 align-top"
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
