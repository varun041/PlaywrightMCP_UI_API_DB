import { Given, When, Then, expect } from './support/bdd';
import { TestData } from '@utils/TestDataLoader';
import { Logger } from '@utils/Logger';
import { SearchFilter } from '@enums/SearchFilter';
import { Timeouts } from '@constants/timeouts';
import { Endpoints } from '@constants/endpoints';
import { ApiResult } from '@services/ApiClient';
import { CustomerRecord } from '@app-types/domain';

const gapLogger = Logger.forScope('customer-search.steps');

Given('the customer directory contains a representative set of seeded customers', async ({ dbService }) => {
  expect(await dbService.countCustomers()).toBeGreaterThan(0);
});

// --- Listing / pagination ------------------------------------------------------------------

When('I request the customer list with default pagination', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.list());
});

Then('a page of customers and the total customer count should be returned', async ({ state }) => {
  const body = state.lastApiResponse?.body as { customers: unknown[]; total: number };
  expect(state.lastApiResponse?.status).toBe(200);
  expect(Array.isArray(body.customers)).toBe(true);
  expect(typeof body.total).toBe('number');
});

When('I request the customer list with a limit of zero', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.list({ limit: 0 }));
});

Then('the current behavior returns the default page size instead of an empty page', async ({ state }) => {
  const body = state.lastApiResponse?.body as { customers: unknown[] };
  expect(body.customers.length).toBe(10);
});

Then('this should be flagged as a boundary-handling gap', async () => {
  gapLogger.knownGap('`parseInt(req.query.limit) || 10` treats limit=0 as falsy, silently falling back to the default page size (TestScenarios.md BND-01).');
});

When('I request the customer list with a limit of one', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.list({ limit: 1 }));
});

Then('exactly one customer should be returned', async ({ state }) => {
  const body = state.lastApiResponse?.body as { customers: unknown[] };
  expect(body.customers.length).toBe(1);
});

When('I request the customer list with a very large limit value', async ({ customerApiService, state }) => {
  const startedAt = Date.now();
  state.lastApiResponse = (await customerApiService.list({ limit: 100_000 }));
  state.extra.lastRequestDurationMs = Date.now() - startedAt;
});

Then('all matching customers should be returned without a server error', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
});

Then('the response time should be recorded for performance tracking', async ({ state }) => {
  expect(typeof state.extra.lastRequestDurationMs).toBe('number');
});

When(
  'I request the customer list with an offset beyond the total number of customers',
  async ({ customerApiService, dbService, state }) => {
    const total = await dbService.countCustomers();
    state.lastApiResponse = (await customerApiService.list({ offset: total + 1000 }));
  },
);

Then('an empty list should be returned without an error', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
  const body = state.lastApiResponse?.body as { customers: unknown[] };
  expect(body.customers.length).toBe(0);
});

// --- Search ----------------------------------------------------------------------------------

When('I search for customers using a name that matches an existing customer', async ({ customerApiService, dbService, state }) => {
  const [existing] = await dbService.query<CustomerRecord>('SELECT * FROM customers LIMIT 1');
  state.extra.knownCustomer = existing;
  state.lastApiResponse = (await customerApiService.search({ query: existing.firstName }));
});

Then('the matching customer should appear in the results', async ({ state }) => {
  const known = state.extra.knownCustomer as CustomerRecord;
  const body = state.lastApiResponse?.body as { customers: CustomerRecord[] };
  expect(body.customers.some((customer) => customer.id === known.id)).toBe(true);
});

When(
  "I search for customers using the email filter with a known customer's email",
  async ({ customerApiService, dbService, state }) => {
    const [existing] = await dbService.query<CustomerRecord>('SELECT * FROM customers LIMIT 1');
    state.extra.knownCustomer = existing;
    state.lastApiResponse = (await customerApiService.search({
      query: existing.email,
      filter: SearchFilter.EMAIL,
    }));
  },
);

Then('only customers matching that email should be returned', async ({ state }) => {
  const known = state.extra.knownCustomer as CustomerRecord;
  const body = state.lastApiResponse?.body as { customers: CustomerRecord[] };
  expect(body.customers.length).toBeGreaterThan(0);
  expect(body.customers.every((customer) => customer.email.includes(known.email))).toBe(true);
});

When(
  "I search for customers using the phone filter with a known customer's phone number",
  async ({ customerApiService, dbService, state }) => {
    const [existing] = await dbService.query<CustomerRecord>(
      "SELECT * FROM customers WHERE phone IS NOT NULL AND phone != '' LIMIT 1",
    );
    state.extra.knownCustomer = existing;
    state.lastApiResponse = (await customerApiService.search({
      query: existing.phone!,
      filter: SearchFilter.PHONE,
    }));
  },
);

Then('only customers matching that phone number should be returned', async ({ state }) => {
  const known = state.extra.knownCustomer as CustomerRecord;
  const body = state.lastApiResponse?.body as { customers: CustomerRecord[] };
  expect(body.customers.length).toBeGreaterThan(0);
  expect(body.customers.every((customer) => (customer.phone ?? '').includes(known.phone ?? ''))).toBe(true);
});

When('I search for customers without providing a query', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.search({}));
});

When('I search for customers using a single-character query', async ({ customerApiService, state }) => {
  state.lastApiResponse = (await customerApiService.search({ query: 'a' }));
});

Then('broadly matching results should be returned without an error', async ({ state }) => {
  expect(state.lastApiResponse?.status).toBe(200);
});

When('I search for customers using test data {string}', async ({ customerApiService, state }, testCaseId: string) => {
  const entry = TestData.customerSearchAndDirectory.get(testCaseId);
  state.lastApiResponse = (await customerApiService.search({ query: entry.query }));
});

Then(
  'those characters should be treated as literal search characters, not SQL wildcards with unintended effect',
  async ({ state, dbService }) => {
    expect(state.lastApiResponse?.status).toBe(200);
    expect(await dbService.countCustomers()).toBeGreaterThan(0);
  },
);

// --- Performance smoke -------------------------------------------------------------------------

When('I request the customer list against the seeded dataset', async ({ customerApiService, state }) => {
  const startedAt = Date.now();
  state.lastApiResponse = (await customerApiService.list());
  state.extra.lastRequestDurationMs = Date.now() - startedAt;
});

When('I search customers with a broad query against the seeded dataset', async ({ customerApiService, state }) => {
  const startedAt = Date.now();
  state.lastApiResponse = (await customerApiService.search({ query: 'a' }));
  state.extra.lastRequestDurationMs = Date.now() - startedAt;
});

Then('the response should complete within the agreed performance threshold', async ({ state }) => {
  expect(state.extra.lastRequestDurationMs as number).toRespondWithinThreshold(Timeouts.PERFORMANCE_THRESHOLD_MS);
});

When('I request the customer list with a very large limit under light concurrent load', async ({ apiClient, state }) => {
  const calls = Array.from({ length: Timeouts.LIGHT_LOAD_CONCURRENCY }, async () => {
    const startedAt = Date.now();
    const response = await apiClient.get(Endpoints.CUSTOMERS.BASE, { params: { limit: 100_000 } });
    return { response, durationMs: Date.now() - startedAt };
  });
  state.extra.lightLoadResults = await Promise.all(calls);
});

Then('the response time degradation, if any, should be measured and documented', async ({ state }) => {
  const results = state.extra.lightLoadResults as { response: ApiResult<unknown>; durationMs: number }[];
  for (const result of results) {
    expect(result.response.status).toBe(200);
  }
  const durations = results.map((result) => result.durationMs);
  gapLogger.info('Large-limit list under concurrent load', {
    concurrency: durations.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
  });
});
