import {
  HOUR_ROW_PX,
  dayNumber,
  hourLabels,
  hourRange,
  offsetPercent,
  WEEKDAY_HEADINGS,
} from '@/lib/calendar';
import { formatTime, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
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
}

export function WeekView({
  dates,
  today,
  timezone,
  appointmentsByDate,
  openSlotsByDate,
  onSelectAppointment,
  onSelectDate,
}: WeekViewProps): JSX.Element {
  const nowMinutes = useNowLine(timezone);

  const allMinutes: number[] = [];
  for (const date of dates) {
    for (const a of appointmentsByDate.get(date) ?? []) {
      allMinutes.push(minutesSinceMidnight(a.starts_at, timezone));
      allMinutes.push(minutesSinceMidnight(a.ends_at, timezone));
    }
    for (const s of openSlotsByDate.get(date) ?? []) {
      allMinutes.push(minutesSinceMidnight(s.starts_at, timezone));
    }
  }
  const range = hourRange(allMinutes);
  const labels = hourLabels(range);
  const gridHeight = labels.length * HOUR_ROW_PX;

  /**
   * A real `<table>`, not a `<div>` grid — docs/DESIGN.md §7 requires proper
   * headers on the calendar, not ARIA bolted onto generic elements. Row 0's
   * day cells `rowSpan` the full hour count, so there is exactly one `<td>`
   * per day acting as the positioning container for that day's blocks —
   * later rows contribute only their `<th scope="row">` time label.
   */
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Week of {dates[0]} to {dates[6]}
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-[52px]">
              <span className="sr-only">Time</span>
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
                    {
                      WEEKDAY_HEADINGS[
                        (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
                      ]
                    }
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
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th
                scope="row"
                style={{ height: HOUR_ROW_PX }}
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
                        className="relative"
                        style={{
                          height: gridHeight,
                          backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent ${HOUR_ROW_PX - 1}px, var(--border) ${HOUR_ROW_PX - 1}px, var(--border) ${HOUR_ROW_PX}px)`,
                        }}
                      >
                        {(openSlotsByDate.get(date) ?? [])
                          .filter((s) => !s.is_booked && !s.is_past)
                          .map((slot) => {
                            const start = minutesSinceMidnight(slot.starts_at, timezone);
                            return (
                              <EventBlock
                                key={slot.starts_at}
                                variant="open"
                                time={slot.local_time}
                                label={`Open · ${slot.local_time}`}
                                topPercent={offsetPercent(start, range)}
                                heightPercent={
                                  offsetPercent(start + 60, range) -
                                  offsetPercent(start, range)
                                }
                              />
                            );
                          })}

                        {(appointmentsByDate.get(date) ?? []).map((appointment) => {
                          const start = minutesSinceMidnight(
                            appointment.starts_at,
                            timezone,
                          );
                          const end = minutesSinceMidnight(appointment.ends_at, timezone);
                          return (
                            <EventBlock
                              key={appointment.id}
                              variant="booked"
                              status={appointment.status}
                              time={formatTime(appointment.starts_at, timezone)}
                              label={appointment.customer_name ?? 'Customer'}
                              topPercent={offsetPercent(start, range)}
                              heightPercent={
                                offsetPercent(end, range) - offsetPercent(start, range)
                              }
                              onClick={() => onSelectAppointment(appointment)}
                            />
                          );
                        })}

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
  );
}
