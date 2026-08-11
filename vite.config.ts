/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  /**
   * Absolute base. This is not a preference; a relative base is broken for
   * this app.
   *
   * With `base: './'` the entrypoint emits `./assets/index-*.js`. A browser
   * resolves that against the *current URL*, so it only works at depth zero.
   * Load https://koko.gakinz.com/dashboard/appointments directly and the
   * browser asks for /dashboard/assets/index-*.js, which does not exist, so
   * the SPA rewrite in .htaccess answers with index.html — a 200 carrying
   * text/html where a module was expected. Strict MIME checking refuses it and
   * the page renders blank. Every two-segment route was affected, including
   * every /access/<token> magic link in every email.
   *
   * The cost is that the bundle can no longer be served from a subdirectory,
   * which this app never does: koko.gakinz.com is its own document root.
   */
  base: '/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Port block 08 is allocated to kokolett-beauty (see ~/CLAUDE.md §4).
  // strictPort makes a collision fail loudly instead of drifting to another port,
  // which would silently fall outside the Supabase redirect allow-list.
  server: { port: 5082, strictPort: true },
  preview: { port: 5082, strictPort: true },

  plugins: [
    react(),

    VitePWA({
      // 'generateSW' lets Workbox build the service worker for us.
      strategies: 'generateSW',
      registerType: 'prompt', // we surface our own update UI; never auto-reload
      injectRegister: null, // registration handled manually in src/main.tsx

      // Files pulled into the precache manifest (the "app shell").
      includeAssets: ['favicon.svg', 'offline.html', 'icons/*.png'],

      manifest: {
        name: 'Kokolett Beauty UK',
        short_name: 'Kokolett',
        description: 'Salon booking and operations for Kokolett Beauty UK — passwordless for customers, one dashboard for the owner.',
        theme_color: '#e05d38',
        background_color: '#e8ebed',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
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
        // Precache the shell so the SPA boots with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA navigations resolve to the precached index.html.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false, // wait for user to accept the update
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
            // Supabase REST/GraphQL reads — network-first with short fallback.
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
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
    environmentOptions: { jsdom: { url: 'https://koko.gakinz.com/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // The salon's own clock is the one that matters, and CI pins TZ=UTC so that
    // a Europe/London machine cannot hide an off-by-one-hour error behind BST.
    // Tests must therefore never assume the host timezone.
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },

  build: {
    outDir: 'dist',
    sourcemap: true, // required for readable Sentry stack traces
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split vendors so the app shell stays tiny and cache-stable.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
