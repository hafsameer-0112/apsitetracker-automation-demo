# Apsitetracker Automation Demo

End-to-end test automation framework built with **Playwright + TypeScript**.

## Stack

- [Playwright Test](https://playwright.dev/docs/intro) `^1.48`
- TypeScript `^5.6`
- Page Object Model
- Custom Playwright fixtures
- HTML, list, and JUnit reporters
- `.env` driven configuration via `dotenv`

## Project Structure

```
apsitetracker-automation-demo/
├── playwright.config.ts        # Playwright configuration
├── tsconfig.json               # TypeScript configuration
├── package.json
├── .env.example                # Copy to .env and fill in
├── tests/                      # Spec files
│   ├── example.spec.ts
│   └── api/
│       └── api-example.spec.ts
└── src/
    ├── pages/                  # Page Object Model classes
    │   ├── BasePage.ts
    │   └── HomePage.ts
    ├── fixtures/               # Custom Playwright fixtures
    │   └── test-fixtures.ts
    ├── utils/                  # Helpers, logger, etc.
    │   ├── logger.ts
    │   └── test-helpers.ts
    └── data/                   # Test data
        └── test-data.ts
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Install browsers

```bash
npm run install:browsers
```

### 3. Configure environment

```bash
cp .env.example .env
```

Then edit `.env` with your environment-specific values.

## Running Tests

| Command | Description |
| --- | --- |
| `npm test` | Run all tests in headless mode on every project |
| `npm run test:headed` | Run tests with the browser visible |
| `npm run test:ui` | Open Playwright UI mode (recommended for development) |
| `npm run test:debug` | Step through tests with the inspector |
| `npm run test:chromium` | Run only on Chromium |
| `npm run test:firefox` | Run only on Firefox |
| `npm run test:webkit` | Run only on WebKit |
| `npm run test:smoke` | Run tests tagged `@smoke` |
| `npm run test:regression` | Run tests tagged `@regression` |
| `npm run report` | Open the last HTML report |
| `npm run codegen` | Launch the Playwright recorder |
| `npm run lint` | Type-check the project (no emit) |

## Writing a New Test

```ts
import { test, expect } from '../src/fixtures/test-fixtures';

test('login redirects to dashboard @smoke', async ({ homePage, page }) => {
  await homePage.open();
  await homePage.clickGetStarted();
  await expect(page).toHaveURL(/docs/);
});
```

## Tags

Use Playwright `--grep` to run tests by tag. Common tags used here:

- `@smoke` — fast critical-path checks
- `@regression` — full regression suite
- `@api` — API-only tests

## Reports

After a run:

```bash
npm run report
```

The HTML report is also written to `playwright-report/`, JUnit results to `test-results/results.xml`, and traces/videos/screenshots to `test-results/`.

## CI

The config sets `retries: 2` and `workers: 2` automatically when `CI=true`.
Reports and artifacts are produced in standard folders so any CI provider
(GitHub Actions, Azure DevOps, GitLab, Jenkins) can pick them up.
