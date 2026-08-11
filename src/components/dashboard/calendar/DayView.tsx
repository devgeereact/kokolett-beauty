import {
  HOUR_ROW_PX,
  hourLabels,
  hourRange,
  offsetPercent,
} from '@/lib/calendar';
import { formatDateLong, formatTime, minutesSinceMidnight } from '@/lib/format';
import { useNowLine } from '@/hooks/useNowLine';
import { EventBlock } from '@/components/dashboard/calendar/EventBlock';
import { NowLine } from '@/components/dashboard/calendar/NowLine';
import { AgendaList, type AgendaEntry } from '@/components/dashboard/calendar/AgendaList';
import { DayPanel } from '@/components/dashboard/DayPanel';
import type { OwnerDaySlot } from '@/services/availabilityService';
import type { AppointmentDetailed } from '@/types';

export interface DayViewProps {
  date: string;
  today: string;
  timezone: string;
  appointments: AppointmentDetailed[];
  openSlots: OwnerDaySlot[];
  appointmentMinutes: number;
  onSelectAppointment: (appointment: AppointmentDetailed) => void;
  onChanged: () => void;
}

export function DayView({
  date,
  today,
  timezone,
  appointments,
  openSlots,
  appointmentMinutes,
  onSelectAppointment,
  onChanged,
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
  const range = hourRange(allMinutes);
  const labels = hourLabels(range);
  const gridHeight = labels.length * HOUR_ROW_PX;

  const agendaEntries: AgendaEntry[] = [
    ...appointments.map((a) => ({
      key: a.id,
      time: formatTime(a.starts_at, timezone),
      label: a.customer_name ?? 'Customer',
      variant: 'booked' as const,
      status: a.status,
      onClick: () => onSelectAppointment(a),
    })),
    ...freeSlots.map((s) => ({
      key: s.starts_at,
      time: s.local_time,
      label: 'Open',
      variant: 'open' as const,
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  // Same real-<table> structure as WeekView (docs/DESIGN.md §7) — here with
  // exactly one day column, so row 0's single `<td>` spans every hour row.
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_15rem]">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            {formatDateLong(`${date}T12:00:00Z`, 'UTC')}
          </h2>
        </div>

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
                            label={`Open · ${slot.local_time}`}
                            topPercent={offsetPercent(start, range)}
                            heightPercent={
                              offsetPercent(start + 60, range) - offsetPercent(start, range)
                            }
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

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agenda
          </h3>
          <AgendaList entries={agendaEntries} emptyLabel="Nothing on this day yet." />
        </div>

        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Manage published times
          </summary>
          <div className="mt-3">
            <DayPanel
              date={date}
              timezone={timezone}
              appointmentMinutes={appointmentMinutes}
              onChanged={onChanged}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
