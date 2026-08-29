/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_IMAGEKIT_URL_ENDPOINT: string;
  readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by `vite.config.ts`'s `define` block at build time. */
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
