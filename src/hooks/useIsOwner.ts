import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface UseIsOwner {
  isOwner: boolean;
  loading: boolean;
  /**
   * The question could not be asked — not an answer of "no".
   *
   * `postgrest-js` resolves rather than rejects when the request never reaches
   * the server, handing back `{ error }`. Folding that into `isOwner = false`
   * meant one dropped request on a train told the owner she was not staff, and
   * the only control on that screen is Sign out, which makes it worse. In an
   * offline-first PWA a failed request is an expected path, not an exception.
   */
  failed: boolean;
  /** Ask again after a failure. */
  retry: () => void;
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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback((): void => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    if (authLoading) return;
    if (!user) {
      setIsOwner(false);
      setFailed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    void supabase.rpc('is_owner').then(({ data, error }) => {
      if (!active) return;
      // Three outcomes, not two: yes, no, and "could not ask".
      setFailed(Boolean(error));
      setIsOwner(!error && data === true);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user, authLoading, attempt]);

  return { isOwner, loading: authLoading || loading, failed, retry };
}
