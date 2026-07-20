import fs from 'fs';
import path from 'path';
import { request } from '@playwright/test';
import { Given, When, Then, expect, test } from './support/bdd';
import { Logger } from '@utils/Logger';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { BackendProcessManager, BackendHandle } from '@utils/BackendProcessManager';
import { ProcessUtils } from '@utils/ProcessUtils';
import { ApiClient } from '@services/ApiClient';
import { AuthApiService } from '@services/AuthApiService';
import { CustomerApiService } from '@services/CustomerApiService';
import { Endpoints } from '@constants/endpoints';
import { Urls } from '@constants/urls';
import { Timeouts } from '@constants/timeouts';
import { FilePaths } from '@constants/filePaths';
import { ApiMessages } from '@constants/messages';
import { Selectors } from '@constants/selectors';
import { AuthSuccessResponse, HealthResponse, RoutesResponse } from '@app-types/domain';
import { AddCustomerModal } from '@modals/AddCustomerModal';
import { ErrorBanner } from '@widgets/ErrorBanner';

const gapLogger = Logger.forScope('system-health.steps');

// --- Health / routes -----------------------------------------------------------------------

When('I call the health check endpoint', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.HEALTH);
});

Then('it should respond successfully indicating the API is running', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
  expect((state.lastApiResponse?.body as HealthResponse).status).toBe(ApiMessages.health.running);
});

When('I call the routes introspection endpoint', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.ROUTES);
});

Then('it should return the list of registered API routes', async ({ state }) => {
  const body = state.lastApiResponse?.body as RoutesResponse;
  expect(state.lastApiResponse?.status).toBe(200);
  expect(Array.isArray(body.routes)).toBe(true);
  expect(body.routes.length).toBeGreaterThan(0);
});

// --- Consistent error structure --------------------------------------------------------------

When('any request results in an error across the API', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.getById('CUST-does-not-exist'));
});

Then('the error response should consistently contain a single, clear error message field', async ({ state }) => {
  const body = state.lastApiResponse?.body as Record<string, unknown>;
  expect(Object.keys(body)).toEqual(['error']);
  expect(typeof body.error).toBe('string');
});

// --- Unexpected server failure / stack-trace leakage -----------------------------------------

When('an unexpected server-side failure occurs while processing a request', async ({ apiClient, state }) => {
  state.lastApiResponse = await apiClient.postRaw(Endpoints.CUSTOMERS.BASE, '{invalid-json', {
    headers: { 'Content-Type': 'application/json' },
  });
});

Then('the API should respond with a server error status rather than crashing', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(500);
});

Then('the service should remain available for subsequent requests', async ({ unauthenticatedApiClient }) => {
  const health = await unauthenticatedApiClient.get(Endpoints.HEALTH);
  expect(health.status).toBe(200);
});

When('a request results in a server error', async ({ apiClient, state }) => {
  state.lastApiResponse = await apiClient.postRaw(Endpoints.CUSTOMERS.BASE, '{invalid-json', {
    headers: { 'Content-Type': 'application/json' },
  });
});

Then('the response should not contain a stack trace or other internal implementation details', async ({ state }) => {
  const text = state.lastApiResponse?.text ?? '';
  expect(text).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/);
  expect(text).not.toContain(FilePaths.BACKEND_DIR);
});

// --- UI surfaces API errors --------------------------------------------------------------------

When('an action I perform in the UI fails at the API level', async ({ appNavigator, registeredUser, dbService, state }) => {
  await appNavigator.openLogin();
  await appNavigator.login(registeredUser.username, registeredUser.password);
  const modal = await appNavigator.openAddCustomerModal();
  const [existing] = await dbService.query<{ email: string }>('SELECT email FROM customers LIMIT 1');
  // A duplicate email has no pre-insert check (Requirement.md customers.js) — the UNIQUE constraint
  // throws, caught by the generic handler as a 500 — a real, deterministic API-level failure.
  await modal.createCustomer({ firstName: 'DuplicateEmailTest', lastName: 'Test', email: existing.email });
  state.extra.addCustomerModal = modal;
});

Then('the UI should display the corresponding error message to me', async ({ state }) => {
  const modal = state.extra.addCustomerModal as AddCustomerModal;
  await expect(modal.errorBanner.element).toBeVisible();
});

// --- Complete API unavailability (UI) -----------------------------------------------------------

Given('I am using the application', async ({ appNavigator, registeredUser }) => {
  await appNavigator.openLogin();
  await appNavigator.login(registeredUser.username, registeredUser.password);
});

When('the backend API becomes completely unavailable', async ({ page }) => {
  // Aborts every /api/* request at the Playwright layer rather than killing the shared backend
  // process (which other concurrently-running tests depend on) — same observable effect for the UI.
  await page.route('**/api/**', (route) => route.abort('connectionrefused'));
  await page.getByPlaceholder(Selectors.customerList.searchPlaceholder).fill('anything');
  await page.getByRole('button', { name: Selectors.customerList.searchButton, exact: true }).click();
});

Then('the UI should present a clear failure state instead of an unresponsive or blank screen', async ({ page }) => {
  await expect(new ErrorBanner(page).element).toBeVisible({ timeout: Timeouts.DEFAULT_ACTION_TIMEOUT_MS });
});

// --- Malformed body / missing content-type ------------------------------------------------------

When('I submit a request without the expected content type header', async ({ apiClient, state }) => {
  state.lastApiResponse = await apiClient.postRaw(
    Endpoints.CUSTOMERS.BASE,
    JSON.stringify({ firstName: 'NoContentType', lastName: 'Test', email: RandomDataGenerator.uniqueEmail('no-content-type@bankcorp.com') }),
  );
});

