import { Page } from '@playwright/test';
import { Given, When, Then, expect } from './support/bdd';
import { getLastRegisteredCredentials } from './support/bdd';
import { TokenUtils } from '@utils/TokenUtils';
import { Endpoints } from '@constants/endpoints';
import { Urls } from '@constants/urls';
import { Timeouts } from '@constants/timeouts';
import { ApiMessages } from '@constants/messages';
import { ApiResult } from '@services/ApiClient';
import { AuthSuccessResponse } from '@app-types/domain';
import { AppHeader } from '@components/AppHeader';
import { LoginPage } from '@pages/LoginPage';
import { ErrorBanner } from '@widgets/ErrorBanner';
import { Selectors } from '@constants/selectors';
import { Logger } from '@utils/Logger';

const gapLogger = Logger.forScope('session.steps');

// --- Token presence/format -------------------------------------------------------------------

When('I call a protected endpoint without providing an authentication token', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE);
});

Then('the response should indicate an access token is required', async ({ state }) => {
  expect(state.lastApiResponse).toMatchApiError({ status: 401, message: ApiMessages.token.required });
});

When('I call a protected endpoint with a malformed authentication token', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
    headers: { Authorization: TokenUtils.toAuthHeaderValue(TokenUtils.buildMalformedToken()) },
  });
});

Then('the response should indicate the token is invalid or expired', async ({ state }) => {
  expect(state.lastApiResponse).toMatchApiError({ status: 403, message: ApiMessages.token.invalidOrExpired });
});

Then('the issued token should identify my user account', async ({ registeredUser }) => {
  const decoded = TokenUtils.decode(registeredUser.token);
  expect(decoded.userId).toBe(registeredUser.userId);
});

Then('the token should have a future expiry time', async ({ registeredUser }) => {
  const decoded = TokenUtils.decode(registeredUser.token);
  expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

// --- Signature / secret ----------------------------------------------------------------------

When(
  'I call a protected endpoint using a token signed with an unexpected secret',
  async ({ unauthenticatedApiClient, registeredUser, state }) => {
    const token = TokenUtils.buildTokenSignedWithWrongSecret(registeredUser.userId);
    state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
      headers: { Authorization: TokenUtils.toAuthHeaderValue(token) },
    });
  },
);

When(
  'I call a protected endpoint using a token whose payload has been altered without re-signing',
  async ({ unauthenticatedApiClient, registeredUser, state }) => {
    const tampered = TokenUtils.tamperPayload(registeredUser.token, (payload) => ({
      ...payload,
      userId: `${payload.userId}-tampered`,
    }));
    state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
      headers: { Authorization: TokenUtils.toAuthHeaderValue(tampered) },
    });
  },
);

// --- Expiry -----------------------------------------------------------------------------------

Given('I hold an access token that has already expired', async ({ registeredUser, state }) => {
  state.capturedToken = TokenUtils.buildExpiredToken(registeredUser.userId);
});

When('I call a protected endpoint using the expired token', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
    headers: { Authorization: TokenUtils.toAuthHeaderValue(state.capturedToken!) },
  });
});

When('24 hours have elapsed since the token was issued', async ({ registeredUser, state }) => {
  // A real 24h wait isn't feasible in a test run — mint a token with the same claims but an
  // already-past `exp`, mirroring exactly what the real token looks like 24h after issuance (BR-08).
  state.capturedToken = TokenUtils.buildExpiredToken(registeredUser.userId);
});

Then('a request using that token should be rejected as expired', async ({ unauthenticatedApiClient, state }) => {
  const response = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
    headers: { Authorization: TokenUtils.toAuthHeaderValue(state.capturedToken!) },
  });
  expect(response).toMatchApiError({ status: 403, message: ApiMessages.token.invalidOrExpired });
});

// --- Header placement/format -------------------------------------------------------------------

When(
  'I call a protected endpoint with the token sent without the {string} prefix',
  async ({ unauthenticatedApiClient, registeredUser, state }, _prefix: string) => {
    void _prefix;
    state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
      headers: { Authorization: TokenUtils.toAuthHeaderValue(registeredUser.token, '') },
    });
  },
);

