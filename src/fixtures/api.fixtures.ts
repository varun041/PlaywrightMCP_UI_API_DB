import { APIRequestContext, request } from '@playwright/test';
import { test as dbTest } from '@fixtures/db.fixtures';
import { ApiClient } from '@services/ApiClient';
import { AuthApiService } from '@services/AuthApiService';
import { Urls } from '@constants/urls';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('api.fixtures');

export interface ApiWorkerFixtures {
  /** Worker-scoped anonymous request context against API_BASE_URL — reused for register/login calls so TCP/TLS setup isn't repeated per test. */
  apiRequestContext: APIRequestContext;
}

export interface ApiTestFixtures {
  unauthenticatedApiClient: ApiClient;
  authApiService: AuthApiService;
}

export const test = dbTest.extend<ApiTestFixtures, ApiWorkerFixtures>({
  apiRequestContext: [
    async ({}, use) => {
      const context = await request.newContext({ baseURL: Urls.API_BASE_URL });
      logger.info('Opened worker-scoped APIRequestContext', { baseURL: Urls.API_BASE_URL });
      await use(context);
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  unauthenticatedApiClient: async ({ apiRequestContext }, use) => {
    await use(new ApiClient(apiRequestContext));
  },

  authApiService: async ({ unauthenticatedApiClient }, use) => {
    await use(new AuthApiService(unauthenticatedApiClient));
  },
});
