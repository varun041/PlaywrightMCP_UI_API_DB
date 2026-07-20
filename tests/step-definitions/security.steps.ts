import jwt from 'jsonwebtoken';
import { request } from '@playwright/test';
import { Given, When, Then, expect } from './support/bdd';
import { loginAndOpenCustomerDetails } from './common.steps';
import { TestData } from '@utils/TestDataLoader';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { Logger } from '@utils/Logger';
import { BackendProcessManager, BackendHandle } from '@utils/BackendProcessManager';
import { ProcessUtils } from '@utils/ProcessUtils';
import { ApiClient } from '@services/ApiClient';
import { AuthApiService } from '@services/AuthApiService';
import { CustomerApiService } from '@services/CustomerApiService';
import { AccountApiService } from '@services/AccountApiService';
import { TransferApiService } from '@services/TransferApiService';
import { Endpoints } from '@constants/endpoints';
import { AccountType } from '@enums/AccountType';
import { AuthSuccessResponse } from '@app-types/domain';

const gapLogger = Logger.forScope('security.steps');

interface StaffSession {
  username: string;
  password: string;
  userId: string;
  token: string;
  client: ApiClient;
}

async function registerAndBuildSession(
  authApiService: AuthApiService,
  unauthenticatedApiClient: ApiClient,
  baseUsername: string,
): Promise<StaffSession> {
  const username = RandomDataGenerator.uniqueUsername(baseUsername);
  const password = 'SecurePass123';
  const email = RandomDataGenerator.uniqueEmail(`${baseUsername}@bankcorp.com`);
  const response = await authApiService.register({ username, password, email });
  if (response.status !== 201) {
    throw new Error(`registerAndBuildSession("${baseUsername}") failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  const body = response.body as AuthSuccessResponse;
  return {
    username,
    password,
    userId: body.userId,
    token: body.token,
    client: unauthenticatedApiClient.withAuthorizationHeader(`Bearer ${body.token}`),
  };
}

// --- Authorization / ownership (AUTHZ-01..04) -------------------------------------------------

Given(
  'a customer was created while logged in using test data {string}',
  async ({ authApiService, unauthenticatedApiClient, state }, testCaseId: string) => {
    const entry = TestData.securityAndAccessControl.get(testCaseId);
    const creatorSession = await registerAndBuildSession(authApiService, unauthenticatedApiClient, entry.creatorUsername!);
    const creatorCustomerService = new CustomerApiService(creatorSession.client);
    const createResponse = await creatorCustomerService.create({
      firstName: 'AuthzCreator',
      lastName: RandomDataGenerator.uniqueSuffix(),
      email: RandomDataGenerator.uniqueEmail('authz.customer@bankcorp.com'),
    });
    state.extra.authzCreatedCustomerId = createResponse.body.id;
  },
);

Given(
  'an account was created while logged in using test data {string}',
  async ({ authApiService, unauthenticatedApiClient, state }, testCaseId: string) => {
    const entry = TestData.securityAndAccessControl.get(testCaseId);
    const creatorSession = await registerAndBuildSession(authApiService, unauthenticatedApiClient, entry.creatorUsername!);
    const creatorCustomerService = new CustomerApiService(creatorSession.client);
    const creatorAccountService = new AccountApiService(creatorSession.client);
    const customerResponse = await creatorCustomerService.create({
      firstName: 'AuthzAccountOwner',
      lastName: RandomDataGenerator.uniqueSuffix(),
      email: RandomDataGenerator.uniqueEmail('authz.account@bankcorp.com'),
    });
    const accountResponse = await creatorAccountService.create(customerResponse.body.id, {
      accountType: AccountType.CHECKING,
      balance: 100,
    });
    state.extra.authzCreatedAccountId = accountResponse.body.id;
  },
);

Given('two accounts exist that were created by different staff users', async ({ authApiService, unauthenticatedApiClient, state }) => {
  const sessionA = await registerAndBuildSession(authApiService, unauthenticatedApiClient, 'teller_authz_a');
  const sessionB = await registerAndBuildSession(authApiService, unauthenticatedApiClient, 'teller_authz_b');

  const customerA = await new CustomerApiService(sessionA.client).create({
    firstName: 'AuthzA',
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('authz.a@bankcorp.com'),
  });
  const accountA = await new AccountApiService(sessionA.client).create(customerA.body.id, {
    accountType: AccountType.CHECKING,
    balance: 500,
  });

  const customerB = await new CustomerApiService(sessionB.client).create({
    firstName: 'AuthzB',
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('authz.b@bankcorp.com'),
  });
  const accountB = await new AccountApiService(sessionB.client).create(customerB.body.id, {
    accountType: AccountType.CHECKING,
    balance: 500,
  });

  state.extra.authzAccountFrom = accountA.body;
  state.extra.authzAccountTo = accountB.body;
});

When('I log in as a different staff user using test data {string}', async ({ authApiService, unauthenticatedApiClient, state }, testCaseId: string) => {
  const entry = TestData.securityAndAccessControl.get(testCaseId);
  state.extra.authzOtherSession = await registerAndBuildSession(authApiService, unauthenticatedApiClient, entry.otherUsername!);
});

When('I log in as a staff user unrelated to either account', async ({ authApiService, unauthenticatedApiClient, state }) => {
  state.extra.authzOtherSession = await registerAndBuildSession(authApiService, unauthenticatedApiClient, 'teller_unrelated');
});

When('I view the customer created by the first staff user', async ({ state }) => {
  const otherSession = state.extra.authzOtherSession as StaffSession;
  const customerId = state.extra.authzCreatedCustomerId as string;
  state.lastApiResponse = (await new CustomerApiService(otherSession.client).getById(customerId));
});

When('I delete the account created by the first staff user', async ({ state }) => {
  const otherSession = state.extra.authzOtherSession as StaffSession;
  const accountId = state.extra.authzCreatedAccountId as string;
  state.lastApiResponse = (await new AccountApiService(otherSession.client).delete(accountId));
});

When('I transfer funds between those two accounts', async ({ state }) => {
  const otherSession = state.extra.authzOtherSession as StaffSession;
  const from = state.extra.authzAccountFrom as { id: string; accountNumber: string };
  const to = state.extra.authzAccountTo as { id: string; accountNumber: string };
  state.lastApiResponse = (await new TransferApiService(otherSession.client).transfer({
    fromAccountId: from.id,
    toAccountNumber: to.accountNumber,
    amount: 10,
  }));
});

When('I delete a customer record', async ({ customerApiService, seededCustomer, state }) => {
  state.lastApiResponse = (await customerApiService.delete(seededCustomer.id));
});

Then('the request currently succeeds', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBeGreaterThanOrEqual(200);
  expect(state.lastApiResponse?.status).toBeLessThan(300);
});

Then('the request currently succeeds without any role check', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
});

// Cucumber Expressions treat `/` as alternation syntax, so a literal slash must be escaped —
// otherwise "ownership/tenancy" parses as "ownership" OR "tenancy" instead of the literal phrase.
Then('this should be flagged as a missing ownership\\/tenancy control', async () => {
  gapLogger.knownGap('No customer/account ownership or tenancy model exists (Requirement.md R-2).');
});

Then('this should be flagged as a missing role-based access control', async () => {
  gapLogger.knownGap('No RBAC exists (Requirement.md R-2) — any authenticated staff user can act on accounts they do not manage.');
});

Then('this should be flagged as a missing role-based access control requirement', async () => {
  gapLogger.knownGap('No role/permission model exists (Requirement.md R-2) — any authenticated user can perform destructive actions.');
});

// --- SQL injection ------------------------------------------------------------------------------

When('I search for customers using a query containing a SQL-injection-style payload', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.search({ query: "' OR '1'='1" }));
});

Then('no unintended data should be returned or altered', async ({ state, dbService }) => {
  expect(state.lastApiResponse?.status).toBe(200);
  const body = state.lastApiResponse?.body as { customers?: unknown[] };
  expect(body.customers?.length ?? 0).toBe(0);
  expect(await dbService.countCustomers()).toBeGreaterThan(0);
});

Then('the query should be treated as a literal search term', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
});

When('I create a customer whose name field contains a SQL-injection-style payload', async ({ customerApiService, state }) => {
  const payload = "Robert'); DROP TABLE customers;--";
  state.extra.sqlInjectionPayload = payload;
  state.lastApiResponse = (await customerApiService.create({
    firstName: payload,
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('sqli@bankcorp.com'),
  }));
});

Then('the customer should be created with the value stored literally', async ({ state, dbService }) => {
  expect(state.lastApiResponse?.status).toBe(201);
  const id = (state.lastApiResponse?.body as { id: string }).id;
  const stored = await dbService.getCustomerById(id);
  expect(stored?.firstName).toBe(state.extra.sqlInjectionPayload);
});

Then('no unintended database changes should occur', async ({ dbService }) => {
  expect(await dbService.countCustomers()).toBeGreaterThan(0);
});

// --- XSS rendering (UI) ---------------------------------------------------------------------

Given('a customer exists whose name field contains an embedded script payload', async ({ customerApiService, state }) => {
  const payload = '<script>window.__xssFired = true;</script>';
  const createResponse = await customerApiService.create({
    firstName: payload,
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('xss@bankcorp.com'),
  });
  const getResponse = await customerApiService.getById(createResponse.body.id);
  state.customer = getResponse.body;
});

When("I view that customer's details in the UI", async ({ page, appNavigator, registeredUser, state }) => {
  await loginAndOpenCustomerDetails({ appNavigator, registeredUser }, `${state.customer!.firstName} ${state.customer!.lastName}`, state.customer!.lastName);
  state.extra.xssFired = await page.evaluate(() => (window as unknown as { __xssFired?: boolean }).__xssFired ?? false);
});

Then('the payload should be displayed as plain text', async ({ page, state }) => {
  await expect(page.locator('.customer-info h2')).toContainText('<script>');
  void state;
});

Then('no script should execute in the browser', async ({ state }) => {
  expect(state.extra.xssFired).toBe(false);
});

// --- CORS -----------------------------------------------------------------------------------

When('I call the API from an arbitrary, unapproved origin', async ({ unauthenticatedApiClient, state }) => {
  state.lastApiResponse = await unauthenticatedApiClient.get(Endpoints.HEALTH, {
    headers: { Origin: 'https://totally-unapproved-origin.example.com' },
  });
});

Then('the request is currently accepted', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
  expect(state.lastApiResponse?.headers['access-control-allow-origin']).toBeTruthy();
});

Then('this should be flagged as a pre-production hardening item', async () => {
  gapLogger.knownGap('cors() has no origin restriction (Requirement.md R-3) — the API accepted an arbitrary Origin header.');
});

// --- IDOR -------------------------------------------------------------------------------------

When('I request a customer or account by an identifier I did not create', async ({ customerApiService, dbService, state }) => {
  const [existing] = await dbService.query<{ id: string }>('SELECT id FROM customers LIMIT 1');
  state.lastApiResponse = (await customerApiService.getById(existing.id));
});

Then('this should be flagged as an insecure direct object reference risk', async () => {
  gapLogger.knownGap('No ownership model exists (Requirement.md R-2) — any authenticated user can fetch any customer/account by id (IDOR).');
});

// --- Hardcoded JWT secret fallback (isolated backend instance) -------------------------------

Given('the environment does not define a custom signing secret', async ({ state }) => {
  const handle = await BackendProcessManager.spawn({
    port: await ProcessUtils.getFreePort(),
    dbPath: process.env.RUNTIME_DB_PATH!,
    omitEnvKeys: ['JWT_SECRET'],
  });
  state.extra.isolatedBackend = handle;
});

When('a user logs in and a token is issued', async ({ state }) => {
  const handle = state.extra.isolatedBackend as BackendHandle;
  const context = await request.newContext({ baseURL: `${handle.baseUrl}/api/` });
  const authService = new AuthApiService(new ApiClient(context));
  const username = RandomDataGenerator.uniqueUsername('secret_fallback_user');
  const registerResponse = await authService.register({
    username,
    password: 'SecurePass123',
    email: RandomDataGenerator.uniqueEmail('secretfallback@bankcorp.com'),
  });
  state.extra.isolatedToken = (registerResponse.body as AuthSuccessResponse).token;
  await context.dispose();
});

Then('the token is currently signed using a hardcoded default secret', async ({ state }) => {
  const token = state.extra.isolatedToken as string;
  expect(() => jwt.verify(token, 'your_jwt_secret_key')).not.toThrow();
  await (state.extra.isolatedBackend as BackendHandle).stop();
});

Then(
  'this should be flagged as a critical configuration risk requiring remediation before production use',
  async () => {
    gapLogger.knownGap('JWT_SECRET falls back to the hardcoded literal "your_jwt_secret_key" when unset (Requirement.md R-1).');
  },
);
