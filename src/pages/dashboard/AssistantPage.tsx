import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AssistantChatTab } from '@/components/dashboard/assistant/AssistantChatTab';
import { NewBookingPanel } from '@/components/dashboard/NewBookingPanel';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { getProfile } from '@/services/profileService';
import { firstNameOf } from '@/lib/format';

/**
 * The AI assistant, matching `docs/design/ai.png` exactly — chat only, no
 * sub top nav. The eight deterministic advisory modules this page used to
 * carry as a second "Advisory tools" tab now live on the page each one is
 * actually about (Calendar, Email, Customers, Reports — see
 * `AdvisorySection` usages there), rather than a standalone tab absent from
 * the reference.
 */
export function AssistantPage(): JSX.Element {
  const { user } = useSupabaseAuth();
  const [firstName, setFirstName] = useState('there');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => setFirstName(p?.full_name ? firstNameOf(p.full_name) : 'there'))
      .catch(() => setFirstName('there'));
  }, [user]);

  return (
    <DashboardLayout
      title="AI Assistant"
      subtitle="Advisory only — nothing here acts on its own"
      actions={
        <Button size="sm" onClick={() => setBooking(true)}>
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          New booking
        </Button>
      }
    >
      <AssistantChatTab firstName={firstName} />

      <Modal open={booking} onClose={() => setBooking(false)} ariaLabel="New booking">
        <NewBookingPanel
          prefill={null}
          onClose={() => setBooking(false)}
          onBooked={() => setBooking(false)}
        />
      </Modal>
    </DashboardLayout>
  );
}
