import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AssistantChatTab } from '@/components/dashboard/assistant/AssistantChatTab';
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

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p) => setFirstName(p?.full_name ? firstNameOf(p.full_name) : 'there'))
      .catch(() => setFirstName('there'));
  }, [user]);

  return (
    <DashboardLayout title="AI Assistant" subtitle="Advisory only — nothing here acts on its own">
      <AssistantChatTab firstName={firstName} />
    </DashboardLayout>
  );
}
