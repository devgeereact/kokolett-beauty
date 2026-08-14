import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, ChevronRight, Scissors, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { routes } from '@/lib/routes';
import type { SettingsTab } from './tabs';

const ICON_TONE = 'bg-tint-primary text-primary';

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
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_TONE}`}>
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
    </button>
  );
}

/** Shortcuts out of the Settings hub — some to whole other pages, one to the Business tab itself. */
export function BusinessSettingsNavCard({ onTab }: { onTab: (tab: SettingsTab) => void }): JSX.Element {
  const navigate = useNavigate();

  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ICON_TONE}`}>
          <Settings2 aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">Business settings</h2>
          <p className="text-sm text-muted-foreground">Configure your salon operations.</p>
        </div>
      </div>
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
          onClick={() => onTab('business')}
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
