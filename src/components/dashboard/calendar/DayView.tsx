import { memo, useMemo } from 'react';
import {
  CALENDAR_GRID_HEIGHT_CLASS,
  hourGridlines,
  hourLabels,
  openingHoursRange,
  offsetPercent,
  type HourRange,
} from '@/lib/calendar';
import { formatTime, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { useAppointmentDrag, type UseAppointmentDrag } from '@/hooks/useAppointmentDrag';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
import { DragGhost } from '@/components/dashboard/calendar/DragGhost';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { cn } from '@/lib/utils';
import type { OwnerDaySlot } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface DayViewProps {
  date: string;
  today: string;
  timezone: string;
  appointments: AppointmentDetailed[];
  openSlots: OwnerDaySlot[];
  onSelectAppointment: (appointment: AppointmentDetailed) => void;
  onSelectOpenSlot: (slot: OwnerDaySlot) => void;
  /** Reload after a drag successfully reschedules an appointment. */
  onChanged: () => void;
}

const DRAGGABLE_STATUSES = new Set(['confirmed', 'pending_approval']);

/** Same memoization rationale as WeekView's identical pair of components. */
const DayOpenSlotBlock = memo(function DayOpenSlotBlock({
  slot,
  range,
  timezone,
  onSelectOpenSlot,
}: {
  slot: OwnerDaySlot;
  range: HourRange;
  timezone: string;
  onSelectOpenSlot: (slot: OwnerDaySlot) => void;
}): JSX.Element {
  const start = minutesSinceMidnight(slot.starts_at, timezone);
  return (
    <EventBlock
      variant="open"
      time={slot.local_time}
      label={`+ Add · ${slot.local_time}`}
      topPercent={offsetPercent(start, range)}
      heightPercent={offsetPercent(start + 60, range) - offsetPercent(start, range)}
      onClick={() => onSelectOpenSlot(slot)}
    />
  );
});

const DayAppointmentBlock = memo(function DayAppointmentBlock({
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

export function DayView({
  date,
  today,
  timezone,
  appointments,
  openSlots,
  onSelectAppointment,
  onSelectOpenSlot,
  onChanged,
}: DayViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);
  const isToday = date === today;
  const freeSlots = useMemo(
    () => openSlots.filter((s) => !s.is_booked && !s.is_past),
    [openSlots],
  );

  // Fixed 08:00–20:00 axis — doesn't stretch for slots, appointments, or
  // "now", so it's a plain constant rather than something to memoize.
  const range = openingHoursRange();
  const labels = hourLabels(range);

  const drag = useAppointmentDrag(range, timezone, onChanged);

  // Same real-<table> structure as WeekView (docs/DESIGN.md §7's table +
  // agenda requirement stood for the standalone Day view; the owner asked
  // for the Agenda panel removed now that it sits directly beside a full
  // hour grid whose blocks are already real, individually-focusable
  // buttons — so a keyboard/screen-reader user can still reach every
  // appointment and open slot, just not pre-sorted into one chronological
  // list). Exactly one day column, so row 0's single `<td>` spans every
  // hour row. No repeated date heading either — the page header above
  // already shows it.
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
          <caption className="sr-only">Schedule for {date}</caption>
          <tbody className="h-full">
            {labels.map((label, i) => (
              <tr key={label} style={{ height: `${100 / labels.length}%` }}>
                <th
                  scope="row"
                  className="w-[52px] pr-2 text-right align-top text-[10px] font-normal text-muted-foreground"
                >
                  {label}
                </th>
                {i === 0 && (
                  <td
                    data-day-date={date}
                    rowSpan={labels.length}
                    className="relative align-top"
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
                      {freeSlots.map((slot) => (
                        <DayOpenSlotBlock
                          key={slot.starts_at}
                          slot={slot}
                          range={range}
                          timezone={timezone}
                          onSelectOpenSlot={onSelectOpenSlot}
                        />
                      ))}

                      {appointments.map((appointment) => (
                        <DayAppointmentBlock
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
