import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { DayEditor } from '@/components/dashboard/DayEditor';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import {
  deleteException,
  listExceptionsBetween,
  listRules,
} from '@/services/availabilityService';
import { listAppointments } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import {
  formatDateLong,
  formatMoney,
  formatTime,
  salonDayRange,
  toSalonDate,
  trimSeconds,
} from '@/lib/format';
import {
  dayNumber,
  dayOfWeek,
  gridRange,
  isSameMonth,
  monthGrid,
  monthLabel,
  shiftMonth,
  WEEKDAY_HEADINGS,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { LIVE_STATUSES } from '@/types';
import type {
  AppointmentDetailed,
  AvailabilityException,
  AvailabilityRule,
} from '@/types';

/**
 * The month calendar: what is open, what is booked, and where availability can
 * be changed.
 *
 * Availability is edited *per day* here rather than per weekday, because that
 * is how the owner actually thinks about it — "I can't do next Thursday" is a
 * date, not a rule. Standing weekly hours stay on the Opening hours screen.
 */
export function CalendarPage(): JSX.Element {
  const { timezone } = useBusinessSettings();
  const today = toSalonDate(new Date(), timezone);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [selected, setSelected] = useState<string>(today);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const range = useMemo(() => gridRange(cursor.year, cursor.month), [cursor]);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [r, e, a] = await Promise.all([
        listRules(),
        listExceptionsBetween(range.from, range.to),
        listAppointments({
          from: salonDayRange(range.from, timezone).start,
          to: salonDayRange(range.to, timezone).end,
          statuses: [...LIVE_STATUSES],
        }),
      ]);
      setRules(r);
      setExceptions(e);
      setAppointments(a);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Everything known about one date, assembled once per render. */
  const dayInfo = useCallback(
    (date: string) => {
      const dow = dayOfWeek(date);
      const dayExceptions = exceptions.filter((e) => e.on_date === date);
      const fullClosure = dayExceptions.find(
        (e) => e.kind === 'closure' && e.starts_at === null,
      );
      const extraHours = dayExceptions.filter((e) => e.kind === 'extra_hours');
      const standing = rules.filter((r) => r.day_of_week === dow && r.is_open);
      const booked = appointments.filter(
        (a) => toSalonDate(a.starts_at, timezone) === date,
      );

      const windows = fullClosure
        ? []
        : [
            ...standing.map(
              (r) => `${trimSeconds(r.opens_at)}–${trimSeconds(r.closes_at)}`,
            ),
            ...extraHours.map(
              (e) => `${trimSeconds(e.starts_at ?? '')}–${trimSeconds(e.ends_at ?? '')}`,
            ),
          ];

      return { dayExceptions, fullClosure, windows, booked, isOpen: windows.length > 0 };
    },
    [appointments, exceptions, rules, timezone],
  );

  const selectedInfo = dayInfo(selected);

  const removeException = async (id: string): Promise<void> => {
    try {
      await deleteException(id);
      await load();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  };

  return (
    <DashboardLayout
      title="Calendar"
      subtitle="What is open, what is booked, and when you are available"
      actions={
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
              setSelected(today);
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next month"
            onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}
          >
            ›
          </Button>
        </div>
      }
    >
      {error && <ErrorState error={error} onRetry={() => void load()} />}
      {loading && appointments.length === 0 && <LoadingState label="Loading calendar…" />}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {monthLabel(cursor.year, cursor.month)}
            </h2>
            <p className="text-xs text-muted-foreground">All times {timezone}</p>
          </div>

          <div className="grid grid-cols-7 border-b border-border bg-muted">
            {WEEKDAY_HEADINGS.map((heading) => (
              <div
                key={heading}
                className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {heading}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {weeks.flat().map((date) => {
              const info = dayInfo(date);
              const inMonth = isSameMonth(date, cursor.year, cursor.month);
              const isToday = date === today;
              const isSelected = date === selected;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  aria-current={isToday ? 'date' : undefined}
                  aria-pressed={isSelected}
                  className={cn(
                    'min-h-24 border-b border-r border-border p-2 text-left align-top',
                    'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    inMonth ? 'bg-card' : 'bg-muted',
                    isSelected && 'ring-2 ring-inset ring-primary',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm',
                      isToday
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {dayNumber(date)}
                  </span>

                  {inMonth && (
                    <span className="mt-1 block">
                      {info.isOpen ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {info.windows[0]}
                          {info.windows.length > 1 ? ` +${info.windows.length - 1}` : ''}
                        </span>
                      ) : (
                        <span className="block text-xs text-muted-foreground">
                          Closed
                        </span>
                      )}

                      {info.booked.length > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-status-confirmed"
                            aria-hidden="true"
                          />
                          {info.booked.length}
                        </span>
                      )}

                      {info.dayExceptions.some((e) => e.kind === 'break') && (
                        <span className="mt-1 block text-xs text-status-pending">
                          Break
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {formatDateLong(`${selected}T12:00:00Z`, 'UTC')}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {selectedInfo.isOpen
                ? `Bookable ${selectedInfo.windows.join(', ')}`
                : 'Nothing bookable'}
            </p>
          </Card>

          <DayEditor
            date={selected}
            rules={rules}
            exceptions={exceptions.filter((e) => e.on_date === selected)}
            onSaved={() => void load()}
            onRemoveBreak={removeException}
          />

          <Card className="p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-foreground">
              Booked ({selectedInfo.booked.length})
            </h3>
            {selectedInfo.booked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing booked this day.</p>
            ) : (
              <ul className="space-y-2">
                {selectedInfo.booked.map((a) => (
                  <li
                    key={a.id}
                    className="border-b border-border pb-2 text-sm last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium text-foreground">
                        {formatTime(a.starts_at, timezone)}
                      </span>
                      <StatusChip status={a.status} />
                    </div>
                    <p className="text-muted-foreground">
                      {a.customer_name} · {a.service_name} · {formatMoney(a.price_pence)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
