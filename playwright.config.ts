import path from 'path';
import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Loaded once, here, before anything else in this process (config evaluation, global-setup, and
 * every worker all inherit `process.env` from this point on — see config/global-setup.ts).
 */
dotenv.config({
  path: path.join(__dirname, 'config', 'environments', process.env.CI ? 'ci.env' : 'local.env'),
});

/**
 * Binds the 10 `features/*.feature` files to `tests/step-definitions/*.steps.ts` — playwright-bdd
 * materializes one generated spec per scenario under `outputDir`, which Playwright then runs like
 * any other test file. `testDir` below points at that generated output, not `features/` directly.
 */
const bddTestDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'tests/step-definitions/*.steps.ts',
  outputDir: 'tests/.features-gen',
  // Every *.steps.ts file imports Given/When/Then from support/bdd.ts rather than exporting its
  // own `test`, so playwright-bdd can't auto-detect the test instance from the steps glob alone.
  // (support/bdd.ts itself is deliberately excluded from the "steps" glob — it has no Given/When/Then
  // calls of its own — so the "importTestFrom is not needed" warning is a false positive here.)
  importTestFrom: 'tests/step-definitions/support/bdd.ts',
  disableWarnings: { importTestFrom: true },
});

export default defineConfig({
  testDir: bddTestDir,
  globalSetup: require.resolve('./config/global-setup.ts'),
  globalTeardown: require.resolve('./config/global-teardown.ts'),

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    ['blob', { outputDir: 'reports/blob' }],
    ['allure-playwright', { resultsDir: 'reports/allure-results', detail: true, suiteTitle: false }],
  ],

  use: {
    baseURL: process.env.FRONTEND_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: Number(process.env.DEFAULT_ACTION_TIMEOUT_MS ?? 10_000),
    navigationTimeout: Number(process.env.DEFAULT_NAVIGATION_TIMEOUT_MS ?? 15_000),
  },

  // chromium runs the full suite (including @API/@DB-only scenarios); firefox/webkit only
  // re-run scenarios tagged @UI, since cross-browser rendering is what they're actually there to
  // catch — running API/DB-only scenarios a second and third time verifies nothing new.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', grep: /@UI/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', grep: /@UI/, use: { ...devices['Desktop Safari'] } },
  ],
});
