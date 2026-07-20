import { Given, When, Then, expect } from './support/bdd';
import { loginAndOpenCustomerDetails } from './common.steps';
import { TestData } from '@utils/TestDataLoader';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { Logger } from '@utils/Logger';
import { ApiMessages } from '@constants/messages';
import { ApiResult } from '@services/ApiClient';
import { CustomerApiService } from '@services/CustomerApiService';
import { AccountType } from '@enums/AccountType';
import { CreateCustomerRequestBody, CustomerRecord } from '@app-types/domain';
import { CustomerProfileManagementTestDataEntry } from '@app-types/testdata';
import { CustomerDetailsPage } from '@pages/CustomerDetailsPage';
import { ScenarioState } from './support/bdd';

const gapLogger = Logger.forScope('customer-profile.steps');

function buildCreatePayload(entry: CustomerProfileManagementTestDataEntry): CreateCustomerRequestBody {
  return {
    firstName: entry.firstName ?? 'Test',
    lastName: entry.lastName ?? RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail(entry.email ?? 'customer@bankcorp.com'),
    phone: entry.phone,
    dateOfBirth: entry.dateOfBirth,
    address: entry.address,
  };
}

// --- Viewing ------------------------------------------------------------------------------------

When("I view that customer's profile", async ({ appNavigator, registeredUser, state }) => {
  const customer = state.customer!;
  state.extra.detailsPage = await loginAndOpenCustomerDetails({ appNavigator, registeredUser }, `${customer.firstName} ${customer.lastName}`, customer.lastName);
});

Then('their name, contact details, and address should be displayed correctly', async ({ state }) => {
  const detailsPage = state.extra.detailsPage as CustomerDetailsPage;
  const profile = await detailsPage.getProfile();
  const customer = state.customer!;
  expect(profile.fullName).toBe(`${customer.firstName} ${customer.lastName}`);
  expect(profile.email).toBe(customer.email);
  if (customer.phone) {
    expect(profile.phone).toContain(customer.phone);
  }
  if (customer.address_street) {
    expect(profile.address).toContain(customer.address_street);
  }
});

When('I view a customer using an identifier that does not exist', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.getById('CUST-does-not-exist'));
});

// --- Creation ------------------------------------------------------------------------------------

async function createCustomerUsingTestData({ customerApiService, state }: { customerApiService: CustomerApiService; state: ScenarioState }, testCaseId: string): Promise<void> {
  const payload = buildCreatePayload(TestData.customerProfileManagement.get(testCaseId));
  state.extra.lastCreatePayload = payload;
  state.lastApiResponse = (await customerApiService.create(payload));
}

// Two Gherkin phrasings for the same operation — both delegate to the one handler above rather
// than duplicating its body.
When('I create a new customer using test data {string}', createCustomerUsingTestData);
When('I create a customer using test data {string}', createCustomerUsingTestData);

When('I create a customer providing only the required fields and leaving phone and address empty', async ({ customerApiService, state }) => {
  const payload: CreateCustomerRequestBody = {
    firstName: 'MinimalOnly',
    lastName: RandomDataGenerator.uniqueSuffix(),
    email: RandomDataGenerator.uniqueEmail('minimal@bankcorp.com'),
  };
  state.extra.lastCreatePayload = payload;
  state.lastApiResponse = (await customerApiService.create(payload));
});

When('I attempt to create a customer without providing a {string}', async ({ customerApiService, state }, fieldLabel: string) => {
  const base = buildCreatePayload(TestData.customerProfileManagement.get('POS-08'));
  const payload: Record<string, unknown> = { ...base };
  const fieldMap: Record<string, string> = { 'last name': 'lastName', 'first name': 'firstName', email: 'email' };
  const key = fieldMap[fieldLabel.trim().toLowerCase()] ?? fieldLabel.trim();
  delete payload[key];
  state.lastApiResponse = (await customerApiService.create(payload));
});

Then('the customer should be created successfully', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
});

Then('the customer should be retrievable with the details I provided', async ({ customerApiService, state }) => {
  const id = (state.lastApiResponse?.body as { id: string }).id;
  const getResponse = await customerApiService.getById(id);
  const payload = state.extra.lastCreatePayload as CreateCustomerRequestBody;
  expect(getResponse.status).toBe(200);
  const customer = getResponse.body as CustomerRecord;
  expect(customer.firstName).toBe(payload.firstName);
  expect(customer.lastName).toBe(payload.lastName);
  expect(customer.email).toBe(payload.email);
});

