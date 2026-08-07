import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import {
  addDaySlot,
  clearDaySlots,
  listOwnerDaySlots,
  materialiseDaySlots,
  removeDaySlot,
  type OwnerDaySlot,
} from '@/services/availabilityService';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type { Service } from '@/types';

/**
 * The day's actual start times: what exists, what is taken, what can be added
 * or deleted.
 *
 * Slot length comes from the service, so the grid is always shown relative to
 * one — 14:00 can be free for a trim and busy for a colour, and pretending
 * otherwise would make the grid lie about half the day.
 *
 * Two kinds of slot appear here:
 *   window   — produced by the day's opening hours
 *   explicit — published on its own, and independently deletable
 *
 * A window slot cannot be deleted individually, because it is not a row —
 * it is computed. Rather than silently rewriting the day's hours underneath
 * her, the first delete offers to switch the day to exact times, which freezes
 * what is showing into an editable list.
 */
export function DaySlots({
  date,
  services,
  onChanged,
}: {
  date: string;
  services: Service[];
  onChanged: () => void;
}): JSX.Element {
  const [serviceId, setServiceId] = useState<string>('');
  const [slots, setSlots] = useState<OwnerDaySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTime, setNewTime] = useState('18:00');
  const [error, setError] = useState<string | null>(null);
  const [offerFreeze, setOfferFreeze] = useState(false);

  useEffect(() => {
    if (!serviceId && services.length > 0) setServiceId(services[0]?.id ?? '');
  }, [services, serviceId]);

  const load = useCallback(async (): Promise<void> => {
    if (!serviceId) return;
    setLoading(true);
    try {
      setSlots(await listOwnerDaySlots(date, serviceId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [date, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAll = async (): Promise<void> => {
    await load();
    onChanged();
  };

  const add = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await addDaySlot(date, newTime);
      await refreshAll();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slot: OwnerDaySlot): Promise<void> => {
    setBusy(true);
    setError(null);
    setOfferFreeze(false);
    try {
      const removed = await removeDaySlot(date, slot.local_time);
      if (!removed) {
        // It came from the opening hours, so there was no row to delete.
        setOfferFreeze(true);
        return;
      }
      await refreshAll();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const freeze = async (): Promise<void> => {
    setBusy(true);
    try {
      await materialiseDaySlots(date, serviceId);
      setOfferFreeze(false);
      await refreshAll();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async (): Promise<void> => {
    if (!window.confirm('Remove every time you published for this day?')) return;
    setBusy(true);
    try {
      await clearDaySlots(date);
      await refreshAll();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const explicitCount = slots.filter((s) => s.source === 'explicit').length;
  const freeCount = slots.filter((s) => !s.is_booked && !s.is_past).length;

  if (services.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-display text-base font-semibold text-foreground">
          Time slots
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a service first — slot length comes from the service, so there is nothing to
          show until one exists.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-foreground">
          Time slots
        </h3>
        {loading && <Spinner className="h-4 w-4" />}
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {freeCount} bookable · {slots.length} in total
      </p>

      <label htmlFor="slot-service" className="mb-1 block text-xs text-muted-foreground">
        Shown for
      </label>
      <Select
        id="slot-service"
        className="mb-4"
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.duration_min}m
          </option>
        ))}
      </Select>

      {slots.length === 0 && !loading ? (
        <p className="mb-4 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing bookable this day. Add a time below, or set opening hours above.
        </p>
      ) : (
        <ul className="mb-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {slots.map((slot) => {
            const state = slot.is_booked ? 'booked' : slot.is_past ? 'past' : 'free';
            return (
              <li key={slot.starts_at}>
                <button
                  type="button"
                  disabled={busy || slot.is_booked}
                  onClick={() => void remove(slot)}
                  title={
                    slot.is_booked
                      ? `Booked — ${slot.customer_name ?? ''} (${slot.reference ?? ''})`
                      : slot.source === 'explicit'
                        ? 'Published time. Click to delete.'
                        : 'From your opening hours. Click to switch this day to exact times.'
                  }
                  className={cn(
                    'w-full rounded-md border px-1 py-2 font-mono text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    state === 'booked' &&
                      'cursor-not-allowed border-border bg-muted text-muted-foreground line-through',
                    state === 'past' && 'border-border bg-muted text-muted-foreground',
                    state === 'free' &&
                      'border-border bg-card text-foreground hover:border-destructive',
                    slot.source === 'explicit' && state === 'free' && 'border-primary',
                  )}
                >
                  {slot.local_time}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full border border-primary align-middle"
            aria-hidden="true"
          />
          published on its own
        </span>
        <span>struck through = booked</span>
        <span>grey = already passed</span>
      </p>

      {offerFreeze && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-border bg-muted p-3 text-sm"
        >
          <p className="font-medium text-foreground">That time comes from your hours</p>
          <p className="mt-1 text-muted-foreground">
            It is not a slot you added, so there is nothing to delete. Switch this day to
            exact times and the {slots.length} times showing become an editable list you
            can remove from one by one.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void freeze()}>
              Switch to exact times
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOfferFreeze(false)}>
              Leave it
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <div className="flex-1">
          <label htmlFor="new-slot" className="mb-1 block text-xs text-muted-foreground">
            Publish a time
          </label>
          <Input
            id="new-slot"
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
        </div>
        <Button size="sm" loading={busy} onClick={() => void add()}>
          Add slot
        </Button>
      </div>

      {explicitCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          loading={busy}
          onClick={() => void clearAll()}
        >
          Clear the {explicitCount} time{explicitCount === 1 ? '' : 's'} I published
        </Button>
      )}
    </Card>
  );
}
