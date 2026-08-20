import { type JSX, useRef } from 'react';
import { Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import {
  ServicesCatalogue,
  type ServicesCatalogueHandle,
} from '@/components/dashboard/services/ServicesCatalogue';
import { Button } from '@/components/ui/Button';

/** One screen, matching `docs/design/service.png` — no sub-tabs. See `ServicesCatalogue` for what backs it. */
export function ServiceMenuPage(): JSX.Element {
  const catalogueRef = useRef<ServicesCatalogueHandle>(null);

  return (
    <DashboardLayout
      title="Services"
      subtitle="Manage the services you offer to your clients."
      actions={
        <Button size="sm" onClick={() => catalogueRef.current?.openNew()}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          Add new service
        </Button>
      }
    >
      <ServicesCatalogue ref={catalogueRef} />
    </DashboardLayout>
  );
}
