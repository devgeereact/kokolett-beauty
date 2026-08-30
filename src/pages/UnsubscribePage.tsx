import { type JSX, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Public, no session, no `DashboardLayout`. Always shows the same
 * confirmation regardless of whether the id was valid or already
 * unsubscribed — same enumeration-resistant posture as the customer
 * magic-link system (migration 0058).
 */
export function UnsubscribePage(): JSX.Element {
  const { subscriberId } = useParams<{ subscriberId: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!subscriberId) {
      setDone(true);
      return;
    }
    void supabase
      .rpc('unsubscribe_via_link', { p_subscriber_id: subscriberId })
      .then(() => setDone(true));
  }, [subscriberId]);

  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-2xl font-semibold text-foreground">
          {done ? "You're unsubscribed" : 'One moment…'}
        </p>
        <p className="mt-2 text-muted-foreground">
          {done
            ? "If that link was valid, you won't hear from our mailing list again."
            : ''}
        </p>
      </div>
    </main>
  );
}
