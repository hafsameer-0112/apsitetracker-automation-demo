import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { LoginPage } from '../src/pages/LoginPage';
import { MapDashboardPage } from '../src/pages/MapDashboardPage';
import { TestData } from '../src/data/test-data';
import { logger } from '../src/utils/logger';

const AUTH_FILE = path.resolve(__dirname, '../.auth/user.json');
const AUTH_TTL_MS = 55 * 60 * 1000; // 55 minutes

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  if (!process.env.FORCE_RELOGIN && fs.existsSync(AUTH_FILE)) {
    const ageMs = Date.now() - fs.statSync(AUTH_FILE).mtimeMs;
    if (ageMs < AUTH_TTL_MS) {
      logger.info(`Reusing cached auth state (age=${Math.round(ageMs / 1000)}s) — skipping login`);
      return;
    }
    logger.info(`Cached auth state is stale (age=${Math.round(ageMs / 1000)}s) — re-authenticating`);
  }

  await MapDashboardPage.installMapInitHook(page);

  const loginPage = new LoginPage(page);
  const dashboardPage = new MapDashboardPage(page);

  await loginPage.open();
  await loginPage.assertOnLoginPage();
  await loginPage.login(TestData.validUser.email, TestData.validUser.password);
  await dashboardPage.waitUntilReady();
  await expect(dashboardPage.homeButton).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
  logger.info(`Auth state saved to ${AUTH_FILE}`);
});
