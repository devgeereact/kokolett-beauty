import { CalendarClock, CircleCheck, Hourglass, Inbox } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { formatDuration } from '@/lib/format';
import type { Tone } from '@/lib/tone';

/** The approvals queue's headline numbers — pending count plus how the queue has performed over the last 7 days. */
export function ApprovalStats({
  pendingCount,
  avgWaitMinutes,
  approvedPercent,
  thisWeekCount,
}: {
  pendingCount: number;
  avgWaitMinutes: number | null;
  approvedPercent: number | null;
  thisWeekCount: number;
}): JSX.Element {
  const tiles: { icon: typeof CalendarClock; value: string; label: string; tone: Tone }[] = [
    { icon: CalendarClock, value: String(pendingCount), label: 'Pending approval', tone: 'pending' },
    {
      icon: Hourglass,
      value: avgWaitMinutes === null ? '—' : formatDuration(avgWaitMinutes),
      label: 'Avg wait time',
      tone: 'neutral',
    },
    {
      icon: CircleCheck,
      value: approvedPercent === null ? '—' : `${approvedPercent}%`,
      label: 'Approved',
      tone: 'completed',
    },
    { icon: Inbox, value: String(thisWeekCount), label: 'This week', tone: 'neutral' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
