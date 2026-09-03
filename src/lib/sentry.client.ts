import * as Sentry from '@sentry/react';
import { env } from '@/lib/env';
import { redactDeep } from '@/lib/redact';

/**
 * The real Sentry SDK, and the only module in `src/` that imports it.
 *
 * Nothing static may import this file. `src/lib/sentry.ts` pulls it in with a
 * dynamic `import()` after first paint, which is what keeps ~99 kB gzipped of
 * monitoring off the critical path of a customer trying to book on a phone.
 * A static import from anywhere else puts it straight back.
 */

/** Initialize Sentry. Called once, by the shim, never directly. */
export function initSentryClient(): void {
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
      /* A device with no connection produces a "Failed to fetch" for every
         request the page attempts, and `replaysOnErrorSampleRate: 1.0` means
         each one drags a session replay up with it. That is quota spent on a
         condition the app already handles and shows the customer (see
         `toAppError`'s OFFLINE branch). The check is the connectivity flag
         rather than the message text on purpose: a "Failed to fetch" while
         the browser believes it is online is a real fault, usually CORS or
         CSP, and losing those would cost far more than the noise. */
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
      return redactDeep(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return redactDeep(breadcrumb);
    },
  });
}

/** Forward a handled error to Sentry. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
