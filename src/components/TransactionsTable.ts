import { Locator } from '@playwright/test';
import { DataTable } from '@controls/DataTable';

/** `CustomerDetails.jsx`'s transactions table — columns `Date | Type | Amount | Description | Status` (no actions column; no `reference` shown in the UI, so reference linkage is verified via API/DB, not this table). */
export class TransactionsTable {
  private static readonly COLUMNS = ['Date', 'Type', 'Amount', 'Description', 'Status'];

  private readonly dataTable: DataTable;

  constructor(sectionRoot: Locator) {
    this.dataTable = new DataTable(sectionRoot.locator('table'), TransactionsTable.COLUMNS);
  }

  async getRowCount(): Promise<number> {
    return this.dataTable.getRowCount();
  }

  async getCellValue(rowIndex: number, column: (typeof TransactionsTable.COLUMNS)[number]): Promise<string> {
    return this.dataTable.getCellValue(rowIndex, column);
  }
}
