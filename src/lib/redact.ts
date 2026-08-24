/**
 * URL redaction shared by the Sentry shim and the Sentry client.
 *
 * It lives in its own module so that `src/lib/sentry.ts` — which every screen
 * imports for `reportError` — can be scrubbed of any static `@sentry/react`
 * dependency without losing the redaction, and so the two modules never form
 * an import cycle.
 */

/**
 * Replace the token in a `/access/<token>` URL with a placeholder.
 *
 * A customer's magic link is a bearer credential sitting in the URL path, and
 * it stays there until `MyBookingsPage` has redeemed it and scrubbed the
 * address bar. Both `browserTracingIntegration` and `replayIntegration` record
 * the full URL, and they start before that happens, so live magic links were
 * being shipped to Sentry. `maskAllText` does not help: it masks DOM text, not
 * URLs. Anyone with Sentry access could then read a customer's booking history
 * and cancel their appointments for the 30 minutes the link is valid.
 */
export function redactAccessToken(value: string): string {
  return value.replace(/\/access\/[^/?#\s]+/gi, '/access/[redacted]');
}

/** Apply `redactAccessToken` to every string reachable from `value`. */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactAccessToken(value) as unknown as T;
  if (Array.isArray(value)) return value.map(redactDeep) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out as unknown as T;
  }
  return value;
}
