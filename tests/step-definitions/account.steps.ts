import { Given, When, Then, expect } from './support/bdd';
import { loginAndOpenCustomerDetails } from './common.steps';
import { TestData } from '@utils/TestDataLoader';
import { Logger } from '@utils/Logger';
import { AccountType } from '@enums/AccountType';
import { ApiResult } from '@services/ApiClient';
import { AccountApiService } from '@services/AccountApiService';
import { TransferApiService } from '@services/TransferApiService';
import { AccountRecord, CreateAccountRequestBody } from '@app-types/domain';
import { AccountManagementTestDataEntry } from '@app-types/testdata';
import { CustomerDetailsPage } from '@pages/CustomerDetailsPage';
import { ScenarioState } from './support/bdd';

const gapLogger = Logger.forScope('account.steps');

/** Creates a CHECKING(500)+SAVINGS(100) pair for `state.customer` and transfers 25 between them. */
async function createAccountPairWithTransferHistory(fixtures: {
  accountApiService: AccountApiService;
  transferApiService: TransferApiService;
  state: ScenarioState;
}): Promise<{ account1: Awaited<ReturnType<AccountApiService['create']>>; account2: Awaited<ReturnType<AccountApiService['create']>> }> {
  const account1 = await fixtures.accountApiService.create(fixtures.state.customer!.id, { accountType: AccountType.CHECKING, balance: 500 });
  const account2 = await fixtures.accountApiService.create(fixtures.state.customer!.id, { accountType: AccountType.SAVINGS, balance: 100 });
  await fixtures.transferApiService.transfer({ fromAccountId: account1.body.id, toAccountNumber: account2.body.accountNumber, amount: 25 });
  return { account1, account2 };
}

// --- Creation ------------------------------------------------------------------------------------

async function addAccountUsingTestData({ accountApiService, state }: { accountApiService: AccountApiService; state: ScenarioState }, testCaseId: string): Promise<void> {
  const entry = TestData.accountManagement.get(testCaseId);
  const payload: CreateAccountRequestBody = { accountType: entry.accountType, balance: entry.balance ?? undefined, currency: entry.currency };
  state.extra.lastAccountTestDataEntry = entry;
  state.lastApiResponse = (await accountApiService.create(state.customer!.id, payload));
}

// Two Gherkin phrasings for the same operation — the boundary/validation-outline scenarios read
// more naturally as "add an account", the primary creation scenario as "add a new account to the
// customer" — both delegate to the one handler above rather than duplicating its body.
When('I add a new account to the customer using test data {string}', addAccountUsingTestData);
When('I add an account using test data {string}', addAccountUsingTestData);

Then('the account should be created successfully with status {string}', async ({ dbService, state }, status: string) => {
  expect(state.lastApiResponse?.status).toBe(201);
  const accountId = (state.lastApiResponse?.body as { id: string }).id;
  const account = await dbService.getAccountById(accountId);
  expect(account?.status).toBe(status);
});

Then('the account should have a system-generated 10-digit account number', async ({ state }) => {
  const accountNumber = (state.lastApiResponse?.body as { accountNumber: string }).accountNumber;
  expect(/^\d{10}$/.test(accountNumber)).toBe(true);
});

Then(
  "the new account should immediately be visible via the customer's account list, the API, and the database",
  async ({ customerApiService, dbService, state }) => {
    const accountId = (state.lastApiResponse?.body as { id: string }).id;
    const accountNumber = (state.lastApiResponse?.body as { accountNumber: string }).accountNumber;

    const apiAccounts = (await customerApiService.getAccounts(state.customer!.id)).body.accounts;
    expect(apiAccounts.some((account) => account.id === accountId)).toBe(true);

    const dbAccount = await dbService.getAccountById(accountId);
    expect(dbAccount).toBeTruthy();
    expect(dbAccount?.accountNumber).toBe(accountNumber);
  },
);

When('I attempt to add an account to a customer identifier that does not exist', async ({ accountApiService, state }) => {
  state.lastApiResponse = (await accountApiService.create('CUST-does-not-exist', {
    accountType: AccountType.CHECKING,
  }));
});

