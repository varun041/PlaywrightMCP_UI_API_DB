import { Page, expect } from '@playwright/test';
import { LoginPage } from '@pages/LoginPage';
import { CustomerListPage } from '@pages/CustomerListPage';
import { CustomerDetailsPage } from '@pages/CustomerDetailsPage';
import { AddCustomerModal } from '@modals/AddCustomerModal';
import { AddAccountModal } from '@modals/AddAccountModal';
import { TransferFundsModal } from '@modals/TransferFundsModal';
import { AppHeader } from '@components/AppHeader';
import { Urls } from '@constants/urls';
import { Timeouts } from '@constants/timeouts';
import { Selectors } from '@constants/selectors';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('AppNavigator');

/**
 * Encapsulates all cross-screen movement as Page-Object-returning methods so step definitions
 * never reason about URLs or app internals (PageObjectModel.md §6). The app is a single-URL SPA
 * that toggles `view: 'list' | 'details'` local state rather than routing — this class is what
 * hides that "navigating" is really a state change.
 */
export class AppNavigator {
  constructor(private readonly page: Page) {}

  async openLogin(): Promise<LoginPage> {
    await this.page.goto(Urls.FRONTEND_BASE_URL);
    return new LoginPage(this.page);
  }

  async login(username: string, password: string): Promise<CustomerListPage> {
    const loginPage = new LoginPage(this.page);
    await loginPage.login(username, password);
    await expect(this.page.getByRole('button', { name: Selectors.header.logoutButton, exact: true })).toBeVisible({
      timeout: Timeouts.DEFAULT_NAVIGATION_TIMEOUT_MS,
    });
    logger.info('Logged in', { username });
    return new CustomerListPage(this.page);
  }

  async logout(): Promise<LoginPage> {
    await new AppHeader(this.page).logout();
    return new LoginPage(this.page);
  }

  /**
   * Opens a customer's details by name. The seeded DB has 151+ customers, so a just-created
   * customer is very unlikely to be on the default first page — pass `searchTerm` (typically a
   * run-unique substring of the name/email used to create it) to search first; omit it only when
   * the list is already filtered/short enough that `fullName` is guaranteed visible.
   */
  async openCustomerDetails(fullName: string, searchTerm?: string): Promise<CustomerDetailsPage> {
    const listPage = new CustomerListPage(this.page);
    if (searchTerm) {
      await listPage.search(searchTerm);
    }
    await listPage.openCustomerByName(fullName);
    const detailsPage = new CustomerDetailsPage(this.page);
    await detailsPage.waitUntilReady();
    return detailsPage;
  }

  async returnToCustomerList(): Promise<CustomerListPage> {
    await new CustomerDetailsPage(this.page).clickBack();
    return new CustomerListPage(this.page);
  }

  async openAddCustomerModal(): Promise<AddCustomerModal> {
    await new CustomerListPage(this.page).clickAddCustomer();
    const modal = new AddCustomerModal(this.page);
    await modal.waitUntilOpen();
    return modal;
  }

  async openAddAccountModal(): Promise<AddAccountModal> {
    await new CustomerDetailsPage(this.page).clickAddAccount();
    const modal = new AddAccountModal(this.page);
    await modal.waitUntilOpen();
    return modal;
  }

  async openTransferFundsModal(accountNumber: string): Promise<TransferFundsModal> {
    await new CustomerDetailsPage(this.page).accountsTable.clickTransferForAccountNumber(accountNumber);
    const modal = new TransferFundsModal(this.page);
    await modal.waitUntilOpen();
    return modal;
  }
}
