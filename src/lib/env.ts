/**
 * Central, validated access to environment variables.
 * Nothing else in the app should read `import.meta.env` directly.
 *
 * Every lookup below is a STATIC `import.meta.env.VITE_*` member expression,
 * never a dynamic `import.meta.env[key]`. Vite replaces static members at
 * build time and drops the rest; a dynamic key forces it to inline the whole
 * env object instead, which shipped every `VITE_*` value — including ones the
 * app never reads — into the public bundle.
 */

interface AppEnv {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  imagekitUrlEndpoint: string;
  sentryDsn: string;
  isProd: boolean;
  mode: string;
}

/** Empty string for anything unset, so callers can test truthiness. */
function value(raw: string | undefined, fallback = ''): string {
  return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
}

export const env: AppEnv = {
  appUrl: value(import.meta.env.VITE_APP_URL),
  supabaseUrl: value(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: value(import.meta.env.VITE_SUPABASE_ANON_KEY),
  imagekitUrlEndpoint: value(import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT),
  sentryDsn: value(import.meta.env.VITE_SENTRY_DSN),
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
};

/* Warn loudly (once, in dev only) if a credential the app cannot work without
   is missing. Production must not log this: the message would name the
   variables to anyone reading the console. */
if (!import.meta.env.PROD) {
  const missing = (
    [
      ['VITE_SUPABASE_URL', env.supabaseUrl],
      ['VITE_SUPABASE_ANON_KEY', env.supabaseAnonKey],
    ] as const
  )
    .filter(([, v]) => v.length === 0)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.warn(
      `[env] Missing env vars: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in.',
    );
  }
}