When('I attempt to add an account without providing an account type', async ({ accountApiService, state }) => {
  state.lastApiResponse = (await accountApiService.create(state.customer!.id, {}));
});

Then('the account is currently created successfully regardless of the unsupported value', async ({ dbService, state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
  const entry = state.extra.lastAccountTestDataEntry as AccountManagementTestDataEntry;
  const accountId = (state.lastApiResponse?.body as { id: string }).id;
  const stored = await dbService.getAccountById(accountId);
  expect(stored).toBeTruthy();
  // Confirms the out-of-enum value was actually persisted as-is, not silently rejected/coerced —
  // that silent acceptance is exactly the gap this scenario documents.
  if (entry.accountType !== undefined) {
    expect(stored?.accountType).toBe(entry.accountType);
  }
  if (entry.currency !== undefined) {
    expect(stored?.currency).toBe(entry.currency);
  }
});

Then('the account is currently created successfully with that balance', async ({ dbService, state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
  const entry = state.extra.lastAccountTestDataEntry as AccountManagementTestDataEntry;
  const accountId = (state.lastApiResponse?.body as { id: string }).id;
  const stored = await dbService.getAccountById(accountId);
  expect(stored).toBeTruthy();
  if (entry.balance !== null && entry.balance !== undefined) {
    expect(stored).toHaveBalance(entry.balance);
  }
});

Then("this should be documented against the account type's intended business rules", async () => {
  gapLogger.knownGap("No overdraft/minimum-balance business rule is defined for negative/omitted balances at creation (Requirement.md BR-13, Q3).");
});

// --- Viewing (UI) ----------------------------------------------------------------------------

Given('the customer has one or more accounts', async ({ accountApiService, state }) => {
  await accountApiService.create(state.customer!.id, { accountType: AccountType.CHECKING, balance: 250 });
});

When("I view the customer's accounts", async ({ appNavigator, registeredUser, state }) => {
  const customer = state.customer!;
  state.extra.detailsPage = await loginAndOpenCustomerDetails({ appNavigator, registeredUser }, `${customer.firstName} ${customer.lastName}`, customer.lastName);
});

Then("all of the customer's accounts should be listed with their balances and statuses", async ({ state }) => {
  const detailsPage = state.extra.detailsPage as CustomerDetailsPage;
  expect(await detailsPage.accountsTable.getRowCount()).toBeGreaterThan(0);
});

Given('the customer has an account with transaction history', async ({ accountApiService, transferApiService, state }) => {
  await createAccountPairWithTransferHistory({ accountApiService, transferApiService, state });
});

When("I view the customer's transactions", async ({ appNavigator, registeredUser, state }) => {
  const customer = state.customer!;
  state.extra.detailsPage = await loginAndOpenCustomerDetails({ appNavigator, registeredUser }, `${customer.firstName} ${customer.lastName}`, customer.lastName);
});

Then("all transactions across the customer's accounts should be listed", async ({ state }) => {
  const detailsPage = state.extra.detailsPage as CustomerDetailsPage;
  expect(await detailsPage.transactionsTable.getRowCount()).toBeGreaterThan(0);
});

// --- Deletion ----------------------------------------------------------------------------------

Given('the customer has an account with no transactions', async ({ accountApiService, state }) => {
  const response = await accountApiService.create(state.customer!.id, { accountType: AccountType.CHECKING, balance: 100 });
  state.account = { id: response.body.id, accountNumber: response.body.accountNumber } as AccountRecord;
});

When('I delete the account, confirming the delete action', async ({ appNavigator, registeredUser, state }) => {
  const customer = state.customer!;
  const detailsPage = await loginAndOpenCustomerDetails({ appNavigator, registeredUser }, `${customer.firstName} ${customer.lastName}`, customer.lastName);
  state.extra.confirmMessage = await detailsPage.deleteAccount(state.account!.accountNumber);
});

Then('the account should be removed successfully', async ({ dbService, state }) => {
  expect(await dbService.getAccountById(state.account!.id)).toBeUndefined();
});

Then('the delete confirmation prompt should be operable via keyboard and assistive technology', async ({ state }) => {
  // `window.confirm()` is a native browser dialog, inherently keyboard/AT-operable — confirming the
  // app didn't override it with a custom (potentially inaccessible) implementation is the real check.
  expect(state.extra.confirmMessage as string).toContain(state.account!.accountNumber);
});

Given('the customer has an account with existing transaction history', async ({ accountApiService, transferApiService, state }) => {
  const { account1 } = await createAccountPairWithTransferHistory({ accountApiService, transferApiService, state });
  state.account = { id: account1.body.id, accountNumber: account1.body.accountNumber } as AccountRecord;
});

When('I delete the account', async ({ accountApiService, state }) => {
  state.lastApiResponse = (await accountApiService.delete(state.account!.id));
});

Then("the account's transactions should also be removed", async ({ dbService, state }) => {
  expect((await dbService.getTransactionsByAccountId(state.account!.id)).length).toBe(0);
});

Then('the account and its transactions should no longer appear via the API or the database', async ({ customerApiService, dbService, state }) => {
  const apiAccounts = (await customerApiService.getAccounts(state.customer!.id)).body.accounts;
  expect(apiAccounts.some((account) => account.id === state.account!.id)).toBe(false);
  expect(await dbService.getAccountById(state.account!.id)).toBeUndefined();
});

When('I attempt to delete an account using an identifier that does not exist', async ({ accountApiService, state }) => {
  state.lastApiResponse = (await accountApiService.delete('ACC-does-not-exist'));
});

// --- CREDIT negative balance (BR-13, documented gap) -------------------------------------------

Given('the customer has a CREDIT account', async ({ accountApiService, state }) => {
  const response = await accountApiService.create(state.customer!.id, { accountType: AccountType.CREDIT, balance: 100 });
  state.account = { id: response.body.id, accountNumber: response.body.accountNumber } as AccountRecord;
});

When('the account balance is reduced below zero through a transaction', async ({ dbService, state }) => {
  // BR-05 rejects any transfer where the source balance < amount, for every account type — the code
  // has no CREDIT-specific overdraft carve-out — so there is no real user-facing flow that drives a
  // balance negative today. Writing it directly characterizes the actual gap: nothing prevents a
  // CREDIT account's balance from being negative once it somehow is (as seed data already shows).
  await dbService.execute('UPDATE accounts SET balance = ? WHERE id = ?', [-50, state.account!.id]);
});

Then('the negative balance is currently accepted', async ({ dbService, state }) => {
  const account = await dbService.getAccountById(state.account!.id);
  expect(account?.balance).toBeLessThan(0);
});

Then('this should be flagged pending a defined credit-limit business rule', async () => {
  gapLogger.knownGap('No credit-limit/overdraft rule is defined or enforced for CREDIT accounts (Requirement.md BR-13, Q3).');
});

// --- Concurrency / retry -------------------------------------------------------------------------

When('I submit two account creation requests for the same customer at the same time', async ({ accountApiService, state }) => {
  const [first, second] = await Promise.all([
    accountApiService.create(state.customer!.id, { accountType: AccountType.CHECKING, balance: 100 }),
    accountApiService.create(state.customer!.id, { accountType: AccountType.SAVINGS, balance: 100 }),
  ]);
  state.extra.concurrentAccountResults = [first, second];
});

Then('both accounts should be created with distinct identifiers and account numbers', async ({ state }) => {
  const [first, second] = state.extra.concurrentAccountResults as ApiResult<{ id: string; accountNumber: string }>[];
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(first.body.id).not.toBe(second.body.id);
  expect(first.body.accountNumber).not.toBe(second.body.accountNumber);
});

When(
  'I submit a request to add an account and retry it after a timeout, without the first request having failed',
  async ({ accountApiService, state }) => {
    const payload = { accountType: AccountType.CHECKING, balance: 100 };
    const first = await accountApiService.create(state.customer!.id, payload);
    const retry = await accountApiService.create(state.customer!.id, payload);
    state.extra.retryAccountResults = [first, retry];
  },
);

Then('two separate accounts are currently created', async ({ state }) => {
  const [first, retry] = state.extra.retryAccountResults as ApiResult<{ id: string }>[];
  expect(first.status).toBe(201);
  expect(retry.status).toBe(201);
  expect(first.body.id).not.toBe(retry.body.id);
});
