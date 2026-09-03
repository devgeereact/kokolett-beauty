/**
 * Cache Storage the service worker owns, and the one moment the app has to
 * clear it.
 *
 * The runtime cache in `vite.config.ts` is scoped to public tables, so in a
 * correctly updated install it holds opening hours and a service list and
 * nothing else. This exists for the two cases that scoping cannot reach: an
 * install that is still running the old service worker, which cached every
 * `/rest/v1/` read including `customers` and `appointments`; and the plain
 * expectation that signing out on a shared device leaves nothing of the
 * previous session on disk.
 *
 * Cache Storage is not cleared by `signOut`, by Supabase, or by closing the
 * tab. Nothing clears it unless something asks.
 */

/** Runtime caches holding data read from the salon's API. */
const API_CACHES = ['supabase-api'];

/**
 * Delete the API runtime caches. Resolves either way.
 *
 * Never allowed to reject or to block: this runs on the sign-out path, and a
 * failure to tidy a cache must not be the reason someone stays signed in. The
 * API is missing entirely in a non-secure context and in some private modes.
 */
export async function purgeApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await Promise.all(API_CACHES.map((name) => caches.delete(name)));
  } catch {
    /* tidying is best effort; sign-out is not */
  }
}
