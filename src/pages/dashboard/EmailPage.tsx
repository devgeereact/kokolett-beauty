import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { EmptyState } from '@/components/ui/States';

export function EmailPage(): JSX.Element {
  return (
    <DashboardLayout title="Email" subtitle="Every message the salon has sent">
      <EmptyState
        title="Email log is coming soon"
        description="This will list every booking confirmation, reminder, and owner notification sent from the outbox, with delivery status."
      />
    </DashboardLayout>
  );
}
