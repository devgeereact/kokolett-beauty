import type { JSX } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AboutPhotoCard } from '@/components/dashboard/settings/AboutPhotoCard';
import { BillingCard } from '@/components/dashboard/settings/BillingCard';
import { BookingRulesCard } from '@/components/dashboard/settings/BookingRulesCard';
import { BusinessAndOwnerCard } from '@/components/dashboard/settings/BusinessAndOwnerCard';
import { BusinessSettingsNavCard } from '@/components/dashboard/settings/BusinessSettingsNavCard';
import { GoogleReviewsCard } from '@/components/dashboard/settings/GoogleReviewsCard';
import { LinksToShareCard } from '@/components/dashboard/settings/LinksToShareCard';
import { MailingListCard } from '@/components/dashboard/settings/MailingListCard';
import { PreferencesCard } from '@/components/dashboard/settings/PreferencesCard';
import { SalonDetailsCard } from '@/components/dashboard/settings/SalonDetailsCard';
import { SupportCard } from '@/components/dashboard/settings/SupportCard';
import { YourCalendarCard } from '@/components/dashboard/settings/YourCalendarCard';

/**
 * One continuous Settings screen, laid out as independent row wrappers
 * rather than a handful of merged cards under generic eyebrow labels — each
 * `<div className="grid ...">` row is its own responsive grid, so a row can
 * be reordered or resized later without touching a global span table. Grid's
 * default `align-items: stretch` makes every card in a row match its
 * neighbour's height, so a row never reads as misaligned; the lighter cards
 * center their own content vertically so the extra height doesn't show up as
 * dead space at the bottom.
 *
 * Rows 1–2 use a 3-column track with the primary card spanning two of them,
 * so the "wide card + narrow card" pairing is just `md:col-span-2` on a
 * 3-column grid rather than a one-off fractional template. Row 2's wide
 * column stacks Business Settings and Your Calendar on top of each other
 * (`space-y-6`) so their combined height matches Preferences alongside them,
 * without Preferences itself growing to fill anything. Row 1's Business &
 * Owner card carries its own Account & Security section at its foot (see
 * `BusinessAndOwnerCard.tsx`) instead of a separate top-level card, so its
 * height naturally matches About Photo beside it. Row 3 is two equal
 * columns; row 4 is three; the last row is two.
 *
 * DOM order equals mobile order, so the single-column collapse needs no
 * `order-*` classes: Business & Owner (+ Account & Security), About Photo,
 * Business Settings, Your Calendar, Preferences, Salon Details, Booking
 * Rules, Links to Share, Mailing List, Google Reviews, Support, Billing.
 */
export function SettingsPage(): JSX.Element {
  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your account, business and app preferences."
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <BusinessAndOwnerCard />
          </div>
          <AboutPhotoCard />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <BusinessSettingsNavCard />
            <YourCalendarCard />
          </div>
          <PreferencesCard />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SalonDetailsCard />
          <BookingRulesCard />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <LinksToShareCard />
          <MailingListCard />
          <GoogleReviewsCard />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <SupportCard />
          <BillingCard />
        </div>
      </div>
    </DashboardLayout>
  );
}
