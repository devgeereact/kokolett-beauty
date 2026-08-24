import { env } from '@/lib/env';
import { redactAccessToken } from '@/lib/redact';

/**
 * The monitoring shim every screen imports.
 *
 * This module deliberately contains no static reference to `@sentry/react`.
 * It used to, and because `ErrorBoundary` imports `reportError` from here, the
 * SDK landed in a chunk that `index.html` modulepreloaded — 99 kB gzipped
 * downloaded before first paint by a customer on a phone trying to book. The
 * real client now lives in `sentry.client.ts` and is fetched after first paint.
 *
 * Two rules hold this in place:
 *  - nothing static may import `@/lib/sentry.client`;
 *  - a failure to load monitoring must never break the page it monitors, so
 *    every path here swallows its own error.
 */

type SentryClient = typeof import('@/lib/sentry.client');

/** How many pre-load reports to hold. A boot loop must not grow unbounded. */
const PENDING_LIMIT = 20;

/** Give the browser a few seconds of idle, then load regardless. */
const IDLE_TIMEOUT_MS = 3000;

/**
 * A DSN that is present but obviously a placeholder.
 *
 * `.env.example` ships `https://your-dsn@sentry.io/project-id`, and a copied
 * `.env` keeps it. Sentry then logs "Invalid Sentry Dsn" on every page load,
 * which buries the console errors that actually matter.
 */
function isUsableDsn(dsn: string): boolean {
  if (!dsn) return false;
  if (/your-dsn|your_dsn|project-id|example\.com|changeme/i.test(dsn)) return false;
  try {
    const url = new URL(dsn);
    return Boolean(url.username) && url.pathname.length > 1;
  } catch {
    return false;
  }
}

const dsnConfigured = isUsableDsn(env.sentryDsn);

let client: SentryClient | null = null;
let loading: Promise<SentryClient | null> | null = null;
const pending: Array<[unknown, Record<string, unknown> | undefined]> = [];

function flushPending(loaded: SentryClient): void {
  while (pending.length > 0) {
    const next = pending.shift();
    if (!next) break;
    try {
      loaded.captureException(next[0], next[1]);
    } catch {
      /* monitoring must never break the page it monitors */
    }
  }
}

/** Load and initialize the real client once. Resolves to null if it fails. */
function loadClient(): Promise<SentryClient | null> {
  loading ??= import('@/lib/sentry.client')
    .then((mod) => {
      mod.initSentryClient();
      client = mod;
      flushPending(mod);
      return mod;
    })
    .catch(() => {
      pending.length = 0;
      return null;
    });
  return loading;
}

/**
 * Schedule monitoring to start after first paint. No-ops without a usable DSN.
 *
 * `requestIdleCallback` is not in Safari before 16.4, and this is a
 * phone-first booking flow, so the timeout fallback is load-bearing rather
 * than defensive.
 */
export function initSentry(): void {
  if (!dsnConfigured) return;
  const start = (): void => {
    void loadClient();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(start, IDLE_TIMEOUT_MS);
  }
}

/**
 * Report a handled error with optional context.
 *
 * An error raised before the client has loaded is queued and sent once it
 * arrives, and it pulls the load forward rather than waiting for idle — so
 * deferring monitoring costs latency on an early error, never the report.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsnConfigured) {
    console.error(error, context);
    return;
  }
  if (client) {
    client.captureException(error, context);
    return;
  }
  if (pending.length < PENDING_LIMIT) pending.push([error, context]);
  void loadClient();
}

export { redactAccessToken };
