import { type JSX, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Spinner } from '@/components/ui/States';
import { listDaySlots, type OwnerDaySlot } from '@/services/availabilityService';
import { rescheduleAppointmentAsOwner } from '@/services/appointmentService';
import { errorMessage } from '@/lib/errors';
import { toSalonDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

export interface MoveAppointmentPanelProps {
  appointment: AppointmentDetailed;
  timezone: string;
  onClose: () => void;
  onMoved: () => void;
}

/**
 * The keyboard-operable path to a reschedule — no drag required. Picks a
 * date, then one of that date's currently-published free times, same data
 * `DayPanel` already shows the owner for publishing.
 */
export function MoveAppointmentPanel({
  appointment,
  timezone,
  onClose,
  onMoved,
}: MoveAppointmentPanelProps): JSX.Element {
  const [date, setDate] = useState(() => toSalonDate(appointment.starts_at, timezone));
  const [slots, setSlots] = useState<OwnerDaySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OwnerDaySlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setSelected(null);
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
  }, [load]);

  const freeSlots = slots.filter((s) => !s.is_booked && !s.is_past);

  const confirm = async (): Promise<void> => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleAppointmentAsOwner(appointment.id, new Date(selected.starts_at));
      onMoved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-foreground">
          Move {appointment.customer_name ?? 'this appointment'}&rsquo;s time
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <label htmlFor="move-date" className="mb-1 block text-xs text-muted-foreground">
        New date
      </label>
      <DatePicker id="move-date" value={date} onChange={setDate} className="mb-4" />

      {loading && <Spinner className="h-4 w-4" />}

      {!loading && freeSlots.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          No published times on this day yet.
        </p>
      )}

      {!loading && freeSlots.length > 0 && (
        <ul className="mb-4 grid grid-cols-3 gap-1.5 md:grid-cols-4">
          {freeSlots.map((slot) => (
            <li key={slot.starts_at}>
              <button
                type="button"
                onClick={() => setSelected(slot)}
                aria-pressed={selected?.starts_at === slot.starts_at}
                className={cn(
                  'w-full rounded-md border px-1 py-2 font-mono text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected?.starts_at === slot.starts_at
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary',
                )}
              >
                {slot.local_time}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button
        size="sm"
        loading={busy}
        disabled={!selected || busy}
        onClick={() => void confirm()}
      >
        Confirm move
      </Button>
    </Card>
  );
}
