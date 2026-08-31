import { type JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import {
  copyDaySlots,
  listDaySlots,
  setDaySlots,
  type OwnerDaySlot,
} from '@/services/availabilityService';
import { errorMessage } from '@/lib/errors';
import { addDays, formatDateLong } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One day's times.
 *
 * The entire availability model lives on this panel: a list of start times, and
 * the two things you can do to it. Everything that used to sit here — weekly
 * hours, custom windows, closures, blocked time — is gone. A time you have not
 * published cannot be booked, so "blocking out" an hour is simply not putting
 * it on the list.
 *
 * A booked time cannot be deleted. Removing it would not tell the customer, and
 * the slot is not really free — the appointment is what matters, and it is
 * cancelled from the appointment, not from here.
 */

/** Common patterns, because typing eight times one by one is nobody's idea of a morning. */
const QUICK_FILLS: { label: string; from: string; to: string; every: number }[] = [
  { label: 'Morning · 09:00 to 13:00', from: '09:00', to: '13:00', every: 60 },
  { label: 'Afternoon · 13:00 to 17:00', from: '13:00', to: '17:00', every: 60 },
  { label: 'Full day · 09:00 to 17:00', from: '09:00', to: '17:00', every: 60 },
  { label: 'Evening · 17:00 to 20:00', from: '17:00', to: '20:00', every: 60 },
];

function buildTimes(from: string, to: string, everyMinutes: number): string[] {
  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const out: string[] = [];
  for (let m = toMinutes(from); m < toMinutes(to); m += everyMinutes) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    );
  }
  return out;
}

