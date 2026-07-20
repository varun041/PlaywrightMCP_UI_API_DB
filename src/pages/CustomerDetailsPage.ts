import { Page } from '@playwright/test';
import { BasePage } from '@pages/BasePage';
import { Button } from '@controls/Button';
import { AccountsTable } from '@components/AccountsTable';
import { TransactionsTable } from '@components/TransactionsTable';
import { ConfirmationDialog } from '@widgets/ConfirmationDialog';
import { Selectors } from '@constants/selectors';

export interface DisplayedCustomerProfile {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
}

/** `CustomerDetails.jsx` — profile, accounts table (Transfer/Delete per row), transactions table. */
export class CustomerDetailsPage extends BasePage {
  readonly accountsTable: AccountsTable;
  readonly transactionsTable: TransactionsTable;
  readonly confirmationDialog: ConfirmationDialog;

  constructor(page: Page) {
    super(page);
    this.accountsTable = new AccountsTable(page.locator('.accounts-section'));
    this.transactionsTable = new TransactionsTable(page.locator('.transactions-section'));
    this.confirmationDialog = new ConfirmationDialog(page);
  }

  private get backButton(): Button {
    return new Button(this.page.getByRole('button', { name: Selectors.customerDetails.backButton, exact: true }));
  }

  private get addAccountButton(): Button {
    return new Button(this.page.getByRole('button', { name: Selectors.customerDetails.addAccountButton, exact: true }));
  }

  async getProfile(): Promise<DisplayedCustomerProfile> {
    const infoGrid = this.page.locator('.info-grid');
    // Scoped to direct children of `.info-grid` (`> div`) rather than any descendant div — narrows
    // the `hasText` match so a nested/unrelated div containing the label text elsewhere can't be
    // picked up instead of the actual field row.
    const readField = async (label: string): Promise<string> =>
      (await infoGrid.locator('> div', { hasText: label }).locator('p').innerText()).trim();

    return {
      fullName: (await this.page.locator('.customer-info h2').innerText()).trim(),
      email: await readField('Email:'),
      phone: await readField('Phone:'),
      dateOfBirth: await readField('Date of Birth:'),
      address: await readField('Address:'),
    };
  }

  async clickBack(): Promise<void> {
    await this.backButton.click();
  }

  async clickAddAccount(): Promise<void> {
    await this.addAccountButton.click();
  }

  /** Focus + `Enter`, never `.click()` — for keyboard-only-operability flows (A11Y-04). */
  async clickAddAccountViaKeyboard(): Promise<void> {
    await this.addAccountButton.focusAndPressEnter();
  }

  /** Handles the native `window.confirm()` for delete — must register the dialog handler before the click. */
  async deleteAccount(accountNumber: string, confirm: boolean = true): Promise<string> {
    const pendingDialog = confirm
      ? this.confirmationDialog.acceptNext()
      : this.confirmationDialog.dismissNext();
    await this.accountsTable.clickDeleteForAccountNumber(accountNumber);
    const { message } = await pendingDialog;
    if (confirm) {
      // window.confirm() resolves as soon as it's dismissed — the app's subsequent async DELETE
      // request (and the table re-render once it completes) can still be in flight at that point.
      // Waiting for the row to actually disappear stops callers from racing that request.
      await this.accountsTable.waitUntilAccountNumberGone(accountNumber);
    }
    return message;
  }
}
