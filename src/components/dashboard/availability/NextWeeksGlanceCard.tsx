import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { addDays, DAYS_OF_WEEK, formatDateShort, toSalonDate } from '@/lib/format';
import { listMonthSummary, type DaySummary } from '@/services/availabilityService';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { TemplateDay } from '@/services/availabilityService';

/**
 * Four real weeks of `month_slot_summary`, not a mockup calendar — a green
 * dot means that date actually has published, open slots. A day the weekly
 * pattern normally opens but that has zero slots published gets a hollow
 * ring instead of a plain "closed" dot: a real, derivable signal (compare
 * against the pattern) rather than a fabricated "Bank Holiday" label with no
 * backing row.
 */
export function NextWeeksGlanceCard({
  timezone,
  days,
}: {
  timezone: string;
  days: TemplateDay[];
}): JSX.Element {
  const [summary, setSummary] = useState<DaySummary[] | null>(null);

  useEffect(() => {
    const today = toSalonDate(new Date(), timezone);
    listMonthSummary(today, addDays(today, 27))
      .then(setSummary)
      .catch(() => setSummary([]));
  }, [timezone]);

  const today = toSalonDate(new Date(), timezone);
  const byDate = new Map((summary ?? []).map((s) => [s.on_date, s]));
  const usuallyOpen = new Set(
    days.filter((d) => d.times.length > 0).map((d) => d.day_of_week),
  );

  // Days since the most recent Monday (ISO week), Sunday folded to 6 rather than 0.
  const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (todayDow + 6) % 7;
  const mondayOfThisWeek = addDays(today, -daysSinceMonday);

  const weeks = Array.from({ length: 4 }, (_, w) => {
    const start = addDays(mondayOfThisWeek, w * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
        Next 4 weeks at a glance
      </h2>

      {!summary ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-2xs font-semibold uppercase text-muted-foreground">
            {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
              <span key={dow}>{DAYS_OF_WEEK[dow]?.name.slice(0, 1)}</span>
            ))}
          </div>
          <div className="space-y-2">
            {weeks.map((week) => (
              <div key={week[0]} className="grid grid-cols-7 gap-1">
                {week.map((date) => {
                  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
                  const s = byDate.get(date);
                  const hasSlots = (s?.slot_count ?? 0) > 0;
                  const past = date < today;
                  return (
                    <span
                      key={date}
                      title={`${formatDateShort(`${date}T00:00:00Z`)} — ${hasSlots ? `${s!.slot_count} slots` : 'no slots'}`}
                      className="flex items-center justify-center"
                    >
                      <span
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          past
                            ? 'bg-muted'
                            : hasSlots
                              ? 'bg-status-completed'
                              : usuallyOpen.has(dow)
                                ? 'border-2 border-status-no-show bg-transparent'
                                : 'bg-border',
                        )}
                      />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        to={routes.owner.calendar}
        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        View full calendar
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </Card>
  );
}
