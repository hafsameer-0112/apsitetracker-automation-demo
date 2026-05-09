import { test, expect } from '../src/fixtures/test-fixtures';

test.describe('AbstraPoint SiteTracker — smoke @smoke', () => {
  // The React bundle is large; give it room to load.
  test.setTimeout(8 * 60 * 1000);
  test.use({ navigationTimeout: 240_000 });

  test('dashboard loads after login', async ({ dashboardPage, page }) => {
    await page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await dashboardPage.waitUntilReady();
    await expect(page).toHaveTitle(/APST/i);
    await expect(dashboardPage.homeButton).toBeVisible();
  });
});
