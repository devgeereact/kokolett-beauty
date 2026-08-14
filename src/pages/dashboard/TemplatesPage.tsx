import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { EmptyState } from '@/components/ui/States';

export function TemplatesPage(): JSX.Element {
  return (
    <DashboardLayout title="Templates" subtitle="The wording behind every automated email">
      <EmptyState
        title="Template previews are coming soon"
        description="This will show the fixed set of transactional email templates the outbox sends from, read-only."
      />
    </DashboardLayout>
  );
}
