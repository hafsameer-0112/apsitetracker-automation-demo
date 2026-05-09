import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#btn-login');
  }

  async open(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'commit', timeout: 60_000 });
    await this.emailInput.waitFor({ state: 'visible', timeout: 300_000 });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.click();
    await this.emailInput.fill('');
    await this.emailInput.pressSequentially(email, { delay: 25 });
    await this.passwordInput.click();
    await this.passwordInput.fill('');
    await this.passwordInput.pressSequentially(password, { delay: 25 });
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(300);
    await this.passwordInput.focus();
    await this.passwordInput.press('Enter');
    const stillOnForm = await this.loginButton
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (stillOnForm) {
      await this.loginButton.evaluate((el: HTMLElement) => el.click());
    }
  }

  async assertOnLoginPage(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
