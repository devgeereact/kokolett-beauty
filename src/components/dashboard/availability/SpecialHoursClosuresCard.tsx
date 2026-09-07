import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarOff, CalendarPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeading } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { addDays, formatDateLong, toSalonDate } from '@/lib/format';
import {
  listMonthSummary,
  type DaySummary,
  type TemplateDay,
} from '@/services/availabilityService';
import { routes } from '@/lib/routes';

interface Exception {
  date: string;
  kind: 'closed' | 'extra';
}

/**
 * The reference's "Special hours & closures" card assumes a stored
 * date-range closure entity — this app deliberately has none (migration
 * 0011 removed `availability_exceptions`; a day is just its own list of
 * times, see `DayPanel`'s doc comment). Rather than fabricate rows with no
 * backing data, this derives real exceptions: any date where what's
 * actually published disagrees with the weekly pattern — a normally-open
 * day with nothing published (closed for this date only) or a normally-
 * closed day with something published (extra hours). Both are genuine
 * per-date overrides the owner made via `DayPanel`, not invented data.
 *
 * Bounded to the generator's own filled horizon (`filledTo`) — beyond that,
 * an empty day means "not generated yet," not "closed," so comparing there
 * would manufacture false closures out of the fill job simply not having
 * run that far ahead yet.
 */
export function SpecialHoursClosuresCard({
  timezone,
  days,
  filledTo,
  refreshToken,
  onEditDate,
}: {
  timezone: string;
  days: TemplateDay[];
  filledTo: string | null;
  /**
   * Bumped by the parent whenever a day's published times actually change
   * (a `DayPanel` save or copy). `filledTo` alone doesn't move on an
   * ordinary single-day edit, so without this the card kept showing
   * pre-edit exceptions until something else — like applying the weekly
   * pattern — happened to change `filledTo` too.
   */
  refreshToken: number;
  onEditDate: (date: string) => void;
}): JSX.Element {
  const [summary, setSummary] = useState<DaySummary[] | null>(null);

  const today = toSalonDate(new Date(), timezone);
  const windowEnd =
    filledTo && filledTo < addDays(today, 60) ? filledTo : addDays(today, 60);

  useEffect(() => {
    if (!filledTo || filledTo < today) {
      setSummary([]);
      return;
    }
    listMonthSummary(today, windowEnd)
      .then(setSummary)
      .catch(() => setSummary([]));
  }, [timezone, filledTo, today, windowEnd, refreshToken]);

  const usuallyOpen = new Set(
    days.filter((d) => d.times.length > 0).map((d) => d.day_of_week),
  );

  const allExceptions: Exception[] = (summary ?? [])
    .map((s): Exception | null => {
      const dow = new Date(`${s.on_date}T00:00:00Z`).getUTCDay();
      const expectedOpen = usuallyOpen.has(dow);
      const actuallyOpen = s.slot_count > 0;
      if (expectedOpen === actuallyOpen) return null;
      return { date: s.on_date, kind: expectedOpen ? 'closed' : 'extra' };
    })
    .filter((e): e is Exception => e !== null);
  const SHOWN = 4;
  const exceptions = allExceptions.slice(0, SHOWN);
  const hiddenCount = allExceptions.length - exceptions.length;

  return (
    <Card pad="standard">
      <CardHeading
        size="standard"
        title="Special hours &amp; closures"
        description="Dates that differ from your normal week: a day off, or extra hours added."
      />

      {summary === null ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : !filledTo || filledTo < today ? (
        <p className="text-sm text-muted-foreground">
          Apply your weekly pattern to the calendar below to start tracking exceptions.
        </p>
      ) : exceptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing different from your normal week between now and{' '}
          {formatDateLong(`${windowEnd}T12:00:00Z`, 'UTC')}.
        </p>
      ) : (
        <ul className="space-y-1">
          {exceptions.map((e) => (
            <li key={e.date}>
              <button
                type="button"
                onClick={() => onEditDate(e.date)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  {e.kind === 'closed' ? (
                    <CalendarOff
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                  ) : (
                    <CalendarPlus
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                  )}
                  {formatDateLong(`${e.date}T12:00:00Z`, 'UTC')}
                </span>
                <Badge tone={e.kind === 'closed' ? 'neutral' : 'completed'}>
                  {e.kind === 'closed' ? 'Closed all day' : 'Extra hours'}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <Link
          to={routes.owner.calendar}
          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline"
        >
          +{hiddenCount} more, view full calendar
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      )}
    </Card>
  );
}
