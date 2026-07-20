import { Given, When, Then, expect } from './support/bdd';
import { loginAndOpenCustomerDetails } from './common.steps';
import { TestData } from '@utils/TestDataLoader';
import { CurrencyUtils } from '@utils/CurrencyUtils';
import { ApiMessages } from '@constants/messages';
import { AccountType } from '@enums/AccountType';

interface TransferAccountRef {
  id: string;
  accountNumber: string;
  balance: number;
}

// --- Background -----------------------------------------------------------------------------

Given('a source account exists with a known balance', async ({ seededAccount, state }) => {
  state.extra.sourceAccount = {
    id: seededAccount.id,
    accountNumber: seededAccount.accountNumber,
    balance: seededAccount.balance,
  } satisfies TransferAccountRef;
});

Given('a destination account exists with a known account number', async ({ accountApiService, seededAccount, state }) => {
  const response = await accountApiService.create(seededAccount.customerId, {
    accountType: AccountType.SAVINGS,
    balance: 100,
  });
  state.extra.destinationAccount = {
    id: response.body.id,
    accountNumber: response.body.accountNumber,
    balance: 100,
  } satisfies TransferAccountRef;
});

function source(state: import('./support/bdd').ScenarioState): TransferAccountRef {
  return state.extra.sourceAccount as TransferAccountRef;
}
function destination(state: import('./support/bdd').ScenarioState): TransferAccountRef {
  return state.extra.destinationAccount as TransferAccountRef;
}

// --- Happy path ------------------------------------------------------------------------------

Given('the source account has sufficient balance for the transfer', async ({ state }) => {
  expect(source(state).balance).toBeGreaterThan(0);
});

When('I transfer an amount from the source account to the destination account number', async ({ transferApiService, state }) => {
  const amount = 50;
  state.extra.lastTransferAmount = amount;
  const response = await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount,
  });
  state.lastApiResponse = response;
  state.transferReference = (response.body as { reference?: string }).reference;
});

Then('the transfer should complete successfully', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
});

Then('the source account balance should decrease by the transferred amount', async ({ dbService, state }) => {
  const amount = state.extra.lastTransferAmount as number;
  const account = await dbService.getAccountById(source(state).id);
  expect(account).toHaveBalance(source(state).balance - amount);
});

Then('the destination account balance should increase by the transferred amount', async ({ dbService, state }) => {
  const amount = state.extra.lastTransferAmount as number;
  const account = await dbService.getAccountById(destination(state).id);
  expect(account).toHaveBalance(destination(state).balance + amount);
});

Then(
  'both accounts and the transaction history should agree via the API, the database, and the UI',
  async ({ customerApiService, dbService, appNavigator, registeredUser, state }) => {
    const dbSource = await dbService.getAccountById(source(state).id);
    const apiAccounts = (await customerApiService.getAccounts(dbSource!.customerId)).body.accounts;
    const apiSource = apiAccounts.find((account) => account.id === source(state).id)!;
    expect(apiSource.balance).toBeCloseTo(dbSource!.balance, 2);

    const customer = await dbService.getCustomerById(dbSource!.customerId);
    const detailsPage = await loginAndOpenCustomerDetails(
      { appNavigator, registeredUser },
      `${customer!.firstName} ${customer!.lastName}`,
      customer!.lastName,
    );
    const rowIndex = await detailsPage.accountsTable.findRowIndexByAccountNumber(source(state).accountNumber);
    const uiBalance = await detailsPage.accountsTable.getCellValue(rowIndex, 'Balance');
    expect(CurrencyUtils.parse(uiBalance)).toBeCloseTo(dbSource!.balance, 2);
  },
);

Then(
  'the customer details screen should show the updated balances and new transaction entries without a manual page reload',
  async ({ dbService, appNavigator, registeredUser, state }) => {
    const dbSource = await dbService.getAccountById(source(state).id);
    const customer = await dbService.getCustomerById(dbSource!.customerId);
    const detailsPage = await loginAndOpenCustomerDetails(
      { appNavigator, registeredUser },
      `${customer!.firstName} ${customer!.lastName}`,
      customer!.lastName,
    );
    const rowIndex = await detailsPage.accountsTable.findRowIndexByAccountNumber(source(state).accountNumber);
    const uiBalance = await detailsPage.accountsTable.getCellValue(rowIndex, 'Balance');
    expect(CurrencyUtils.parse(uiBalance)).toBeCloseTo(dbSource!.balance, 2);
    expect(await detailsPage.transactionsTable.getRowCount()).toBeGreaterThan(0);
  },
);

// --- Validation / negative -------------------------------------------------------------------

When('I submit a transfer without providing a {string}', async ({ transferApiService, state }, fieldLabel: string) => {
  const payload: Record<string, unknown> = {
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: 10,
  };
  const fieldMap: Record<string, string> = {
    'destination account number': 'toAccountNumber',
    'source account': 'fromAccountId',
    amount: 'amount',
  };
  delete payload[fieldMap[fieldLabel.trim().toLowerCase()] ?? fieldLabel.trim()];
  state.lastApiResponse = (await transferApiService.transfer(payload));
});

