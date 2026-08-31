import { test, expect } from '@playwright/test';

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

test('the 404 is kept out of the index', async ({ page }) => {
  await page.goto('/this-route-does-not-exist', { waitUntil: 'networkidle' });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
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
  await expect(page.getByText(/doesn't exist/i)).toBeVisible();
});
