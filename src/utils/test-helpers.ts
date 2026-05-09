import { Page } from '@playwright/test';

/**
 * Generic helpers usable from any test or page object.
 */
export const TestHelpers = {
  /** Generate a unique email for sign-up flows. */
  randomEmail(prefix = 'qa'): string {
    return `${prefix}+${Date.now()}@example.com`;
  },

  /** Generate a random alphanumeric string of the given length. */
  randomString(length = 8): string {
    return Math.random().toString(36).slice(2, 2 + length);
  },

  /** Wait for the network to be idle, useful after navigations. */
  async waitForNetworkIdle(page: Page, timeout = 15_000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  },

  /** Format a Date as YYYY-MM-DD. */
  formatDate(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  },
};
