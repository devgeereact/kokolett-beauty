import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import {
  listAppointments,
  rescheduleAppointmentAsOwner,
} from '@/services/appointmentService';
import { suggestOpenSlots, type OpenSlotSuggestion } from '@/services/assistantService';
import { errorMessage } from '@/lib/errors';
import {
  addDays,
  formatDateShort,
  formatTime,
  salonDayRange,
  toSalonDate,
} from '@/lib/format';
import type { AppointmentDetailed } from '@/types';

/**
 * Real open slots for a chosen appointment, scanned from published
 * availability. Applying one runs the same retire-and-recreate reschedule
 * the calendar's drag and Move panel already use.
 */
export function RescheduleSuggestionsPanel({
  timezone,
}: {
  timezone: string;
}): JSX.Element {
  const [candidates, setCandidates] = useState<AppointmentDetailed[] | null>(null);
  const [candidatesError, setCandidatesError] = useState<Error | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const [suggestions, setSuggestions] = useState<OpenSlotSuggestion[] | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [busyStartsAt, setBusyStartsAt] = useState<string | null>(null);
  const [moved, setMoved] = useState<string | null>(null);

  const loadCandidates = (): void => {
    setCandidatesError(null);
    const today = toSalonDate(new Date(), timezone);
    listAppointments({
      from: new Date(),
      to: salonDayRange(addDays(today, 30), timezone).end,
      statuses: ['confirmed', 'pending_approval'],
    })
      .then(setCandidates)
      .catch((e: unknown) =>
        setCandidatesError(e instanceof Error ? e : new Error(String(e))),
      );
  };

  useEffect(loadCandidates, [timezone]);

  const selected = candidates?.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setSuggestions(null);
      return;
    }
    setSuggestions(null);
    setSuggestionsError(null);
    setMoved(null);
    suggestOpenSlots(toSalonDate(selected.starts_at, timezone), 5)
      .then(setSuggestions)
      .catch((e: unknown) => setSuggestionsError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-runs on selectedId, not the object identity
  }, [selectedId, timezone]);

  const apply = async (suggestion: OpenSlotSuggestion): Promise<void> => {
    if (!selected) return;
    setBusyStartsAt(suggestion.slot.starts_at);
    setSuggestionsError(null);
    try {
      await rescheduleAppointmentAsOwner(
        selected.id,
        new Date(suggestion.slot.starts_at),
      );
      setMoved(suggestion.slot.starts_at);
      loadCandidates();
      setSelectedId('');
    } catch (e) {
      setSuggestionsError(errorMessage(e));
    } finally {
      setBusyStartsAt(null);
    }
  };

  if (candidatesError)
    return <ErrorState error={candidatesError} onRetry={loadCandidates} />;
  if (!candidates) return <LoadingState label="Loading upcoming bookings…" />;
  if (candidates.length === 0) {
    return (
      <EmptyState
        title="Nothing to suggest a move for"
        description="Once you have a confirmed or held booking, pick it here to see the next open times."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <Field label="Which appointment?">
          {({ id }) => (
            <Select
              id={id}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Choose an appointment…</option>
              {candidates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.customer_name ?? 'Customer'} —{' '}
                  {formatDateShort(a.starts_at, timezone)} at{' '}
                  {formatTime(a.starts_at, timezone)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      {moved && (
        <p role="status" className="text-sm font-medium text-status-completed">
          Moved.
        </p>
      )}

      {selected && suggestionsError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {suggestionsError}
        </p>
      )}

      {selected && !suggestions && !suggestionsError && (
        <LoadingState label="Scanning published availability…" />
      )}

      {selected && suggestions && suggestions.length === 0 && (
        <EmptyState
          title="No open times found"
          description="Nothing free in the next 60 days of published availability."
        />
      )}

      {selected && suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <Card
              key={s.slot.starts_at}
              className="flex items-center justify-between gap-3 p-4"
            >
              <p className="font-medium text-foreground">
                {formatDateShort(s.slot.starts_at, timezone)} at {s.slot.local_time}
              </p>
              <Button
                size="sm"
                loading={busyStartsAt === s.slot.starts_at}
                disabled={busyStartsAt !== null}
                onClick={() => void apply(s)}
              >
                Move here
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
