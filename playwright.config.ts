import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright Test configuration.
 * See https://playwright.dev/docs/test-configuration for all options.
 */
export default defineConfig({
  testDir: './tests',

  /* Maximum time one test can run.
   * The AbstraPoint SPA loads a ~2 MB JS bundle and waits for Google Maps
   * tiles, so we allow generous per-test time and let individual tests
   * narrow with `test.setTimeout()` if they need less. */
  timeout: 15 * 60 * 1000,

  /* Expect assertion timeout */
  expect: {
    timeout: 15 * 1000,
  },

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Workers: parallelism level */
  workers: process.env.CI ? 2 : undefined,

  /* Reporters */
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.BASE_URL ?? 'https://test.apsitetracker.com/',

    /* Always collect trace + video — this is a UI-heavy demo project */
    trace: 'retain-on-failure',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Record video only on failure */
    video: 'retain-on-failure',

    /* Action / navigation timeouts (the SPA bundle is ~2 MB) */
    actionTimeout: 30 * 1000,
    navigationTimeout: 240 * 1000,

    /* Locale & timezone */
    locale: 'en-US',
    timezoneId: 'Asia/Karachi',

    /* Viewport */
    viewport: { width: 1366, height: 768 },

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
  },

  /* Run your local dev server before starting the tests (uncomment if needed) */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },

  /* Configure projects for major browsers.
   *
   * `setup` logs in once and stores the auth state in `.auth/user.json`;
   * the browser projects depend on it and run with `storageState` set so
   * every spec begins already-authenticated.
   *
   * The "Adding and moving sites" test case targets the desktop UI and
   * relies on right-click and drag-and-drop, which Mobile WebKit/Chrome
   * don't support. Cross-browser projects are kept here for smoke specs
   * but are excluded from the default `npm test` run via `--project`.
   */
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
    },
    {
      name: 'firefox',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: '.auth/user.json' },
    },
    {
      name: 'webkit',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: '.auth/user.json' },
    },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: 'test-results/',
});
