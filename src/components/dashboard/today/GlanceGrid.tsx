import { type JSX, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PoundSterling, TrendingUp, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { listDaySlots } from '@/services/availabilityService';
import { formatMoney, toSalonDate } from '@/lib/format';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { AppointmentDetailed } from '@/types';

interface GlanceStat {
  key: string;
  icon: LucideIcon;
  value: string;
  label: string;
  to: string;
  linkLabel: string;
}

/**
 * "Today at a glance" — four numbers derived live from today's appointments
 * plus the slot grid, no stored report. Appointments come from the schedule
 * the caller already fetched; utilisation needs the day's full slot list
 * (booked and free), which nothing else on this page loads, so it's fetched
 * here.
 */
export function GlanceGrid({
  appointments,
  todayCount,
  collectedPence,
  timezone,
  className,
}: {
  appointments: AppointmentDetailed[];
  todayCount: number | null;
  /**
   * Money actually logged against today's appointments, from
   * `owner_dashboard_summary`. Not derived from `appointments.price_pence`:
   * migration 0027 left that column a placeholder defaulting to 0, so summing
   * it produced a headline revenue tile that read £0.00 every single day.
   */
  collectedPence: number | null;
  timezone: string;
  className?: string;
}): JSX.Element {
  const [utilizationPercent, setUtilizationPercent] = useState<number | null>(null);

  useEffect(() => {
    const today = toSalonDate(new Date(), timezone);
    listDaySlots(today)
      .then((slots) => {
        if (slots.length === 0) {
          setUtilizationPercent(null);
          return;
        }
        const booked = slots.filter((s) => s.is_booked).length;
        setUtilizationPercent((booked / slots.length) * 100);
      })
      .catch(() => setUtilizationPercent(null));
  }, [timezone]);

  const newClientsToday = useMemo(
    () =>
      new Set(
        appointments
          .filter((a) => (a.customer_completed_count ?? 0) === 0)
          .map((a) => a.customer_id),
      ).size,
    [appointments],
  );

  const stats: GlanceStat[] = [
    {
      key: 'appointments',
      icon: Calendar,
      value: todayCount === null ? '—' : String(todayCount),
      label: 'Appointments',
      to: routes.owner.appointments,
      linkLabel: 'View today',
    },
    {
      key: 'new-clients',
      icon: UserPlus,
      value: String(newClientsToday),
      label: 'New clients',
      to: routes.owner.customers,
      linkLabel: 'View list',
    },
    {
      key: 'revenue',
      icon: PoundSterling,
      value: collectedPence === null ? '—' : formatMoney(collectedPence),
      label: 'Taken today',
      to: routes.owner.reports,
      linkLabel: 'View report',
    },
    {
      key: 'utilization',
      icon: TrendingUp,
      value: utilizationPercent === null ? '—' : `${Math.round(utilizationPercent)}%`,
      label: 'Utilisation',
      to: routes.owner.reports,
      linkLabel: 'View report',
    },
  ];

  return (
    <Card className={cn('flex h-full flex-col p-4', className)}>
      <h2 className="mb-3 text-base font-semibold leading-tight text-foreground">
        Today at a glance
      </h2>
      {/* Vertically centred in the leftover height (this card matches "Next
          up"'s taller natural height) so any slack lands as balanced margin
          top and bottom, not a dead zone stuck under the grid. */}
      <div className="flex flex-1 flex-col justify-center">
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              // A soft fill instead of a border — four bordered boxes nested
              // inside the card's own border read as boxes-in-a-box. The
              // whole tile is the link (bigger target, one affordance) —
              // its accessible name is "1 Appointments View today", so the
              // link label can stay a quiet second line instead of the loud
              // always-orange CTA it was.
              <Link
                key={stat.key}
                to={stat.to}
                className="group rounded-lg bg-muted/60 p-3.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-tint-brand text-primary">
                  <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                {/* font-serif matches "Bookings overview"'s own stat numbers
                    right below this card, and StatTile's documented
                    convention for a dashboard headline number — font-sans
                    here was the odd one out on this exact screen. */}
                <p className="mt-2.5 font-serif text-3xl font-semibold tabular-nums leading-none text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                  {stat.linkLabel}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
