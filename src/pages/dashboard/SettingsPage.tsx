import type { JSX } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AccountSummaryCard } from '@/components/dashboard/settings/AccountSummaryCard';
import { BillingCard } from '@/components/dashboard/settings/BillingCard';
import { BusinessSettingsNavCard } from '@/components/dashboard/settings/BusinessSettingsNavCard';
import { BusinessTabContent } from '@/components/dashboard/settings/BusinessTabContent';
import { OrganisationDetailsCard } from '@/components/dashboard/settings/OrganisationDetailsCard';
import { PreferencesCard } from '@/components/dashboard/settings/PreferencesCard';
import { SecurityCard } from '@/components/dashboard/settings/SecurityCard';
import { SupportCard } from '@/components/dashboard/settings/SupportCard';

/**
 * One continuous Settings screen — no sub-tabs. Previously six tabs
 * (Organisation / Account / Business / Preferences / Security / Billing),
 * with "Organisation" acting as a hub that already rendered every other
 * card in miniature. Tab switching was local `useState`, never part of the
 * URL, so collapsing it into a single scroll changes nothing anyone could
 * have deep-linked to.
 *
 * Order: who you are (salon identity, owner account) → where to configure
 * the business (quick links + preferences) → the full business form
 * (salon details, booking rules, reviews, calendar, share links, mailing
 * list — `BusinessTabContent` already folds those together) → account
 * safety and help → billing, last because there is nothing to manage there.
 */
export function SettingsPage(): JSX.Element {
  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your account, business and app preferences."
    >
      <div className="space-y-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <OrganisationDetailsCard />
          <AccountSummaryCard />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <BusinessSettingsNavCard />
          <PreferencesCard />
        </div>

        <BusinessTabContent />

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <SecurityCard />
          <SupportCard />
        </div>

        <BillingCard />
      </div>
    </DashboardLayout>
  );
}
