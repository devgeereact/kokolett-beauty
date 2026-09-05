import { type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, ChevronRight, Scissors, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';

const ICON_TONE = 'bg-tint-brand text-brand-ink';

/**
 * `BookingRulesCard` (which owns `#booking-rules`) stays in its own loading
 * state until its `booking_settings` fetch resolves — so the target can
 * briefly not exist yet on a slow connection. Retry a few times rather than
 * silently no-op.
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

export function NavTile({
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
      className="relative rounded-lg border border-border p-3 text-left hover:bg-muted"
    >
      <ChevronRight
        aria-hidden="true"
        className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"
        strokeWidth={2}
      />
      <span
        className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${ICON_TONE}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <span className="block text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

/**
 * Quick links to the other config screens — "Booking settings" jumps to the
 * `BookingRulesCard` anchor further down the page rather than a separate
 * screen, since that card already lives on this same Settings scroll.
 */
export function BusinessSettingsNavCard(): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-serif text-base font-semibold text-foreground">
        Business Settings
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Configure how your salon operates.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NavTile
          icon={Scissors}
          label="Services"
          desc="Manage services and pricing"
          onClick={() => void navigate(routes.owner.serviceMenu)}
        />
        <NavTile
          icon={Calendar}
          label="Availability"
          desc="Set working hours and breaks"
          onClick={() => void navigate(routes.owner.weeklyDefault)}
        />
        <NavTile
          icon={Settings2}
          label="Booking settings"
          desc="Control how appointments work"
          onClick={() => scrollToBookingRules()}
        />
        <NavTile
          icon={Bell}
          label="Notifications"
          desc="Customise alerts and messages"
          onClick={() => void navigate(routes.owner.notifications)}
        />
      </div>
    </Card>
  );
}
