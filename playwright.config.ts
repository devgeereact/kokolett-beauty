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

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
