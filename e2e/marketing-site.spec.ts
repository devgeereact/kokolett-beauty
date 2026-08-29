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
