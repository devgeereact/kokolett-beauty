import type { JSX, ReactNode } from 'react';
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
 * A named group within the single Settings scroll — an uppercase eyebrow
 * plus a hairline rule, the same "structure encodes something true about
 * the content" device used for the calendar legend and the reports filter
 * row. Without it, seven visually-identical cards in a row read as one
 * undifferentiated pile rather than four distinct concerns.
 */
function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section>
      <h2 className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
      {children}
    </section>
  );
}

/**
 * One continuous Settings screen — no sub-tabs. Previously six tabs
 * (Organisation / Account / Business / Preferences / Security / Billing),
 * with "Organisation" acting as a hub that already rendered every other
 * card in miniature. Tab switching was local `useState`, never part of the
 * URL, so collapsing it into a single scroll changes nothing anyone could
 * have deep-linked to.
 *
 * Every card shares one heading treatment — plain serif `h2` + muted
 * description, no per-card icon tile — matching how `BusinessTabContent`'s
 * own cards (Salon details, Booking rules, Links to share, …) already look.
 * Grouping under `SettingsSection` labels replaces the icon tiles as the
 * thing that gives the page visual landmarks.
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
      <div className="space-y-8">
        <SettingsSection label="Business">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <OrganisationDetailsCard />
            <AccountSummaryCard />
          </div>
        </SettingsSection>

        <SettingsSection label="Configuration">
          <div className="space-y-6">
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <BusinessSettingsNavCard />
              <PreferencesCard />
            </div>
            <BusinessTabContent />
          </div>
        </SettingsSection>

        <SettingsSection label="Account & security">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <SecurityCard />
            <SupportCard />
          </div>
        </SettingsSection>

        <SettingsSection label="Billing">
          <BillingCard />
        </SettingsSection>
      </div>
    </DashboardLayout>
  );
}
