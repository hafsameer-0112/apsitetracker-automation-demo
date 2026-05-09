import { test as base } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { MapDashboardPage } from '../pages/MapDashboardPage';

/**
 * Custom Playwright fixtures.
 *
 * Use this `test` instead of the default one in your spec files so each test
 * automatically gets ready-to-use page objects:
 *
 *   import { test, expect } from '../src/fixtures/test-fixtures';
 *
 *   test('example', async ({ loginPage, dashboardPage }) => { ... });
 *
 * The `dashboardPage` fixture also installs a Page-init hook that patches
 * the `google.maps.Map` constructor as soon as it loads, so the test can
 * later reach for the live map instance without crawling React internals.
 */
type Pages = {
  homePage: HomePage;
  loginPage: LoginPage;
  dashboardPage: MapDashboardPage;
};

export const test = base.extend<Pages>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await MapDashboardPage.installMapInitHook(page);
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await MapDashboardPage.installMapInitHook(page);
    await use(new MapDashboardPage(page));
  },
});

export { expect } from '@playwright/test';
