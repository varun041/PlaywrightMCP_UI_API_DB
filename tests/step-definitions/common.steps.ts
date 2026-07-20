import { Page } from '@playwright/test';
import { Given, When, Then, expect } from './support/bdd';
import { AppNavigator } from '@navigation/AppNavigator';
import { CustomerApiService } from '@services/CustomerApiService';
import { AccountApiService } from '@services/AccountApiService';
import { RegisteredUser } from '@fixtures/auth.fixtures';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { AccessibilityScanner, AccessibilityScanResult } from '@utils/AccessibilityScanner';
import { AccountType } from '@enums/AccountType';
import { Logger } from '@utils/Logger';
import { CustomerDetailsPage } from '@pages/CustomerDetailsPage';

const gapLogger = Logger.forScope('common.steps');

/**
 * Logs in then opens a customer's details screen — the "login, then navigate to a customer" pair
 * every UI scenario needs before it can do anything else. Shared here (rather than re-implemented
 * per step file) so account.steps.ts, customer-profile.steps.ts, security.steps.ts, and
 * transfer.steps.ts don't each carry their own copy of the same two-line sequence.
 */
export async function loginAndOpenCustomerDetails(
  fixtures: { appNavigator: AppNavigator; registeredUser: RegisteredUser },
  fullName: string,
  searchTerm?: string,
): Promise<CustomerDetailsPage> {
  await fixtures.appNavigator.openLogin();
  await fixtures.appNavigator.login(fixtures.registeredUser.username, fixtures.registeredUser.password);
  return fixtures.appNavigator.openCustomerDetails(fullName, searchTerm);
}

/**
 * Steps that are word-for-word identical across multiple `.feature` files. Registering each of
 * these once, here, is what keeps the 10 per-feature step files from re-defining (and Cucumber
 * rejecting as ambiguous) the same step text — see PageObjectModel.md §1 / the plan's "no
 * duplicate code" requirement.
 */

Given('I am logged in as a registered bank staff user', async ({ registeredUser }) => {
  expect(registeredUser.token).toBeTruthy();
});

When('I log out', async ({ authenticatedPage, appNavigator }) => {
  await authenticatedPage.waitUntilReady();
  await appNavigator.logout();
});

Given('a customer record exists', async ({ seededCustomer, state }) => {
  state.customer = seededCustomer;
});

async function navigateForAccessibilityScan(
  target: string,
  ctx: {
    appNavigator: AppNavigator;
    registeredUser: RegisteredUser;
    customerApiService: CustomerApiService;
    accountApiService: AccountApiService;
  },
): Promise<void> {
  const { appNavigator, registeredUser, customerApiService, accountApiService } = ctx;

  if (target.includes('login/registration screen')) {
    await appNavigator.openLogin();
    return;
  }

  await appNavigator.openLogin();
  await appNavigator.login(registeredUser.username, registeredUser.password);

  if (target.includes('Add Customer form')) {
    await appNavigator.openAddCustomerModal();
    return;
  }

  const createResponse = await customerApiService.create({
    firstName: 'A11yScan',
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('a11y.scan@bankcorp.com'),
  });
  const customer = (await customerApiService.getById(createResponse.body.id)).body;
  const fullName = `${customer.firstName} ${customer.lastName}`;

  if (target.includes('Add Account form')) {
    await appNavigator.openCustomerDetails(fullName, customer.lastName);
    await appNavigator.openAddAccountModal();
    return;
  }

  if (target.includes('Transfer Funds form')) {
    const accountResponse = await accountApiService.create(customer.id, {
      accountType: AccountType.CHECKING,
      balance: 100,
    });
    await appNavigator.openCustomerDetails(fullName, customer.lastName);
    await appNavigator.openTransferFundsModal(accountResponse.body.accountNumber);
    return;
  }

  if (target.includes('customer list and customer details screens')) {
    await appNavigator.openCustomerDetails(fullName, customer.lastName);
    return;
  }

  throw new Error(`navigateForAccessibilityScan: no navigation mapping for target "${target}"`);
}

When(
  /^I run an automated accessibility scan on (.+)$/,
  async ({ page, appNavigator, registeredUser, customerApiService, accountApiService, state }, target: string) => {
    await navigateForAccessibilityScan(target, { appNavigator, registeredUser, customerApiService, accountApiService });
    state.extra.accessibilityResult = await AccessibilityScanner.scan(page as Page);
  },
);

Then('no critical or serious accessibility violations should be found', async ({ state }) => {
  const result = state.extra.accessibilityResult as AccessibilityScanResult;
  expect(result.criticalOrSerious, JSON.stringify(result.criticalOrSerious)).toHaveLength(0);
});

Then('the request should be rejected with status {int}', async ({ state }, statusCode: number) => {
  expect(state.lastApiResponse?.status).toBe(statusCode);
});

// Reused verbatim by customer_profile_management.feature (email/phone/dateOfBirth validation gaps)
// and account_management.feature (accountType/currency enum validation gap).
Then('this should be flagged as a missing validation requirement', async () => {
  gapLogger.knownGap('No server-side format/enum validation on this field (Requirement.md R-9).');
});

// Reused verbatim by customer_profile_management.feature (duplicate customer on retry) and
// account_management.feature (duplicate account on retry).
Then('this should be flagged as a missing idempotency safeguard', async () => {
  gapLogger.knownGap('No idempotency key on this endpoint — a network-retry creates a duplicate record.');
});
