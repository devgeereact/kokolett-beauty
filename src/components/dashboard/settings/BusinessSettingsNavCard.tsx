import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, ChevronRight, Scissors, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';

const ICON_TONE = 'bg-tint-brand text-primary';

/**
 * `BusinessTabContent` (which owns #booking-rules) mounts unconditionally
 * alongside this card, but stays in its own loading state until its
 * `booking_settings` fetch resolves — so the target can briefly not exist
 * yet on a slow connection. Retry a few times rather than silently no-op.
 */
function scrollToBookingRules(attempt = 0): void {
  const el = document.getElementById('booking-rules');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (attempt >= 20) return;
  window.setTimeout(() => scrollToBookingRules(attempt + 1), 150);
}

function Row({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: typeof Scissors;
  label: string;
  desc: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted"
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_TONE}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground"
        strokeWidth={2}
      />
    </button>
  );
}

/**
 * Shortcuts out of Settings — most to whole other pages, "Booking settings"
 * to the Booking rules card further down this same page (Settings is now a
 * single scroll, not a tab set).
 */
export function BusinessSettingsNavCard(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Business settings
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Configure your salon operations.
      </p>
      <div className="divide-y divide-border">
        <Row
          icon={Scissors}
          label="Services"
          desc="Manage services and pricing"
          onClick={() => void navigate(routes.owner.serviceMenu)}
        />
        <Row
          icon={Calendar}
          label="Availability"
          desc="Set working hours and breaks"
          onClick={() => void navigate(routes.owner.weeklyDefault)}
        />
        <Row
          icon={Settings2}
          label="Booking settings"
          desc="Control how appointments work"
          onClick={() => scrollToBookingRules()}
        />
        <Row
          icon={Bell}
          label="Notifications"
          desc="Customise alerts and messages"
          onClick={() => void navigate(routes.owner.notifications)}
        />
      </div>
    </Card>
  );
}
