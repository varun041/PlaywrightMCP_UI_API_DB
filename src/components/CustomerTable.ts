import { Page } from '@playwright/test';
import { DataTable } from '@controls/DataTable';
import { Button } from '@controls/Button';
import { Selectors } from '@constants/selectors';

/** `CustomerList.jsx`'s table — columns are exactly `Name | Email | Phone | Actions` (name = `firstName + ' ' + lastName` in one cell). */
export class CustomerTable {
  private static readonly COLUMNS = ['Name', 'Email', 'Phone', 'Actions'];

  private readonly dataTable: DataTable;

  constructor(page: Page) {
    this.dataTable = new DataTable(page.locator('.customers-table table'), CustomerTable.COLUMNS);
  }

  async getRowCount(): Promise<number> {
    return this.dataTable.getRowCount();
  }

  async getCellValue(rowIndex: number, column: (typeof CustomerTable.COLUMNS)[number]): Promise<string> {
    return this.dataTable.getCellValue(rowIndex, column);
  }

  async findRowIndexByName(fullName: string): Promise<number> {
    return this.dataTable.findRowIndexByCellText('Name', fullName);
  }

  viewButtonForRow(rowIndex: number): Button {
    return new Button(
      this.dataTable.row(rowIndex).getByRole('button', { name: Selectors.customerList.viewButton, exact: true }),
    );
  }

  private async requireRowIndexByName(fullName: string): Promise<number> {
    const rowIndex = await this.findRowIndexByName(fullName);
    if (rowIndex === -1) {
      throw new Error(`CustomerTable: no row found for name "${fullName}"`);
    }
    return rowIndex;
  }

  async clickViewForRowMatchingName(fullName: string): Promise<void> {
    await this.viewButtonForRow(await this.requireRowIndexByName(fullName)).click();
  }

  /** Focus + `Enter`, never `.click()` — for keyboard-only-operability flows (A11Y-04). */
  async clickViewForRowMatchingNameViaKeyboard(fullName: string): Promise<void> {
    await this.viewButtonForRow(await this.requireRowIndexByName(fullName)).focusAndPressEnter();
  }
}
