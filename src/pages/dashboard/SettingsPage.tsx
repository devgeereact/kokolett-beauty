import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AccountSummaryCard } from '@/components/dashboard/settings/AccountSummaryCard';
import { BillingCard } from '@/components/dashboard/settings/BillingCard';
import { BusinessSettingsNavCard } from '@/components/dashboard/settings/BusinessSettingsNavCard';
import { BusinessTabContent } from '@/components/dashboard/settings/BusinessTabContent';
import { OrganisationDetailsCard } from '@/components/dashboard/settings/OrganisationDetailsCard';
import { PreferencesCard } from '@/components/dashboard/settings/PreferencesCard';
import { SecurityCard } from '@/components/dashboard/settings/SecurityCard';
import { SupportCard } from '@/components/dashboard/settings/SupportCard';
import type { SettingsTab } from '@/components/dashboard/settings/tabs';
import { cn } from '@/lib/utils';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'organisation', label: 'Organisation' },
  { key: 'account', label: 'Account' },
  { key: 'business', label: 'Business' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'security', label: 'Security' },
  { key: 'billing', label: 'Billing' },
];

/**
 * `settings.png`'s six-tab shape. "Organisation" is the hub — every other
 * card in miniature, plus a jump straight into "Business" for the row that
 * has no page of its own. Each other tab is that same card, full width, for
 * focused editing — no content is duplicated in two different components.
 */
export function SettingsPage(): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('organisation');

  return (
    <DashboardLayout title="Settings" subtitle="Manage your account, business and app preferences.">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="mb-6 flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'organisation' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <OrganisationDetailsCard />
          <AccountSummaryCard />
          <BusinessSettingsNavCard onTab={setTab} />
          <PreferencesCard />
          <SecurityCard />
          <SupportCard />
        </div>
      )}

      {tab === 'account' && (
        <div className="max-w-xl">
          <AccountSummaryCard />
        </div>
      )}

      {tab === 'business' && <BusinessTabContent />}

      {tab === 'preferences' && (
        <div className="max-w-xl">
          <PreferencesCard />
        </div>
      )}

      {tab === 'security' && (
        <div className="max-w-xl">
          <SecurityCard />
        </div>
      )}

      {tab === 'billing' && <BillingCard />}
    </DashboardLayout>
  );
}