Then('the customer should be created successfully with the optional fields stored as empty or null', async ({ customerApiService, state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
  const id = (state.lastApiResponse?.body as { id: string }).id;
  const customer = (await customerApiService.getById(id)).body as CustomerRecord;
  expect(customer.phone === null || customer.phone === '').toBe(true);
  expect(customer.address_street === null || customer.address_street === '').toBe(true);
});

Then('the response should indicate the missing required field', async ({ state }) => {
  expect(state.lastApiResponse).toMatchApiError({ status: 400, message: ApiMessages.customers.missingCreateFields });
});

Then('the customer is currently created successfully regardless of email format or length', async ({ customerApiService, state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
  // Confirms the out-of-format/overlong email was actually persisted as submitted, not silently
  // rejected/truncated — that silent acceptance is exactly the gap this scenario documents.
  const payload = state.extra.lastCreatePayload as CreateCustomerRequestBody;
  const id = (state.lastApiResponse?.body as { id: string }).id;
  const stored = (await customerApiService.getById(id)).body as CustomerRecord;
  expect(stored.email).toBe(payload.email);
});

Then('the customer is currently created successfully', async ({ customerApiService, state }) => {
  expect(state.lastApiResponse?.status).toBe(201);
  const payload = state.extra.lastCreatePayload as CreateCustomerRequestBody;
  const id = (state.lastApiResponse?.body as { id: string }).id;
  const stored = (await customerApiService.getById(id)).body as CustomerRecord;
  if (payload.phone !== undefined) {
    expect(stored.phone).toBe(payload.phone);
  }
  if (payload.dateOfBirth !== undefined) {
    expect(stored.dateOfBirth).toBe(payload.dateOfBirth);
  }
});

// "this should be flagged as a missing validation requirement" is shared with account_management.feature — see common.steps.ts.

// --- Update -------------------------------------------------------------------------------------

When("I update the customer's phone number and address", async ({ customerApiService, state }) => {
  const update = {
    phone: '555-9999',
    address: { street: '456 Updated Ave', city: 'Metropolis', state: 'NY', zipCode: '10001', country: 'USA' },
  };
  state.lastApiResponse = (await customerApiService.update(state.customer!.id, update));
});

Then("the customer's profile should reflect the updated details", async ({ customerApiService, state }) => {
  const updated = (await customerApiService.getById(state.customer!.id)).body as CustomerRecord;
  expect(updated.phone).toBe('555-9999');
  expect(updated.address_street).toBe('456 Updated Ave');
});

When('I update a customer using an identifier that does not exist', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.update('CUST-does-not-exist', { firstName: 'Ghost' }));
});

Then('the current response indicates success despite no matching record', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
});

Then('this should be flagged as a gap requiring an existence check', async () => {
  gapLogger.knownGap('PUT/DELETE /customers/:id perform no existence check (TestScenarios.md NEG-10/NEG-11).');
});

// --- Delete --------------------------------------------------------------------------------------

Given('a customer record exists with no accounts', async ({ seededCustomer, state }) => {
  state.customer = seededCustomer;
});

When('I delete the customer', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.delete(state.customer!.id));
});

Then('the customer should no longer be retrievable', async ({ customerApiService, state }) => {
  const getResponse = await customerApiService.getById(state.customer!.id);
  expect(getResponse.status).toBe(404);
});

When('I delete a customer using an identifier that does not exist', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.delete('CUST-does-not-exist'));
});

// --- Orphaned data on delete (BR-03, R-6) -----------------------------------------------------

Given(
  'a customer exists with an account that has transaction history',
  async ({ customerApiService, accountApiService, transferApiService, state }) => {
    const createResponse = await customerApiService.create({
      firstName: 'OrphanCheck',
      lastName: RandomDataGenerator.uniqueSuffix(),
      email: RandomDataGenerator.uniqueEmail('orphan.check@bankcorp.com'),
    });
    const customer = (await customerApiService.getById(createResponse.body.id)).body as CustomerRecord;
    const account1 = await accountApiService.create(customer.id, { accountType: AccountType.CHECKING, balance: 500 });
    const account2 = await accountApiService.create(customer.id, { accountType: AccountType.SAVINGS, balance: 500 });
    await transferApiService.transfer({
      fromAccountId: account1.body.id,
      toAccountNumber: account2.body.accountNumber,
      amount: 50,
    });
    state.customer = customer;
    state.extra.orphanAccountId = account1.body.id;
  },
);

Then('the customer record should no longer be retrievable', async ({ customerApiService, state }) => {
  const getResponse = await customerApiService.getById(state.customer!.id);
  expect(getResponse.status).toBe(404);
});

Then("the customer's accounts and transactions should still exist in the database", async ({ dbService, state }) => {
  expect(await dbService.countAccountsForCustomer(state.customer!.id)).toBeGreaterThan(0);
  const transactions = await dbService.getTransactionsByAccountId(state.extra.orphanAccountId as string);
  expect(transactions.length).toBeGreaterThan(0);
});

Then('this should be flagged as an orphaned-data risk', async () => {
  gapLogger.knownGap('Deleting a customer does not cascade-delete accounts/transactions (Requirement.md R-6/BR-11).');
});

// --- Retry / idempotency ------------------------------------------------------------------------

When(
  'I submit a request to create a customer and retry it after a timeout, without the first request having failed',
  async ({ customerApiService, state }) => {
    const payload: CreateCustomerRequestBody = {
      firstName: 'RetryDup',
      lastName: RandomDataGenerator.uniqueSuffix(),
      email: RandomDataGenerator.uniqueEmail('retry.dup@bankcorp.com'),
    };
    const first = await customerApiService.create(payload);
    const retry = await customerApiService.create(payload);
    state.extra.retryCreateResults = [first, retry];
  },
);

Then('the retry currently fails with an unhandled server error instead of a clean conflict response', async ({ state }) => {
  // customers.email is UNIQUE, so an identical retry can never actually create a second row — but
  // the route has no idempotency key and no constraint-violation handling, so the retry's INSERT
  // hits the UNIQUE constraint and the generic catch-all turns it into a raw 500 instead of a clean
  // 409/4xx. That combination (no idempotency safeguard + unhandled constraint error) is the gap.
  const [first, retry] = state.extra.retryCreateResults as ApiResult<{ id: string }>[];
  expect(first.status).toBe(201);
  expect(retry.status).toBe(500);
});

// "this should be flagged as a missing idempotency safeguard" is shared with account_management.feature — see common.steps.ts.
