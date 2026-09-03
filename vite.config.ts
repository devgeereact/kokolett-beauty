/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Build-time version markers, surfaced on the System Health page
 * (migration 0053) so a stale-cache bug is something to check for rather
 * than guess at — this project has been bitten by exactly that before.
 * Falls back to 'unknown' rather than failing the build if `git` is
 * unavailable in whatever environment runs it.
 */
function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitShortSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  /**
   * Absolute base. This is not a preference; a relative base is broken for
   * this app.
   *
   * With `base: './'` the entrypoint emits `./assets/index-*.js`. A browser
   * resolves that against the *current URL*, so it only works at depth zero.
   * Load https://www.kokolettbeauty.com/dashboard/appointments directly and the
   * browser asks for /dashboard/assets/index-*.js, which does not exist, so
   * the SPA rewrite in .htaccess answers with index.html — a 200 carrying
   * text/html where a module was expected. Strict MIME checking refuses it and
   * the page renders blank. Every two-segment route was affected, including
   * every /access/<token> magic link in every email.
   *
   * The cost is that the bundle can no longer be served from a subdirectory,
   * which this app never does: kokolettbeauty.com is its own document root.
   */
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Port block 08 is allocated to kokolett-beauty (see ~/.claude/CLAUDE.md, "Dev-server ports").
  // strictPort makes a collision fail loudly instead of drifting to another port,
  // which would silently fall outside the Supabase redirect allow-list.
  server: { port: 5082, strictPort: true },
  preview: { port: 5082, strictPort: true },

  plugins: [
    react(),

    VitePWA({
      // 'generateSW' lets Workbox build the service worker for us.
      strategies: 'generateSW',
      /* Was 'prompt' with our own update UI, on the reasoning that a reload
         should never surprise the owner. That reasoning cost us an evening:
         a password-recovery link opened from her inbox loaded the *precached*
         shell, so a deployed auth fix simply did not run, and no amount of
         redeploying could reach a browser that was never asking for new HTML.
         An update she has to notice and accept is not an update. */
      registerType: 'autoUpdate',
      // Registration is ours, in src/components/UpdatePrompt.tsx, which needs
      // to own it in order to intercept the reload. (This said main.tsx for a
      // long time; main.tsx has never registered the worker.)
      injectRegister: null,

      // Files pulled into the precache manifest (the "app shell").
      includeAssets: ['icons/*.png'],

      manifest: {
        name: 'Kokolett Beauty UK',
        short_name: 'Kokolett',
        description:
          "Book a women's hair salon in Thamesmead, South East London. Braids, twists, weaves, natural hair, colour and treatments at Kokolett Beauty UK.",
        theme_color: '#e05d38',
        background_color: '#e8ebed',
        display: 'standalone',
        orientation: 'portrait',
        /* Absolute, and pinned with `id`. `./` resolved to `/` correctly, but
           only because the manifest happens to sit at the root; the same two
           lines would silently scope the installed app to a subdirectory if it
           ever moved. `id` is what an installed app is recognised by, and
           without it the identity is inferred from `start_url`, so changing
           `start_url` later would register as a second, separate app on every
           device that already has this one. `/` is what the inferred value
           already is, so adding it now changes nothing for existing installs. */
        id: '/',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        /* Workbox emits its own map for sw.js, independently of `build.sourcemap`,
           and appends a `sourceMappingURL` comment to the worker. The deploy
           excludes `*.map`, so that comment pointed at a 404 on the one file the
           browser refetches most often. Nothing debugs the generated worker from
           a map anyway; the readable version is this config. */
        sourcemap: false,
        // Precache the shell so the SPA boots with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA navigations resolve to the precached index.html.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true, // see registerType above — stale shells broke auth
        /* Belt and braces for the same problem: a navigation carrying an auth
           credential must reach the network rather than being answered from
           the precached shell. */
        navigateFallbackDenylist: [/token_hash=/, /[?&]code=/, /type=recovery/],
        runtimeCaching: [
          {
            // ImageKit CDN — cache-first, images rarely change.
            urlPattern: /^https:\/\/ik\.imagekit\.io\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagekit-media',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /* Supabase REST reads, PUBLIC TABLES ONLY. Network-first with a
               short fallback.

               This used to match every `/rest/v1/` path. A Cache Storage entry
               is keyed by URL alone, so an authenticated read of `customers`
               or `appointments` was written to disk with no reference to whose
               token fetched it, survived sign-out untouched (nothing in the app
               clears Cache Storage), and would be served to whoever opened the
               app on that device next. Verified in a real browser: the cache
               was created and populated on a first page load.

               The four tables below are the ones the marketing pages read while
               signed out, and they hold no personal data: opening hours, the
               service list and its categories, and the single public
               `booking_settings` row. Every other table now goes straight to
               the network and is never written to disk. RPCs are POSTs, so
               Workbox never routed them in the first place.

               The cache name is unchanged deliberately. Existing installs
               already hold personal rows under it, and keeping the name means
               ExpirationPlugin sweeps them out on the first public read after
               this ships. A new name would orphan that cache instead, and an
               orphaned Cache Storage entry is never collected.

               `src/lib/apiCache.ts` also purges it on sign-out.

               Status 0 was dropped from `cacheableResponse`. A 0 here is an
               opaque response, which for a CORS API request means the request
               failed or was blocked, and caching that stores a failure where
               the app expects rows. ImageKit keeps 0 because images legitimately
               arrive opaque. */
            urlPattern:
              /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/(booking_settings|services|service_categories|weekly_template)(\?|$)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Fonts stylesheets + files.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },

      devOptions: {
        enabled: false, // set true to debug the SW in `npm run dev`
      },
    }),
  ],

  test: {
    environment: 'jsdom',
    // jsdom defaults to `about:blank`, which is an opaque origin — and an opaque
    // origin has no `localStorage`. The customer session lives in localStorage,
    // so without a real URL those tests fail on the storage shim rather than on
    // anything they are actually asserting.
    environmentOptions: { jsdom: { url: 'https://www.kokolettbeauty.com/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],

    /**
     * Placeholder Supabase credentials, for tests only.
     *
     * `src/lib/supabase.ts` calls `createClient()` at module scope, so importing
     * anything under `src/services/` transitively constructs a client — and
     * `createClient` throws "supabaseUrl is required" on an empty string. CI
     * deliberately runs with no `.env` (a missing variable should fail the
     * build, and real keys must never reach a public log), so a storage test
     * that touches no network still failed there while passing locally purely
     * because a developer machine has a `.env`.
     *
     * These are syntactically valid and point nowhere. Any test that needs real
     * behaviour from the client should mock the module rather than reach for a
     * live project.
     */
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-credential',
      VITE_APP_URL: 'https://www.kokolettbeauty.com',
    },
    // The salon's own clock is the one that matters, and CI pins TZ=UTC so that
    // a Europe/London machine cannot hide an off-by-one-hour error behind BST.
    // Tests must therefore never assume the host timezone.
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },

  build: {
    outDir: 'dist',
    /**
     * Built, but never served.
     *
     * This was `true`, commented "required for readable Sentry stack traces".
     * Half of that was wrong in a way nothing surfaced: `docs/DEPLOYMENT.md`
     * §7 forbids publishing `*.map` to the docroot and the deploy excludes
     * them, and there is no Sentry upload step in CI, so the maps were built
     * and then thrown away. What did reach production was the
     * `//# sourceMappingURL=` comment at the foot of every chunk, pointing at
     * a file that 404s.
     *
     * `'hidden'` emits the maps and omits the comment, which is exactly the
     * shape a Sentry release upload wants. Until that upload exists, Sentry
     * frames stay minified: see `docs/KOKO_GAP.md` §5.
     */
    sourcemap: 'hidden',
    target: 'es2020',
    rollupOptions: {
      output: {
        /**
         * Split vendors so the app shell stays tiny and cache-stable.
         *
         * This is the function form because Rollup 5 (Vite 8) removed the
         * object form outright — `manualChunks: { name: [...] }` now fails
         * typecheck with TS2769 and does nothing at runtime.
         *
         * The object form used to pull each named package's private
         * dependency subtree along with it. A function sees one module at a
         * time and has no such notion, so anything that must travel with a
         * chunk has to be named: `scheduler` is react-dom's own dependency
         * and belongs in `react-vendor`, not in the app bundle.
         *
         * `framer-motion` used to have a chunk here. Nothing in src/ ever
         * imported it, so rollup emitted a 1,053-byte empty file and the
         * package sat in the dependency tree collecting Dependabot PRs.
         * `date-fns` is not listed either: no app code imports it directly,
         * it arrives transitively through react-day-picker, so naming it
         * here only split a dependency of the chunk it already belongs to.
         */
        manualChunks(id: string): string | undefined {
          if (!id.includes('node_modules')) return undefined;
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return 'react-vendor';
          }
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@sentry')) return 'sentry';
          /* `react-day-picker` used to be named here as a `calendar` chunk.
             Naming it forced date-fns AND rollup's CJS shim for `react` into
             the same chunk, and the entry graph needs that shim — so the
             marketing home page modulepreloaded all 22 kB gzipped of a
             calendar it never renders. Left unnamed, the package follows the
             dynamic `import()` in `components/ui/Calendar.tsx` into its own
             chunk and the entry keeps only the shim. */
          return undefined;
        },
      },
    },
  },
});
