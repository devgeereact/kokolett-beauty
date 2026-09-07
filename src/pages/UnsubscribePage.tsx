import { type JSX, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { publicButton } from '@/components/ui/controlClasses';
import { cn } from '@/lib/utils';

/**
 * Public, no session, no `DashboardLayout`. Requires an explicit click before
 * calling the RPC — a mount-effect version fired the moment mail-security
 * link scanners (Outlook SafeLinks, Proofpoint, Barracuda) prefetched this
 * URL, silently unsubscribing real recipients with no audit trail. Always
 * shows the same confirmation regardless of whether the id was valid or
 * already unsubscribed — same enumeration-resistant posture as the customer
 * magic-link system (migration 0058).
 */
export function UnsubscribePage(): JSX.Element {
  /* One-off link from an email footer, keyed to a subscriber id. Never a search
     result, and it must not canonicalise to the home page. */
  useDocumentMeta({ title: 'Unsubscribe', noindex: true });
  const { subscriberId } = useParams<{ subscriberId: string }>();
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const confirm = (): void => {
    if (!subscriberId) {
      setDone(true);
      return;
    }
    setConfirming(true);
    void Promise.resolve(
      supabase.rpc('unsubscribe_via_link', { p_subscriber_id: subscriberId }),
    )
      .then(() => setDone(true))
      .finally(() => setConfirming(false));
  };

  return (
    <main className="grid min-h-screen-app place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-2xl font-semibold text-foreground">
          {done ? "You're unsubscribed" : 'Unsubscribe from our mailing list?'}
        </p>
        <p className="mt-2 text-muted-foreground">
          {done
            ? "If that link was valid, you won't hear from our mailing list again."
            : "Confirm below and you won't hear from our mailing list again."}
        </p>
        {!done && (
          <button
            type="button"
            onClick={confirm}
            disabled={confirming}
            className={cn(publicButton(), 'mt-6 px-5 text-sm')}
          >
            {confirming ? 'Unsubscribing…' : 'Unsubscribe'}
          </button>
        )}
      </div>
    </main>
  );
}