export function DayPanel({
  date,
  timezone,
  appointmentMinutes,
  onChanged,
}: {
  date: string;
  timezone: string;
  appointmentMinutes: number;
  onChanged: () => void;
}): JSX.Element {
  const [slots, setSlots] = useState<OwnerDaySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('09:00');
  const [copyFrom, setCopyFrom] = useState('');
  const [fill, setFill] = useState({ from: '09:00', to: '17:00', every: '60' });
  const [showFill, setShowFill] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setSlots(await listDaySlots(date));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
    setCopyFrom(addDays(date, -7));
    setError(null);
  }, [load, date]);

  const times = useMemo(() => slots.map((s) => s.local_time), [slots]);
  const bookedTimes = useMemo(
    () => new Set(slots.filter((s) => s.is_booked).map((s) => s.local_time)),
    [slots],
  );

  /** Every write goes through here: build the whole list, send it, reload. */
  const commit = useCallback(
    async (next: string[]): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        const unique = [...new Set([...next, ...bookedTimes])].sort();
        await setDaySlots(date, unique);
        await load();
        onChanged();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [date, bookedTimes, load, onChanged],
  );

  const addTime = (): void => {
    if (times.includes(newTime)) {
      setError(`${newTime} is already on the list.`);
      return;
    }
    void commit([...times, newTime]);
  };

  const removeTime = (slot: OwnerDaySlot): void => {
    if (slot.is_booked) return;
    void commit(times.filter((t) => t !== slot.local_time));
  };

  const clearDayMessage = (): string => {
    const keeping = bookedTimes.size;
    return keeping
      ? `Remove the ${times.length - keeping} free times? The ${keeping} booked one${keeping === 1 ? '' : 's'} stay.`
      : 'Remove every time on this day?';
  };

  const clearDay = (): void => {
    setConfirmingClear(true);
  };

  const applyFill = (from: string, to: string, every: number): void => {
    const built = buildTimes(from, to, every);
    if (built.length === 0) {
      setError('That range does not produce any times.');
      return;
    }
    void commit([...new Set([...times, ...built])]);
    setShowFill(false);
  };

  const copy = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await copyDaySlots(copyFrom, date);
      await load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const freeCount = slots.filter((s) => !s.is_booked && !s.is_past).length;

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          {formatDateLong(`${date}T12:00:00Z`, 'UTC')}
        </h2>
        {loading && <Spinner className="h-4 w-4" />}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {slots.length === 0
          ? 'No times published, so nothing can be booked.'
          : `${slots.length} time${slots.length === 1 ? '' : 's'} · ${freeCount} still free`}
      </p>

      {slots.length > 0 && (
        <ul className="mb-4 grid grid-cols-3 gap-1.5 md:grid-cols-4">
          {slots.map((slot) => (
            <li key={slot.starts_at}>
              <button
                type="button"
                disabled={busy || slot.is_booked}
                onClick={() => removeTime(slot)}
                title={
                  slot.is_booked
                    ? `Booked: ${slot.customer_name ?? ''} (${slot.reference ?? ''}). Cancel it from Appointments.`
                    : 'Click to remove this time'
                }
                className={cn(
                  'group relative w-full rounded-md border px-1 py-2 font-mono text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  slot.is_booked &&
                    'cursor-not-allowed border-status-confirmed bg-muted text-muted-foreground',
                  !slot.is_booked &&
                    slot.is_past &&
                    'border-border bg-muted text-muted-foreground',
                  !slot.is_booked &&
                    !slot.is_past &&
                    'border-border bg-card text-foreground hover:border-destructive hover:text-destructive',
                )}
              >
                {slot.local_time}
                {slot.is_booked && (
                  <span className="block truncate text-2xs font-sans font-medium text-status-confirmed">
                    {slot.customer_name?.split(' ')[0] ?? 'Booked'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {slots.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Click a time to remove it. Booked times can only be freed by cancelling the
          appointment.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <div className="flex-1">
          <label htmlFor="new-time" className="mb-1 block text-xs text-muted-foreground">
            Add a time
          </label>
          <Input
            id="new-time"
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
        </div>
        <Button size="sm" loading={busy} onClick={addTime}>
          Add
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowFill((v) => !v)}>
          Fill a range
        </Button>
        {slots.length > 0 && (
          <Button variant="ghost" size="sm" loading={busy} onClick={clearDay}>
            Clear day
          </Button>
        )}
      </div>

      {showFill && (
        <div className="mt-3 rounded-md border border-border bg-muted p-3">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {QUICK_FILLS.map((q) => (
              <button
                key={q.label}
                type="button"
                disabled={busy}
                onClick={() => applyFill(q.from, q.to, q.every)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor="fill-from"
                className="mb-1 block text-xs text-muted-foreground"
              >
                From
              </label>
              <Input
                id="fill-from"
                type="time"
                value={fill.from}
                onChange={(e) => setFill({ ...fill, from: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="fill-to"
                className="mb-1 block text-xs text-muted-foreground"
              >
                To
              </label>
              <Input
                id="fill-to"
                type="time"
                value={fill.to}
                onChange={(e) => setFill({ ...fill, to: e.target.value })}
              />
            </div>
            <div className="w-28">
              <label
                htmlFor="fill-every"
                className="mb-1 block text-xs text-muted-foreground"
              >
                Every
              </label>
              <Select
                id="fill-every"
                value={fill.every}
                onChange={(e) => setFill({ ...fill, every: e.target.value })}
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">1½ hours</option>
                <option value="120">2 hours</option>
              </Select>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            An appointment takes {appointmentMinutes} minutes, so spacing times closer
            than that means only one of them can actually be taken.
          </p>
          <Button
            size="sm"
            className="mt-2 w-full"
            loading={busy}
            onClick={() => applyFill(fill.from, fill.to, Number(fill.every))}
          >
            Add these times
          </Button>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <label htmlFor="copy-from" className="mb-1 block text-xs text-muted-foreground">
          Copy times from another day
        </label>
        <div className="flex items-center gap-2">
          <DatePicker id="copy-from" value={copyFrom} onChange={setCopyFrom} />
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void copy()}>
            Copy
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Replaces this day&rsquo;s times. All times shown in {timezone}.
        </p>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title="Clear this day?"
        message={clearDayMessage()}
        tone="destructive"
        confirmLabel="Clear day"
        onConfirm={() => {
          setConfirmingClear(false);
          void commit([]);
        }}
        onCancel={() => setConfirmingClear(false)}
      />
    </Card>
  );
}
