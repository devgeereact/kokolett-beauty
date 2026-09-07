import { type JSX, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useAvailability } from '@/hooks/useAvailability';
import { useServices } from '@/hooks/useServices';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { formatDateLong } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CardHeading } from '@/components/ui/Card';

/**
 * Choosing a new time for an existing booking.
 *
 * The customer keeps their current appointment the whole way through — nothing
 * is given up until they confirm a replacement, and if somebody takes the new
 * time first the move fails and the original stands. That is the point of
 * having reschedule at all rather than telling people to cancel and rebook.
 *
 * The time they currently hold is shown but not selectable: picking it would be
 * a move to nowhere, and the database refuses it anyway.
 */
export function ReschedulePicker({
  currentStartsAt,
  onChoose,
  onCancel,
  busy,
  error,
}: {
  currentStartsAt: string;
  onChoose: (startsAt: string) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}): JSX.Element {
  const { services } = useServices();
  const { timezone } = useBusinessSettings();
  const { slotsByDate, openDates, loading, isEmpty } = useAvailability(
    services[0]?.duration_min ?? 60,
  );
  const [openDate, setOpenDate] = useState<string | null>(null);

  const activeDate = openDate ?? openDates[0] ?? null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <CardHeading
        as="h3"
        size="compact"
        title="Pick a new time"
        description="You keep your current appointment until you choose one of these."
      />

      {loading && <LoadingState label="Finding open times…" />}

      {isEmpty && (
        <EmptyState
          title="Nothing else open at the moment"
          description="Your existing appointment is untouched. Get in touch and we will see what we can open up."
        />
      )}

      {!loading && openDates.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {openDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => setOpenDate(date)}
                className={cn(
                  'min-h-11 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  date === activeDate
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary',
                )}
              >
                {new Intl.DateTimeFormat('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${date}T12:00:00Z`))}
                <span className="ml-1 opacity-70">
                  ({slotsByDate[date]?.length ?? 0})
                </span>
              </button>
            ))}
          </div>

          {activeDate && (
            <>
              <p className="mb-2 text-sm font-medium text-foreground">
                {formatDateLong(`${activeDate}T12:00:00Z`, 'UTC')}
              </p>
              <div className="mb-4 grid grid-cols-3 gap-2 md:grid-cols-5">
                {(slotsByDate[activeDate] ?? []).map((slot) => {
                  const isCurrent = slot.startsAt === currentStartsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={busy || isCurrent}
                      onClick={() => onChoose(slot.startsAt)}
                      title={isCurrent ? 'This is your current time' : undefined}
                      className={cn(
                        'min-h-11 rounded-lg border font-mono text-sm',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isCurrent
                          ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                          : 'border-border bg-card text-foreground hover:border-primary',
                      )}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
        Keep my current time
      </Button>

      <p className="mt-2 text-xs text-muted-foreground">All times shown in {timezone}.</p>
    </div>
  );
}
