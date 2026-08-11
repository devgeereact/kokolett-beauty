import * as Sentry from '@sentry/react';
import { env } from '@/lib/env';

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

function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redactAccessToken(value) as unknown as T;
  if (Array.isArray(value)) return value.map(redactDeep) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out as unknown as T;
  }
  return value;
}

/** Initialize Sentry once at startup. No-ops without a usable DSN. */
export function initSentry(): void {
  if (!dsnConfigured) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.mode,
    enabled: env.isProd, // don't spam Sentry from local dev
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,

    // Belt and braces: the token can reach Sentry through the event itself
    // (request URL, transaction name, stack frames) or through a navigation
    // breadcrumb, so both are scrubbed.
    beforeSend(event) {
      return redactDeep(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return redactDeep(breadcrumb);
    },
  });
}

/** Report a handled error with optional context. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsnConfigured) {
    console.error(error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
