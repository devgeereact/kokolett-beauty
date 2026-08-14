import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ServicesCatalogue } from '@/components/dashboard/services/ServicesCatalogue';

/** One screen, matching `docs/design/service.png` exactly — no sub-tabs. See `ServicesCatalogue` for what backs it. */
export function ServiceMenuPage(): JSX.Element {
  return (
    <DashboardLayout title="Services" subtitle="Manage the services you offer to your clients.">
      <ServicesCatalogue />
    </DashboardLayout>
  );
}
