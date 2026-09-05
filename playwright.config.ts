import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build served by `vite preview`, not `vite dev` —
 * this is the same static output cPanel ends up serving, and it exercises the real
 * service worker / PWA behaviour the dev server skips.
 *
 * Port 5082 is this project's allocated dev/preview port (see
 * `~/.claude/CLAUDE.md`, "Dev-server ports", block 08) — `vite.config.ts` pins it
 * with `strictPort: true`, so reusing it here rather than Playwright's own default
 * keeps one port to reason about instead of two.
 */
const PORT = 5082;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /**
   * Both colour schemes, because the palette is two palettes. Until
   * 2026-09-04 the axe sweep ran in light mode only, and the dark
   * `--muted-foreground` had been sitting at 3.91:1 on `--input` (every field
   * placeholder in the app) with nothing looking at it. Chromium twice is
   * cheap here: the suite is read-only and finishes in about ten seconds.
   */
  projects: [
    {
      name: 'chromium-light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'chromium-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
      /* Every other spec here is read-only and gains from a second colour
         scheme. `booking-race` is the one that WRITES to the live project, and
         two copies racing the same first-available slot at the same instant is
         a race between the test runs rather than between two customers: both
         would report SLOT_TAKEN and the suite would fail for a reason that has
         nothing to do with the code. Colour scheme is meaningless to it in any
         case, since it drives the RPCs directly and never opens a page. */
      testIgnore: /booking-race\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
