import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useIsOwner } from '@/hooks/useIsOwner';
import { Spinner } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';

/**
 * Gate a route on an authenticated *staff* session.
 *
 * Being signed in is not enough. Anyone with an auth account could otherwise
 * reach the dashboard shell and see a wall of empty panels and permission
 * errors, which reads as a broken app rather than a closed door.
 *
 * This is presentation only — the real boundary is RLS plus the `is_owner()`
 * guard inside each owner RPC.
 */
export function ProtectedRoute({ children }: { children: ReactNode }): JSX.Element {
  const { user, loading, signOut } = useSupabaseAuth();
  const { isOwner, loading: ownerLoading } = useIsOwner();
  const location = useLocation();

  if (loading || (user && ownerLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isOwner) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-2 font-display text-2xl font-semibold text-foreground">
            No access
          </h1>
          <p className="mb-6 text-muted-foreground">
            This account is signed in but is not salon staff, so there is nothing here for
            it.
          </p>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
