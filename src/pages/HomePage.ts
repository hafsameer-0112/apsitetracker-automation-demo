import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Sample Page Object for https://playwright.dev
 * Replace selectors and methods with those of the real Apsitetracker app.
 */
export class HomePage extends BasePage {
  readonly getStartedButton: Locator;
  readonly searchButton: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.getStartedButton = page.getByRole('link', { name: 'Get started' });
    this.searchButton = page.getByRole('button', { name: 'Search' });
    this.heading = page.getByRole('heading', { level: 1 });
  }

  async open(): Promise<void> {
    await this.goto('/');
    await this.waitForVisible(this.heading);
  }

  async clickGetStarted(): Promise<void> {
    await this.getStartedButton.click();
  }

  async assertOnHome(): Promise<void> {
    await expect(this.page).toHaveTitle(/Playwright/);
    await expect(this.getStartedButton).toBeVisible();
  }
}
