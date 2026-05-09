# APSiteTracker Automation Demo

End-to-end test automation suite for [APSiteTracker](https://test.apsitetracker.com), built with **Playwright + TypeScript** using the Page Object Model pattern.

---

## Stack

| Tool | Version |
|---|---|
| [Playwright Test](https://playwright.dev/docs/intro) | `^1.48` |
| TypeScript | `^5.6` |
| Node.js | `>=18` |

---

## Project Structure

```
apsitetracker-automation-demo/
├── playwright.config.ts          # Playwright configuration (timeouts, reporters, auth)
├── tsconfig.json                 # TypeScript configuration
├── package.json
├── .env                          # Credentials & base URL (not committed)
│
├── tests/
│   ├── auth.setup.ts             # Logs in once and caches auth state to .auth/user.json
│   ├── adding-and-moving-sites.spec.ts
│   ├── adding-sites-and-data.spec.ts
│   └── api/
│       └── api-example.spec.ts
│
├── src/
│   ├── pages/                    # Page Object Model classes
│   │   ├── BasePage.ts
│   │   ├── HomePage.ts
│   │   ├── LoginPage.ts
│   │   └── MapDashboardPage.ts
│   ├── fixtures/
│   │   ├── test-fixtures.ts      # Custom Playwright fixtures (page objects wired up)
│   │   └── files/                # File uploads used in tests
│   │       ├── sample.pdf
│   │       └── sample.xlsx
│   ├── utils/
│   │   ├── logger.ts             # Logger — writes to console + logs/<timestamp>.log
│   │   └── test-helpers.ts
│   └── data/
│       └── test-data.ts          # Centralised test data (coords, inputs, col IDs)
│
├── logs/                         # Auto-created. One .log file per test run (gitignored)
├── playwright-report/            # HTML report (gitignored)
└── test-results/                 # Traces, videos, screenshots, JUnit XML (gitignored)
```

---

## Test Cases

### `adding-and-moving-sites.spec.ts`
Verifies the full site creation and pin-move workflow on the map dashboard.

| Step | Action | Assertion |
|---|---|---|
| 1 | Right-click on the map | "Create a New Site" popup appears |
| 2 | Click "Create Site" | New pin and table row are added |
| 3 | Click the new pin | Corresponding row is selected and pin is highlighted |
| 4 | Click "Move Pin" | Button turns orange, text changes to "Moving Pin…" |
| 5–6 | Drag the pin to a new location | Pin follows cursor; other pins stay put |
| 7 | Click "Home" | Map re-centers and zooms to fit all pins |

### `adding-sites-and-data.spec.ts`
Verifies site creation via the search bar and data entry in the Edit Screen.

| Step | Action | Assertion |
|---|---|---|
| 1 | Navigate to the dashboard | Auth state re-used, title matches `/APST/i` |
| 2–4 | Type address and press Search | "Add Site" button appears |
| 5–6 | Click "Add Site" → "Create Site" | Dialog closes, row count increases by 1 |
| 7 | Select the newly created row | Row is highlighted in the grid |
| 8 | Open the Edit Screen | Edit panel is visible |
| 9–10 | Enter Size (2500 sqft) | Value saved |
| 11–12 | Enter Rent ($7.93/sqft/yr) | Value saved |
| 13 | Check annual gross rent | Auto-calculated to **19,825** |
| 14–15 | Upload a PDF | PDF listed in attachments |
| 16–17 | Upload an Excel file | Browser alert fires; file rejected |
| 18 | Close the Edit Screen | Dashboard is shown again |

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd apsitetracker-automation-demo
npm install
```

### 2. Install browsers

```bash
npm run install:browsers
```

### 3. Configure environment

Create a `.env` file in the project root:

```env
BASE_URL=https://test.apsitetracker.com
TEST_USERNAME=your-email@example.com
TEST_PASSWORD=your-password
CI=false
```

> `BASE_URL` defaults to `https://test.apsitetracker.com/` if not set.

---

## Running Tests

| Command | Description |
|---|---|
| `npm test` | Run all tests headlessly (recommended) |
| `npm run test:headed` | Run all tests with the browser visible |
| `npm run test:debug` | Step through tests with the Playwright inspector |
| `npm run test:ui` | Open Playwright UI mode (great for development) |
| `npm run report` | Open the last HTML report |
| `npm run lint` | Type-check the project without emitting files |

> Tests run sequentially with a single worker. Each run first executes `auth.setup.ts` to log in and cache the session, then the spec files reuse that session automatically.

---

## Checking Logs

Every test run writes a timestamped log file to the `logs/` folder:

```
logs/
└── 2026-05-09T15-32-00.log
```

**Each log line format:**
```
[INFO]  2026-05-09T15:32:21.766Z  Dashboard ready
[WARN]  2026-05-09T15:33:09.655Z  Map not fully ready — proceeding
[ERROR] 2026-05-09T15:34:00.000Z  Unexpected error  {"detail":"..."}
```

**To view the latest log (PowerShell):**
```powershell
Get-Content (Get-ChildItem logs\*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
```

**To follow a log live during a run (PowerShell):**
```powershell
Get-Content (Get-ChildItem logs\*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName -Wait
```

> The `logs/` folder is gitignored and created automatically on first run.

---

## Reports & Artifacts

After any run, open the full HTML report:

```bash
npm run report
```

| Artifact | Location |
|---|---|
| HTML report | `playwright-report/` |
| JUnit XML | `test-results/results.xml` |
| Traces / videos / screenshots | `test-results/` (retained on failure) |
| Run logs | `logs/<timestamp>.log` |
