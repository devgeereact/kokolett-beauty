import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface UseIsOwner {
  isOwner: boolean;
  loading: boolean;
}

/**
 * Whether the signed-in user is salon staff.
 *
 * Resolved by asking the database, not by reading a JWT claim — `is_owner()` is
 * a security-definer predicate over the `staff` table, and it is what every RLS
 * policy actually consults. A claim would be a second source of truth the client
 * could shape.
 *
 * This gates the *interface*, never the data: an authenticated non-staff user
 * who bypassed the router would still get nothing back, because RLS is enforced
 * server-side.
 */
export function useIsOwner(): UseIsOwner {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (authLoading) return;
    if (!user) {
      setIsOwner(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    void supabase.rpc('is_owner').then(({ data, error }) => {
      if (!active) return;
      setIsOwner(error ? false : data === true);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return { isOwner, loading: authLoading || loading };
}
