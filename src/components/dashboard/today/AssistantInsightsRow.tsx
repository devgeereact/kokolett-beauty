import { type JSX, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Lightbulb, MessageSquare, TrendingDown, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import {
  getDayOfWeekTrend,
  getHourOfDayTrend,
  getRecentMessages,
  suggestOpenSlots,
  type OpenSlotSuggestion,
} from '@/services/assistantService';
import { listQueuedRequests } from '@/services/requestService';
import { dayName, firstNameOf, formatDateShort, toSalonDate } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

/**
 * Up to 5 findings can be built (gap/quiet-day/requested-window/opening-hours/
 * draft-reply), and any subset can be missing depending on what the salon's
 * data supports today.
 *
 * They used to fan out to `lg:grid-cols-5` across the full width of the page.
 * This card now sits at `lg:col-span-6`, beside Payments to record, so five
 * columns would be about 110px each: a title, a sentence and a button, in a
 * column narrower than the button. Two columns and wrap instead, which also
 * keeps the card's height in the same range as the payments list beside it.
 */

const FLEXIBILITY_LABELS: Record<string, string> = {
  any: 'flexible',
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
};

interface InsightCard {
  key: string;
  icon: LucideIcon;
  iconTone: string;
  title: string;
  body: string;
  linkLabel: string;
  to: string;
}

function mostCommonFlexibility(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/**
 * Five advisory findings surfaced from the same modules the full AI
 * Assistant page uses (`getDayOfWeekTrend`, `suggestOpenSlots`,
 * `getRecentMessages`, `getHourOfDayTrend`, the request queue) — a summary
 * row, not a separate data source. Advisory only: every card links to the
 * real screen where the owner takes the actual action.
 */
export function AssistantInsightsRow({
  timezone,
  className,
}: {
  timezone: string;
  className?: string;
}): JSX.Element {
  const [cards, setCards] = useState<InsightCard[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = toSalonDate(new Date(), timezone);

    Promise.all([
      suggestOpenSlots(today, 1),
      getDayOfWeekTrend(timezone),
      getHourOfDayTrend(timezone),
      listQueuedRequests(),
      getRecentMessages(timezone, 1),
    ])
      .then(([gaps, dayTrend, hourTrend, requests, messages]) => {
        if (cancelled) return;
        const built: InsightCard[] = [];

        const gap: OpenSlotSuggestion | undefined = gaps[0];
        if (gap) {
          const isTomorrow = gap.date === today; // suggestOpenSlots never returns the past; today counts as "the next opening"
          built.push({
            key: 'gap',
            icon: AlertCircle,
            iconTone: 'bg-tint-no-show text-status-no-show',
            title: 'Fill an opening',
            body: isTomorrow
              ? `You have a gap today at ${gap.slot.local_time}.`
              : `Next opening: ${formatDateShort(gap.date, timezone)} at ${gap.slot.local_time}.`,
            linkLabel: 'View calendar',
            to: routes.owner.calendar,
          });
        }

        const openDays = dayTrend.filter((d) => d.templateOpen);
        const quietest = openDays.sort((a, b) => a.count - b.count)[0];
        if (quietest) {
          built.push({
            key: 'quiet-day',
            icon: TrendingDown,
            iconTone: 'bg-tint-in-service text-status-in-service',
            title: 'Under-utilised day',
            body: `${dayName(quietest.dayOfWeek)}s have the fewest bookings. Consider a promo?`,
            linkLabel: 'View insight',
            to: routes.owner.reports,
          });
        }

        const flex = mostCommonFlexibility(requests.map((r) => r.flexibility));
        if (flex && requests.length > 0) {
          built.push({
            key: 'requested-window',
            icon: Users,
            iconTone: 'bg-tint-confirmed text-status-confirmed',
            title: 'Requested window',
            body: `${requests.length} client${requests.length === 1 ? '' : 's'} requested ${FLEXIBILITY_LABELS[flex] ?? flex} slots.`,
            linkLabel: 'See requests',
            to: `${routes.owner.inbox}?tab=requests`,
          });
        }

        const activeHours = hourTrend.filter((h) => h.count > 0);
        if (activeHours.length > 0) {
          const start = Math.min(...activeHours.map((h) => h.hour));
          const end = Math.max(...activeHours.map((h) => h.hour)) + 1;
          built.push({
            key: 'opening-hours',
            icon: Lightbulb,
            iconTone: 'bg-tint-pending text-status-pending',
            title: 'Opening hours idea',
            body: `Most clients book between ${String(start).padStart(2, '0')}:00 to ${String(end).padStart(2, '0')}:00.`,
            linkLabel: 'View suggestion',
            to: routes.owner.weeklyDefault,
          });
        }

        const message = messages[0];
        if (message) {
          built.push({
            key: 'draft-reply',
            icon: MessageSquare,
            iconTone: 'bg-secondary text-secondary-foreground',
            title: 'Draft reply',
            body: `Reply to ${firstNameOf(message.customerName)}'s message?`,
            linkLabel: 'Review draft',
            to: routes.owner.assistant,
          });
        }

        setCards(built);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [timezone]);

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold leading-tight text-foreground">
          AI assistant
        </h2>
        <span className="rounded-full bg-tint-no-show px-2 py-0.5 text-xs font-medium text-status-no-show">
          Beta
        </span>
      </div>

      {!cards && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {cards && cards.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing to flag right now. Check back once there&rsquo;s more booking history.
        </p>
      )}

      {cards && cards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.key} className="min-w-0 rounded-lg border border-border p-3">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${card.iconTone}`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground">{card.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.body}</p>
                <Link
                  to={card.to}
                  className="mt-3 inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {card.linkLabel}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
