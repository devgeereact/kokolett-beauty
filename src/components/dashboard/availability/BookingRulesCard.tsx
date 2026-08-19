import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';
import type { BookingSettings } from '@/types';

/** Real `booking_settings` fields — editing lives on Settings, this is the read-only summary the reference shows here. */
export function BookingRulesCard({
  settings,
}: {
  settings: BookingSettings | null;
}): JSX.Element {
  const rows = [
    {
      label: 'Advance booking window',
      value: settings ? `${settings.max_horizon_days} days` : '—',
    },
    {
      label: 'Minimum notice',
      value: settings
        ? `${Math.round((settings.lead_time_min / 60) * 10) / 10} hours`
        : '—',
    },
    {
      label: 'New customer window',
      value: settings ? `${settings.approval_window_h} hours` : '—',
    },
    {
      label: 'Buffer time between bookings',
      value: settings ? `${settings.default_buffer_min} minutes` : '—',
    },
    {
      label: 'Max appointments per day',
      value: settings ? String(settings.max_appointments_per_day) : '—',
    },
  ];

  return (
    <Card className="p-4">
      <h2 className="mb-2 font-serif text-base font-semibold text-foreground">
        Booking rules
      </h2>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
                strokeWidth={2}
              />
              {r.label}
            </dt>
            <dd className="font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        to={routes.owner.settings}
        className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Edit booking settings
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </Card>
  );
}
