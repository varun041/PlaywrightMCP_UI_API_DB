import { test as authTest } from '@fixtures/auth.fixtures';
import { AppNavigator } from '@navigation/AppNavigator';
import { LoginPage } from '@pages/LoginPage';
import { CustomerListPage } from '@pages/CustomerListPage';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('page.fixtures');

export interface PageTestFixtures {
  appNavigator: AppNavigator;
  /** A fresh browser page at the login screen, not yet authenticated. */
  guestPage: LoginPage;
  /** A page already past login (via `registeredUser`), landed on the customer list. */
  authenticatedPage: CustomerListPage;
}

export const test = authTest.extend<PageTestFixtures>({
  appNavigator: async ({ page }, use) => {
    await use(new AppNavigator(page));
  },

  guestPage: async ({ appNavigator }, use) => {
    const loginPage = await appNavigator.openLogin();
    await use(loginPage);
  },

  authenticatedPage: async ({ appNavigator, registeredUser }, use) => {
    await appNavigator.openLogin();
    const listPage = await appNavigator.login(registeredUser.username, registeredUser.password);
    logger.info('authenticatedPage ready', { username: registeredUser.username });
    await use(listPage);
  },
});
