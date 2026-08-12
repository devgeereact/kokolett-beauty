import {
  HOUR_ROW_PX,
  hourLabels,
  hourRange,
  offsetPercent,
} from '@/lib/calendar';
import { formatTime, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
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
}

export function DayView({
  date,
  today,
  timezone,
  appointments,
  openSlots,
  onSelectAppointment,
  onSelectOpenSlot,
}: DayViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);
  const isToday = date === today;
  const freeSlots = openSlots.filter((s) => !s.is_booked && !s.is_past);

  const allMinutes = [
    ...appointments.flatMap((a) => [
      minutesSinceMidnight(a.starts_at, timezone),
      minutesSinceMidnight(a.ends_at, timezone),
    ]),
    ...freeSlots.map((s) => minutesSinceMidnight(s.starts_at, timezone)),
  ];
  // See WeekView's identical guard: without "now" in the fitted range, the
  // live line can silently never show on a sparsely-published day.
  if (isToday) allMinutes.push(nowMinutes);
  const range = hourRange(allMinutes);
  const labels = hourLabels(range);
  const gridHeight = labels.length * HOUR_ROW_PX;

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
                    {freeSlots.map((slot) => {
                      const start = minutesSinceMidnight(slot.starts_at, timezone);
                      return (
                        <EventBlock
                          key={slot.starts_at}
                          variant="open"
                          time={slot.local_time}
                          label={`+ Add · ${slot.local_time}`}
                          topPercent={offsetPercent(start, range)}
                          heightPercent={
                            offsetPercent(start + 60, range) - offsetPercent(start, range)
                          }
                          onClick={() => onSelectOpenSlot(slot)}
                        />
                      );
                    })}

                    {appointments.map((appointment) => {
                      const start = minutesSinceMidnight(appointment.starts_at, timezone);
                      const end = minutesSinceMidnight(appointment.ends_at, timezone);
                      return (
                        <EventBlock
                          key={appointment.id}
                          variant="booked"
                          status={appointment.status}
                          time={formatTime(appointment.starts_at, timezone)}
                          label={appointment.customer_name ?? 'Customer'}
                          topPercent={offsetPercent(start, range)}
                          heightPercent={offsetPercent(end, range) - offsetPercent(start, range)}
                          onClick={() => onSelectAppointment(appointment)}
                        />
                      );
                    })}

                    {isToday && nowMinutes >= range.startMin && nowMinutes <= range.endMin && (
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
  );
}
