import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Read-only smoke tests over the public marketing site. Deliberately no writes —
 * every page here only GETs from Supabase (services, opening hours, reviews),
 * so these are safe to run against the real project with no seeded test data
 * and no cleanup step.
 */

test('home page loads and identifies the salon', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Kokolett/i);
  await expect(page.getByRole('link', { name: /book/i }).first()).toBeVisible();
});

test('primary marketing nav resolves', async ({ page }) => {
  for (const path of [
    '/about',
    '/gallery',
    '/services',
    '/testimonials',
    '/faqs',
    '/contact',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should respond 200`).toBe(200);
  }
});

/**
 * Until 2026-08-31 every route inherited `index.html`'s canonical, which points at
 * the home page. Eight pages therefore told a crawler they were the home page, and
 * every shared link previewed as the home page. This asserts the fix at the level
 * that actually matters: the rendered head, after hydration.
 */
test('every marketing page carries its own canonical, title and Open Graph URL', async ({
  page,
}) => {
  /* Seventeen full page loads in one test, each waiting on a live Supabase
     read. It measured 29.5s against the 30s default and started failing the
     moment the suite began running under two colour schemes at once. The work
     is genuinely this long rather than hung, so give it the room instead of
     splitting an assertion that reads better whole. */
  test.slow();

  const pages = [
    { path: '/', canonical: 'https://www.kokolettbeauty.com/' },
    { path: '/about', canonical: 'https://www.kokolettbeauty.com/about' },
    { path: '/gallery', canonical: 'https://www.kokolettbeauty.com/gallery' },
    { path: '/services', canonical: 'https://www.kokolettbeauty.com/services' },
    { path: '/testimonials', canonical: 'https://www.kokolettbeauty.com/testimonials' },
    { path: '/faqs', canonical: 'https://www.kokolettbeauty.com/faqs' },
    { path: '/contact', canonical: 'https://www.kokolettbeauty.com/contact' },
    { path: '/book', canonical: 'https://www.kokolettbeauty.com/book' },
  ];

  const titles = new Set<string>();

  for (const { path, canonical } of pages) {
    await page.goto(path, { waitUntil: 'networkidle' });

    await expect(
      page.locator('link[rel="canonical"]'),
      `${path} canonical`,
    ).toHaveAttribute('href', canonical);

    await expect(
      page.locator('meta[property="og:url"]'),
      `${path} og:url`,
    ).toHaveAttribute('content', canonical);

    await expect(
      page.locator('meta[name="twitter:card"]'),
      `${path} twitter:card`,
    ).toHaveAttribute('content', 'summary_large_image');

    titles.add(await page.title());
  }

  expect(titles.size, 'each page needs its own title').toBe(pages.length);
});

test('the salon is described as Thamesmead, and never advertises locs', async ({
  page,
}) => {
  for (const path of ['/', '/services', '/about', '/faqs']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const body = (await page.locator('body').innerText()).toLowerCase();
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');

    expect(description?.toLowerCase(), `${path} description`).not.toContain('woolwich');

    // The FAQ says "we do not do locs" on purpose. Everywhere else must not
    // mention them at all.
    if (path !== '/faqs') {
      expect(body, `${path} must not offer locs`).not.toMatch(/\blocs?\b/);
    }
  }
});

test('the 404 is kept out of the index and canonicalises nowhere', async ({ page }) => {
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // The SPA rewrite answers every unknown path with 200, so a mistyped or
  // retired URL renders this page. Leaving index.html's canonical in place told
  // Google the URL *was* the home page while also saying do not index it:
  // contradictory signals on one URL, and the noindex can be attributed to the
  // canonical target, which is the home page.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test('a noindex page does not leave its robots value on the next page', async ({
  page,
}) => {
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  await page.goto('/services', { waitUntil: 'networkidle' });

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.kokolettbeauty.com/services',
  );
});

test('booking page renders the date/time picker', async ({ page }) => {
  await page.goto('/book');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('unknown route falls back to the not-found page, not a blank screen', async ({
  page,
}) => {
  // waitUntil: 'networkidle' rather than the default 'load' — under four parallel
  // workers, hydration of this client-rendered SPA can take longer than the
  // matcher's default timeout, and a flaky wait here isn't worth chasing since
  // real users don't load four tabs on one CPU simultaneously.
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  await expect(page.getByText('404')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /could not find that page/i }),
  ).toBeVisible();
});

/**
 * Automated WCAG 2.2 AA coverage over every public route, added 2026-09-04.
 * `docs/KOKO_GAP.md` §8 had carried accessibility as a "structural pass" —
 * manually verified landmarks/labels/focus, but contrast ratios and other
 * rule-based checks were never actually run. This closes that gap with real
 * evidence rather than upgrading the claim on inspection alone.
 */
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/gallery',
  '/services',
  '/testimonials',
  '/faqs',
  '/contact',
  '/book',
  '/request-availability',
  '/subscribe',
  '/privacy',
  '/cookies',
  '/terms',
  '/booking-policy',
  '/accessibility',
  '/complaints',
];

/**
 * Seven of these routes used to carry a `test.fail()` for a brand-accent
 * contrast gap (3.02-3.99:1 where AA wants 4.5:1), deferred as a visual
 * identity call for the owner. It was not one: `--brand` is documented in
 * src/index.css as display type at 24px and up, and every failing element was
 * a 12-14px label or link using it anyway. Closed 2026-09-04 by the
 * `--brand-ink` token, so the annotations are gone and these are now plain
 * assertions. If one starts failing again, the palette regressed.
 *
 * The suite runs under both colour schemes (see `playwright.config.ts`).
 * It only ever ran in light mode before, which is how a second, unrelated
 * failure went unseen for as long as it did: the dark `--muted-foreground`
 * was tuned against `--card` but is also every field placeholder's colour on
 * `--input`, where it measured 3.91:1.
 */
for (const path of PUBLIC_ROUTES) {
  test(`${path} has no automated WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test('the 404 page has no automated WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('the mobile nav dialog has no automated WCAG 2.2 AA violations when open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /menu/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * The 404 numeral is decoration, but it is also the only thing on the page
 * that proves the display end of the type scale still resolves. It carried
 * `text-7xl`, which the closed `fontSize` scale in tailwind.config.ts does not
 * define (it stops at `6xl`), so Tailwind emitted nothing and a 72px numeral
 * rendered at the inherited 16px. Nothing failed: not the build, not the lint,
 * not axe, which only measured the contrast the wrong size then caused.
 */
test('the 404 numeral renders at display size, not the inherited body size', async ({
  page,
}) => {
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  const px = await page
    .locator('p[aria-hidden="true"]', { hasText: '404' })
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(px).toBeGreaterThanOrEqual(48);
});
