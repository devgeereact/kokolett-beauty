import type { JSX, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useIsOwner } from '@/hooks/useIsOwner';
import { Spinner } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * Gate a route on an authenticated *staff* session.
 *
 * Being signed in is not enough. Anyone with an auth account could otherwise
 * reach the dashboard shell and see a wall of empty panels and permission
 * errors, which reads as a broken app rather than a closed door.
 *
 * This is presentation only — the real boundary is RLS plus the `is_owner()`
 * guard inside each owner RPC.
 *
 * An unauthenticated hit renders the same generic 404 a stranger gets
 * anywhere else, not a redirect to a login-shaped path — the sign-in form
 * only exists behind the owner's own secret, changeable URL
 * (`SecretGate.tsx`), and this route must not hint at its existence.
 * Deliberate trade-off: the owner cannot deep-link back into the dashboard
 * from a bookmark once her session expires — she always re-enters through
 * her own saved secret link.
 *
 * Mounted once as a pathless layout route wrapping every dashboard route (see
 * `App.tsx`), not per-page — mounting it individually per route meant React
 * Router unmounted and remounted it (and re-ran `useIsOwner`'s RPC round-trip)
 * on every navigation between dashboard pages, which read as the app randomly
 * signing the owner out. `children` is optional so a caller can still wrap a
 * single element directly; with none given, `<Outlet />` renders whichever
 * child route matched.
 */
export function ProtectedRoute({ children }: { children?: ReactNode }): JSX.Element {
  const { user, loading, signOut } = useSupabaseAuth();
  const { isOwner, loading: ownerLoading, failed, retry } = useIsOwner();

  if (loading || (user && ownerLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return <NotFoundPage />;
  }

  // Could not reach the database to ask. That is not a "no", and answering it
  // with the dead-end screen below would tell the owner she is not staff and
  // offer her nothing but Sign out — the one action that makes it harder to
  // recover. Offer the retry instead.
  if (failed) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-2 font-serif text-2xl font-semibold text-foreground">
            Cannot reach the salon right now
          </h1>
          <p className="mb-6 text-muted-foreground">
            You are still signed in. This is a connection problem, not a problem with your
            account.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={retry}>Try again</Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-2 font-serif text-2xl font-semibold text-foreground">
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

  return <>{children ?? <Outlet />}</>;
}