Then('the request should be handled predictably without an unhandled server error', async ({ state }) => {
  // Without an application/json Content-Type, body-parser.json() skips parsing, req.body stays
  // empty, and the route's own missing-fields check should yield its normal 400 — not a crash.
  expect(state.lastApiResponse?.status).toBeLessThan(500);
});

// --- Backend restart / persistence (isolated instance — never the shared test-run backend) -----

Given('data has been created and persisted before a backend restart', async ({ state }) => {
  const dbPath = path.join(FilePaths.RUNTIME_DB_DIR, `restart-check-${Date.now()}.db`);
  fs.copyFileSync(FilePaths.SEED_DB_PATH, dbPath);
  const port = await ProcessUtils.getFreePort();
  const handle = await BackendProcessManager.spawn({ port, dbPath });

  const context = await request.newContext({ baseURL: `${handle.baseUrl}/api/` });
  const client = new ApiClient(context);
  const registerResponse = await new AuthApiService(client).register({
    username: RandomDataGenerator.uniqueUsername('restart_check_user'),
    password: 'SecurePass123',
    email: RandomDataGenerator.uniqueEmail('restart@bankcorp.com'),
  });
  const token = (registerResponse.body as AuthSuccessResponse).token;
  const authedClient = client.withAuthorizationHeader(`Bearer ${token}`);
  const createResponse = await new CustomerApiService(authedClient).create({
    firstName: 'RestartPersisted',
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('restart.customer@bankcorp.com'),
  });
  await context.dispose();

  state.extra.restartCheck = { dbPath, port, handle, customerId: createResponse.body.id, token };
});

When('the backend process restarts', async ({ state }) => {
  const check = state.extra.restartCheck as { handle: BackendHandle; port: number; dbPath: string };
  await check.handle.stop();
  (state.extra.restartCheck as { handle: BackendHandle }).handle = await BackendProcessManager.spawn({
    port: check.port,
    dbPath: check.dbPath,
  });
});

Then('all previously persisted data should remain intact and accessible', async ({ state }) => {
  const check = state.extra.restartCheck as { handle: BackendHandle; customerId: string; token: string };
  const context = await request.newContext({ baseURL: `${check.handle.baseUrl}/api/` });
  const client = new ApiClient(context).withAuthorizationHeader(`Bearer ${check.token}`);
  const response = await new CustomerApiService(client).getById(check.customerId);
  expect(response.status).toBe(200);
  await context.dispose();
  await check.handle.stop();
});

// --- Frontend recovery mid-session — not automatable without controlling the shared backend ----

// Reconsidered during the 2026-07-17 framework audit: giving this scenario its own isolated
// frontend+backend pair (mirroring the restart-persistence scenario above) was the one path that
// would make it automatable, but the frontend is spawned once per whole run by config/global-setup.ts
// against a single port, not per-scenario — standing up a second isolated frontend instance is a
// bigger test-infrastructure change than this pass covers. Left as `test.fixme` + `@KnownGap`
// (tagged in system_health_and_error_handling.feature) rather than rushed.
Given('I am using the application when the backend restarts', async () => {
  test.fixme(
    true,
    'Not automatable against the shared test-run backend: restarting it mid-scenario would break ' +
      'every other test running concurrently against the same instance (Playwright runs fully ' +
      'parallel). Verifying this would require its own fully isolated frontend+backend pair, which ' +
      'is out of scope for this pass (TestScenarios.md RECOV-03 — "Manual").',
  );
});

When('I perform an action immediately after the restart', async () => {
  /* unreachable — the preceding Given already marked this scenario fixme */
});

Then(
  'the action should either succeed or present a clear, retryable error rather than hanging indefinitely',
  async () => {
    /* unreachable — the preceding Given already marked this scenario fixme */
  },
);

// --- DB lock contention -------------------------------------------------------------------------

Given('multiple write operations are submitted to the database at the same time', async ({ seededAccount, state }) => {
  state.extra.contentionAccountId = seededAccount.id;
});

When('a database lock contention occurs', async ({ dbService, state }) => {
  const accountId = state.extra.contentionAccountId as string;
  const writes = Array.from({ length: 20 }, (_, index) =>
    dbService
      .execute('UPDATE accounts SET updatedAt = ? WHERE id = ?', [`${new Date().toISOString()}-${index}`, accountId])
      .catch((error: unknown) => error),
  );
  state.extra.contentionResults = await Promise.all(writes);
});

Then('the affected request should receive a handled error response', async ({ state }) => {
  const results = state.extra.contentionResults as unknown[];
  const errors = results.filter((result): result is Error => result instanceof Error);
  const successCount = results.length - errors.length;
  // DbService's own SQLITE_BUSY retry (src/services/DbService.ts) may absorb all contention, or a
  // genuine error may still surface — both are acceptable; a process crash is not.
  gapLogger.info('DB lock contention outcome', { totalWrites: results.length, errorCount: errors.length, successCount });

  expect(results.length).toBe(20);
  // Every surfaced error must be the documented SQLITE_BUSY case DbService already retries around —
  // never an unrelated crash/type error silently counted as "handled".
  for (const error of errors) {
    expect(error.message).toMatch(/SQLITE_BUSY/);
  }
  // 20/20 failures would mean the DB is unusable under contention, not merely "some requests were
  // handled with an error" — at least one write must have actually gone through.
  expect(successCount).toBeGreaterThan(0);
});

Then('the backend process should remain running', async () => {
  const response = await fetch(`${Urls.API_BASE_URL}${Endpoints.HEALTH}`);
  expect(response.ok).toBe(true);
});
