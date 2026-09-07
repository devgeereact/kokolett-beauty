import type { JSX } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardHeading } from '@/components/ui/Card';
import { DAYS_OF_WEEK } from '@/lib/format';
import type { TemplateDay } from '@/services/availabilityService';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Real numbers off the actual weekly pattern — no separate "opening hours" concept exists, so this is derived, not stored. */
export function OpeningHoursSummaryCard({ days }: { days: TemplateDay[] }): JSX.Element {
  const openDays = days.filter((d) => d.times.length > 0);

  let totalMinutes = 0;
  let earliest: { day: number; time: string } | null = null;
  let latest: { day: number; time: string } | null = null;

  for (const day of openDays) {
    const sorted = [...day.times].sort();
    const first = sorted[0]!;
    const last = sorted.at(-1)!;
    // A published time is a start, not a range — the day's span is its
    // first-to-last-plus-one-slot start, the same approximation the
    // "N times" summary elsewhere in this screen already relies on.
    totalMinutes += toMinutes(last) - toMinutes(first);
    if (!earliest || toMinutes(first) < toMinutes(earliest.time)) {
      earliest = { day: day.day_of_week, time: first };
    }
    if (!latest || toMinutes(last) > toMinutes(latest.time)) {
      latest = { day: day.day_of_week, time: last };
    }
  }

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const avgDaily =
    openDays.length > 0 ? Math.round((totalHours / openDays.length) * 10) / 10 : 0;
  const dayAbbr = (d: number): string => (DAYS_OF_WEEK[d]?.name ?? '').slice(0, 3);

  const rows = [
    { label: 'Total weekly hours', value: `${totalHours} hrs` },
    { label: 'Average daily hours', value: `${avgDaily} hrs` },
    {
      label: 'Earliest start',
      value: earliest ? `${earliest.time} (${dayAbbr(earliest.day)})` : '—',
    },
    {
      label: 'Latest finish',
      value: latest ? `${latest.time} (${dayAbbr(latest.day)})` : '—',
    },
  ];

  return (
    <Card pad="standard">
      <CardHeading size="compact" title="Opening hours summary" />
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Clock aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />
              {r.label}
            </dt>
            <dd className="font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
