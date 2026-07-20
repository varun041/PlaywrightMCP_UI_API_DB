import { Locator, expect } from '@playwright/test';
import { DataTable } from '@controls/DataTable';
import { Button } from '@controls/Button';
import { Selectors } from '@constants/selectors';
import { Timeouts } from '@constants/timeouts';

/** `CustomerDetails.jsx`'s accounts table — columns `Account Number | Type | Balance | Currency | Status | Actions`. */
export class AccountsTable {
  private static readonly COLUMNS = ['Account Number', 'Type', 'Balance', 'Currency', 'Status', 'Actions'];

  private readonly dataTable: DataTable;

  constructor(sectionRoot: Locator) {
    this.dataTable = new DataTable(sectionRoot.locator('table'), AccountsTable.COLUMNS);
  }

  async getRowCount(): Promise<number> {
    return this.dataTable.getRowCount();
  }

  async getCellValue(rowIndex: number, column: (typeof AccountsTable.COLUMNS)[number]): Promise<string> {
    return this.dataTable.getCellValue(rowIndex, column);
  }

  async findRowIndexByAccountNumber(accountNumber: string): Promise<number> {
    return this.dataTable.findRowIndexByCellText('Account Number', accountNumber);
  }

  transferButtonForRow(rowIndex: number): Button {
    return new Button(
      this.dataTable.row(rowIndex).getByRole('button', { name: Selectors.customerDetails.transferButton, exact: true }),
    );
  }

  deleteButtonForRow(rowIndex: number): Button {
    return new Button(
      this.dataTable.row(rowIndex).getByRole('button', { name: Selectors.customerDetails.deleteButton, exact: true }),
    );
  }

  private async requireRowIndex(accountNumber: string): Promise<number> {
    const rowIndex = await this.findRowIndexByAccountNumber(accountNumber);
    if (rowIndex === -1) {
      throw new Error(`AccountsTable: no row found for account number "${accountNumber}"`);
    }
    return rowIndex;
  }

  async clickTransferForAccountNumber(accountNumber: string): Promise<void> {
    await this.transferButtonForRow(await this.requireRowIndex(accountNumber)).click();
  }

  /** Focus + `Enter`, never `.click()` — for keyboard-only-operability flows (A11Y-04). */
  async clickTransferForAccountNumberViaKeyboard(accountNumber: string): Promise<void> {
    await this.transferButtonForRow(await this.requireRowIndex(accountNumber)).focusAndPressEnter();
  }

  async clickDeleteForAccountNumber(accountNumber: string): Promise<void> {
    await this.deleteButtonForRow(await this.requireRowIndex(accountNumber)).click();
  }

  /** Auto-retrying wait for the account's row to disappear once a delete has actually taken effect. */
  async waitUntilAccountNumberGone(accountNumber: string, timeoutMs: number = Timeouts.DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
    await expect(this.dataTable.rowsMatchingText(accountNumber)).toHaveCount(0, { timeout: timeoutMs });
  }
}
