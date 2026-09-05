import type { JSX } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDateLong, formatTime } from '@/lib/format';

/**
 * Shared date/time strip sitting above "Today at a glance" and "Approvals
 * queue". Time left, weekday/date stacked on the right. Deliberately large
 * and padded — it's sized to eat into the slack both cards carry below it
 * (each is stretched to match "Next up"'s taller natural height, per their
 * own comments), not just sit in a thin strip on top of that dead space.
 */
export function TodayDateTimeCard({
  now,
  timezone,
}: {
  now: Date;
  timezone: string;
}): JSX.Element {
  // formatDateLong is en-GB "Weekday day Month year" (e.g. "Wednesday 19
  // August 2026") — weekday names are always one word, so splitting on the
  // first space cleanly separates it from "19 August 2026" without a second
  // formatter/timezone call.
  const [weekday, ...dateParts] = formatDateLong(now, timezone).split(' ');
  const date = dateParts.join(' ');

  // Split on the colon so it alone can carry the animated "live" beat —
  // still correct with a 12h "1:08 pm" suffix, the colon it splits on is
  // the first (and only) one either way.
  const [hours, minutes] = formatTime(now, timezone).split(':');

  return (
    <Card pad="roomy" className="flex items-center justify-between">
      {/* `4xl` is the top of this project's fontSize scale (tailwind.config.ts
          caps it there deliberately) — the rest of the presence comes from the
          `roomy` padding role, not an out-of-scale arbitrary value. It was a
          one-off 32px until 2026-09-05, the only card in the app on a padding
          the matrix does not name. `font-mono` matches
          every other clock/time display in the app (DESIGN.md §4: "Numerals,
          references, times → JetBrains Mono"), including this same value in
          the page header. */}
      <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">
        {hours}
        <span className="animate-clock-blink">:</span>
        {minutes}
      </span>
      <div className="flex flex-col items-end">
        <span className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {weekday}
        </span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {date}
        </span>
      </div>
    </Card>
  );
}