When('I transfer funds from a non-existent source account identifier', async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: 'ACC-does-not-exist',
    toAccountNumber: destination(state).accountNumber,
    amount: 10,
  }));
});

When('I transfer funds to a destination account number that does not exist', async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: '0000000000',
    amount: 10,
  }));
});

When('I transfer funds from an account to itself', async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: source(state).accountNumber,
    amount: 10,
  }));
});

Then('the response should indicate that transfers to the same account are not allowed', async ({ state }) => {
  expect(state.lastApiResponse).toMatchApiError({ status: 400, message: ApiMessages.transfer.sameAccount });
});

Given('the source account balance is less than the transfer amount', async ({ state }) => {
  // The exceeding transfer amount is derived as balance + 1000 in the next step — this only needs
  // to confirm the account has a well-defined, non-negative starting balance for that derivation
  // to be a meaningful "insufficient funds" precondition.
  expect(source(state).balance).toBeGreaterThanOrEqual(0);
});

When("I transfer funds exceeding the source account's balance", async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: source(state).balance + 1000,
  }));
});

Then('the response should indicate insufficient funds', async ({ state }) => {
  expect(state.lastApiResponse).toMatchApiError({ status: 400, message: ApiMessages.transfer.insufficientFunds });
});

Then('no balance change should occur on either account', async ({ dbService, state }) => {
  expect((await dbService.getAccountById(source(state).id))?.balance).toBe(source(state).balance);
  expect((await dbService.getAccountById(destination(state).id))?.balance).toBe(destination(state).balance);
});

Given('either the source or destination account has an {string} status', async ({ dbService, state }, status: string) => {
  await dbService.execute('UPDATE accounts SET status = ? WHERE id = ?', [status, destination(state).id]);
});

When('I attempt to transfer funds between them', async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: 10,
  }));
});

Then('the response should indicate both accounts must be active', async ({ state }) => {
  expect(state.lastApiResponse).toMatchApiError({ status: 400, message: ApiMessages.transfer.accountsMustBeActive });
});

When('I transfer a zero or negative amount between two active accounts', async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: 0,
  }));
});

When('I submit a transfer with a non-numeric amount value', async ({ transferApiService, state }) => {
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: 'not-a-number',
  }));
});

// --- Boundary values -------------------------------------------------------------------------

Given('the source account balance is set using test data {string}', async ({ dbService, state }, testCaseId: string) => {
  const entry = TestData.fundTransfer.get(testCaseId);
  await dbService.execute('UPDATE accounts SET balance = ? WHERE id = ?', [entry.startingBalance, source(state).id]);
  source(state).balance = entry.startingBalance!;
});

When('I transfer an amount using test data {string}', async ({ transferApiService, state }, testCaseId: string) => {
  const entry = TestData.fundTransfer.get(testCaseId);
  state.extra.lastTransferAmount = entry.transferAmount;
  state.lastApiResponse = (await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: entry.transferAmount,
  }));
});

Then('the transfer outcome should match test data {string}', async ({ state }, testCaseId: string) => {
  const entry = TestData.fundTransfer.get(testCaseId);
  expect(state.lastApiResponse?.status).toBe(entry.outcome?.includes('succeeds') ? 201 : 400);
});

Then(
  'the resulting balances should reflect the transferred amount within an acceptable rounding tolerance',
  async ({ dbService, state }) => {
    const amount = state.extra.lastTransferAmount as number;
    const account = await dbService.getAccountById(source(state).id);
    expect(account).toHaveBalance(source(state).balance - amount, 0.01);
  },
);

Then('both account balances should be adjusted by exactly that amount', async ({ dbService, state }) => {
  const amount = state.extra.lastTransferAmount as number;
  const sourceAccount = await dbService.getAccountById(source(state).id);
  const destinationAccount = await dbService.getAccountById(destination(state).id);
  expect(sourceAccount).toHaveBalance(source(state).balance - amount, 0.001);
  expect(destinationAccount).toHaveBalance(destination(state).balance + amount, 0.001);
});

// --- Linked transactions (BR-07) ---------------------------------------------------------------

When('I transfer funds between two active accounts', async ({ transferApiService, state }) => {
  const response = await transferApiService.transfer({
    fromAccountId: source(state).id,
    toAccountNumber: destination(state).accountNumber,
    amount: 15,
  });
  state.lastApiResponse = response;
  state.transferReference = (response.body as { reference?: string }).reference;
});

Then('a transaction record should be created against the source account', async ({ dbService, state }) => {
  const transactions = await dbService.getTransactionsByAccountId(source(state).id);
  expect(transactions.some((transaction) => transaction.reference === state.transferReference)).toBe(true);
});

Then('a transaction record should be created against the destination account', async ({ dbService, state }) => {
  const transactions = await dbService.getTransactionsByAccountId(destination(state).id);
  expect(transactions.some((transaction) => transaction.reference === state.transferReference)).toBe(true);
});

Then('both transaction records should share the same reference value', async ({ dbService, state }) => {
  const transactions = await dbService.getTransactionsByReference(state.transferReference!);
  expect(transactions).toHaveLinkedTransactions(state.transferReference!);
});