Then('the request should be rejected', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBeGreaterThanOrEqual(400);
});

When(
  'I call a protected endpoint with the token placed in a non-standard header instead of {string}',
  async ({ unauthenticatedApiClient, registeredUser, state }, _headerName: string) => {
    void _headerName;
    state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
      headers: { 'X-Auth-Token': TokenUtils.toAuthHeaderValue(registeredUser.token) },
    });
  },
);

// --- Concurrent logins ---------------------------------------------------------------------

When('I log in twice in a row with the same credentials', async ({ authApiService, state }) => {
  const credentials = getLastRegisteredCredentials(state)!;
  const first = await authApiService.login({ username: credentials.username, password: credentials.password });
  const second = await authApiService.login({ username: credentials.username, password: credentials.password });
  state.extra.concurrentLoginResults = [first, second];
});

Then('both issued tokens should independently authorize protected requests', async ({ unauthenticatedApiClient, state }) => {
  const [first, second] = state.extra.concurrentLoginResults as ApiResult<AuthSuccessResponse>[];
  const firstCheck = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
    headers: { Authorization: TokenUtils.toAuthHeaderValue(first.body.token) },
  });
  const secondCheck = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
    headers: { Authorization: TokenUtils.toAuthHeaderValue(second.body.token) },
  });
  expect(firstCheck.status).toBe(200);
  expect(secondCheck.status).toBe(200);
});

// --- Client-side session lifecycle (UI) ------------------------------------------------------

Then('the application should show the login screen on the next protected action', async ({ page }) => {
  await expect(new LoginPage(page).heading).toBeVisible();
});

Given('I have captured my current access token', async ({ registeredUser, state }) => {
  state.capturedToken = registeredUser.token;
});

When('I log out of the application', async ({ authenticatedPage, appNavigator }) => {
  await authenticatedPage.waitUntilReady();
  await appNavigator.logout();
});

When('I call a protected endpoint directly using the captured token', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.CUSTOMERS.BASE, {
    headers: { Authorization: TokenUtils.toAuthHeaderValue(state.capturedToken!) },
  });
});

Then('the request should still succeed', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
});

Then('this should be documented as a known session-revocation limitation', async ({ state }) => {
  // No server-side JWT revocation exists (Requirement.md R-11) — the prior assertion already
  // captured the actual (still-valid) behavior; this step just names the gap in the test log.
  gapLogger.knownGap('No server-side JWT revocation exists (Requirement.md R-11) — a token captured before logout remains valid.');
  expect(state.lastApiResponse?.status).toBe(200);
});

When('I refresh the browser page', async ({ authenticatedPage, page }) => {
  await authenticatedPage.waitUntilReady();
  await page.reload();
});

Then('I should remain logged in without being asked to log in again', async ({ page }) => {
  await expect(new AppHeader(page).logoutButton.element).toBeVisible();
});

Given('I am logged in as a registered bank staff user in one browser tab', async ({ authenticatedPage }) => {
  await authenticatedPage.waitUntilReady();
});

When('I open a second browser tab against the same application', async ({ page, state }) => {
  const secondPage = await page.context().newPage();
  await secondPage.goto(Urls.FRONTEND_BASE_URL);
  state.extra.secondTabPage = secondPage;
});

Then('the second tab should also reflect a logged-in session', async ({ state }) => {
  const secondPage = state.extra.secondTabPage as Page;
  await expect(new AppHeader(secondPage).logoutButton.element).toBeVisible();
  await secondPage.close();
});

When('my session token becomes invalid while I am using the application', async ({ page, authenticatedPage }) => {
  await authenticatedPage.waitUntilReady();
  await page.evaluate(() => window.localStorage.setItem('token', 'invalidated-token-value'));
});

When('I attempt a protected action', async ({ page }) => {
  await page.getByPlaceholder(Selectors.customerList.searchPlaceholder).fill('test');
  await page.getByRole('button', { name: Selectors.customerList.searchButton, exact: true }).click();
});

Then('the application should present a clear message rather than fail silently', async ({ page }) => {
  await expect(new ErrorBanner(page).element).toBeVisible({ timeout: Timeouts.DEFAULT_ACTION_TIMEOUT_MS });
});
