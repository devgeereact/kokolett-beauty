import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The consent gate, checked in a real browser rather than in jsdom.
 *
 * The assertion that matters is the storage one: PECR is about what ends up on
 * the visitor's device, so the test reads `sessionStorage` directly instead of
 * trusting that the gate in `trackEvent` was called. It deliberately does not
 * assert on the network request, which needs a real Supabase project.
 */

const SESSION_KEY = 'kokolett-analytics-session';
const CONSENT_KEY = 'kokolett-consent';

/* Playwright gives each test a fresh context, so storage starts empty in every
   one of these without any explicit clearing. */
test.describe('cookie consent', () => {
  test('stores nothing for the booking funnel until the visitor agrees', async ({
    page,
  }) => {
    await page.goto('/book', { waitUntil: 'networkidle' });

    const banner = page.getByRole('region', { name: /cookies and storage/i });
    await expect(banner).toBeVisible();

    // The booking page fires `book_page_viewed` on mount. Undecided means it
    // must not have written anything.
    expect(await page.evaluate((k) => sessionStorage.getItem(k), SESSION_KEY)).toBeNull();
  });

  test('a refusal is remembered and still stores nothing', async ({ page }) => {
    await page.goto('/book', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /no thanks/i }).click();

    await expect(page.getByRole('region', { name: /cookies and storage/i })).toBeHidden();
    expect(await page.evaluate((k) => sessionStorage.getItem(k), SESSION_KEY)).toBeNull();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('region', { name: /cookies and storage/i })).toBeHidden();
    expect(await page.evaluate((k) => sessionStorage.getItem(k), SESSION_KEY)).toBeNull();
  });

  test('agreeing creates the id, and withdrawing removes it again', async ({ page }) => {
    await page.goto('/book', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /yes, that is fine/i }).click();

    /* `book_page_viewed` already fired, and was correctly suppressed, before
       the choice was made. Reload so an event runs with consent in place:
       agreeing does not retrospectively track the view it was blocking. */
    await page.reload({ waitUntil: 'networkidle' });
    await expect
      .poll(() => page.evaluate((k) => sessionStorage.getItem(k), SESSION_KEY))
      .not.toBeNull();
    expect(await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY)).toContain(
      '"analytics":true',
    );

    await page.goto('/cookies', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /no thanks/i }).click();
    await expect
      .poll(() => page.evaluate((k) => sessionStorage.getItem(k), SESSION_KEY))
      .toBeNull();
  });

  test('the banner has no automated WCAG 2.2 AA violations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(
      page.getByRole('region', { name: /cookies and storage/i }),
    ).toBeVisible();
    /* Scoped to the banner. The whole-page sweep lives in
       `marketing-site.spec.ts`; running it again here would only re-report
       whatever the home page is doing, which is not what this file is about. */
    const results = await new AxeBuilder({ page })
      .include('[aria-label="Cookies and storage"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('the banner is reachable and operable from the keyboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const reject = page.getByRole('button', { name: /no thanks/i });
    await reject.focus();
    await expect(reject).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: /cookies and storage/i })).toBeHidden();
  });
});
