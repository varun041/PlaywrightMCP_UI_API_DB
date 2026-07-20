import { test as apiTest } from '@fixtures/api.fixtures';
import { ApiClient } from '@services/ApiClient';
import { CustomerApiService } from '@services/CustomerApiService';
import { AccountApiService } from '@services/AccountApiService';
import { TransferApiService } from '@services/TransferApiService';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { TokenUtils } from '@utils/TokenUtils';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('auth.fixtures');

export interface RegisteredUser {
  userId: string;
  username: string;
  password: string;
  email: string;
  token: string;
}

export interface AuthTestFixtures {
  /** Run-unique user provisioned via API (never the UI) — every test gets its own, so token/tampering scenarios can freely mutate their own context without affecting others. */
  registeredUser: RegisteredUser;
  /** Bearer-token-authenticated ApiClient derived from `unauthenticatedApiClient` + `registeredUser`. */
  apiClient: ApiClient;
  customerApiService: CustomerApiService;
  accountApiService: AccountApiService;
  transferApiService: TransferApiService;
}

export const test = apiTest.extend<AuthTestFixtures>({
  registeredUser: async ({ authApiService }, use) => {
    const username = RandomDataGenerator.uniqueUsername('teller');
    const email = RandomDataGenerator.uniqueEmail('teller@bankcorp.com');
    const password = 'SecurePass123';

    const response = await authApiService.register({ username, password, email });
    if (response.status !== 201) {
      throw new Error(
        `registeredUser fixture: registration failed (status ${response.status}): ${JSON.stringify(response.body)}`,
      );
    }

    logger.info('Provisioned run-unique user', { username, userId: response.body.userId });
    await use({ userId: response.body.userId, username, password, email, token: response.body.token });
  },

  apiClient: async ({ unauthenticatedApiClient, registeredUser }, use) => {
    await use(unauthenticatedApiClient.withAuthorizationHeader(TokenUtils.toAuthHeaderValue(registeredUser.token)));
  },

  customerApiService: async ({ apiClient }, use) => {
    await use(new CustomerApiService(apiClient));
  },

  accountApiService: async ({ apiClient }, use) => {
    await use(new AccountApiService(apiClient));
  },

  transferApiService: async ({ apiClient }, use) => {
    await use(new TransferApiService(apiClient));
  },
});
