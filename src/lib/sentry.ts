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
