import { memo, useMemo } from 'react';
import {
  HOUR_ROW_PX,
  hourLabels,
  hourRange,
  offsetPercent,
  type HourRange,
} from '@/lib/calendar';
import { formatTime, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { useAppointmentDrag, type UseAppointmentDrag } from '@/hooks/useAppointmentDrag';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
import { DragGhost } from '@/components/dashboard/calendar/DragGhost';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
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

  // See WeekView's identical memo: this only needs to recompute when the
  // real inputs change, not on every drag pointermove — drag.preview isn't a
  // dependency, so DayAppointmentBlock/DayOpenSlotBlock get a stable `range`
  // reference during a drag and correctly skip re-rendering. nowMinutes
  // stays a real dependency — see WeekView's identical guard: without "now"
  // in the fitted range, the live line can silently never show on a
  // sparsely-published day.
  const { range, labels, gridHeight } = useMemo(() => {
    const allMinutes = [
      ...appointments.flatMap((a) => [
        minutesSinceMidnight(a.starts_at, timezone),
        minutesSinceMidnight(a.ends_at, timezone),
      ]),
      ...freeSlots.map((s) => minutesSinceMidnight(s.starts_at, timezone)),
    ];
    if (isToday) allMinutes.push(nowMinutes);
    const computedRange = hourRange(allMinutes);
    const computedLabels = hourLabels(computedRange);
    return {
      range: computedRange,
      labels: computedLabels,
      gridHeight: computedLabels.length * HOUR_ROW_PX,
    };
  }, [appointments, freeSlots, timezone, isToday, nowMinutes]);

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
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Schedule for {date}</caption>
          <tbody>
            {labels.map((label, i) => (
              <tr key={label}>
                <th
                  scope="row"
                  style={{ height: HOUR_ROW_PX }}
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
                      className="relative"
                      style={{
                        height: gridHeight,
                        backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent ${HOUR_ROW_PX - 1}px, var(--border) ${HOUR_ROW_PX - 1}px, var(--border) ${HOUR_ROW_PX}px)`,
                      }}
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
