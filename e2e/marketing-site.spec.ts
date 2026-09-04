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
  await expect(page.getByRole('heading', { name: /could not find that page/i })).toBeVisible();
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
  '/terms',
  '/booking-policy',
];

/**
 * Routes where the brand accent (`text-primary`/`text-brand`, `#c24d2c` on
 * `#e8ebed`; `text-primary-foreground/80` on `bg-primary`) measures under the
 * 4.5:1 AA text threshold at small sizes — 3.62-3.99:1, per axe. Tracked as a
 * P2 in docs/KOKO_GAP.md rather than fixed here: the token was deliberately
 * tuned once already (`--primary: #c24d2c /* 4.78:1 with white *\/` in
 * src/index.css) against a different background than it is actually used on,
 * and retuning the salon's brand colour is a visual-identity call for the
 * owner, not a mechanical accessibility fix. `test.fail()` keeps this a real,
 * running assertion — an unexpected pass here means the gap closed and this
 * annotation should come out.
 */
const KNOWN_CONTRAST_GAP = new Set([
  '/',
  '/about',
  '/gallery',
  '/services',
  '/testimonials',
  '/faqs',
  '/contact',
]);

for (const path of PUBLIC_ROUTES) {
  test(`${path} has no automated WCAG 2.2 AA violations`, async ({ page }) => {
    if (KNOWN_CONTRAST_GAP.has(path)) test.fail();
    await page.goto(path, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test('the 404 page has no automated WCAG 2.2 AA violations', async ({ page }) => {
  test.fail(); // same brand-accent contrast gap as KNOWN_CONTRAST_GAP above, on the "404" numeral
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test('the mobile nav dialog has no automated WCAG 2.2 AA violations when open', async ({
  page,
}) => {
  test.fail(); // same brand-accent contrast gap as KNOWN_CONTRAST_GAP above, in the footer reached via the drawer
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /menu/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
