import { Locator, expect } from '@playwright/test';
import { Timeouts } from '@constants/timeouts';

/**
 * Thin wrapper over a `<table>` locator. `columns` is the table's actual `<th>` order (documented
 * per-component in the owning Component), so lookups are by business column name, not raw index.
 */
export class DataTable {
  constructor(
    private readonly root: Locator,
    private readonly columns: string[],
  ) {}

  private get rows(): Locator {
    return this.root.locator('tbody tr');
  }

  async getRowCount(): Promise<number> {
    return this.rows.count();
  }

  row(rowIndex: number): Locator {
    return this.rows.nth(rowIndex);
  }

  /** Raw locator (not a value read) so callers can build auto-retrying assertions on it directly —
   *  e.g. `expect(rowsMatchingText(x)).toHaveCount(0)` to wait for a row to disappear. */
  rowsMatchingText(text: string): Locator {
    return this.rows.filter({ hasText: text });
  }

  async getRowValues(rowIndex: number): Promise<string[]> {
    const cells = this.rows.nth(rowIndex).locator('td');
    return (await cells.allTextContents()).map((cell) => cell.trim());
  }

  async getAllRows(): Promise<string[][]> {
    const count = await this.getRowCount();
    const result: string[][] = [];
    for (let index = 0; index < count; index += 1) {
      result.push(await this.getRowValues(index));
    }
    return result;
  }

  async getCellValue(rowIndex: number, columnName: string): Promise<string> {
    const columnIndex = this.columns.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`DataTable: unknown column "${columnName}" (known columns: ${this.columns.join(', ')})`);
    }
    const text = await this.rows.nth(rowIndex).locator('td').nth(columnIndex).innerText();
    return text.trim();
  }

  /**
   * Row index whose given column contains `text`, or -1 if no row matches after retrying.
   *
   * Polls rather than reading the table once: a caller typically lands here right after a search
   * or filter action, and the table can still hold its pre-action rows for a moment while the
   * request that will replace them is in flight — a single snapshot read races that update and can
   * report "not found" for a row that appears a beat later.
   */
  async findRowIndexByCellText(
    columnName: string,
    text: string,
    timeoutMs: number = Timeouts.DEFAULT_ACTION_TIMEOUT_MS,
  ): Promise<number> {
    const columnIndex = this.columns.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`DataTable: unknown column "${columnName}" (known columns: ${this.columns.join(', ')})`);
    }
    let lastIndex = -1;
    try {
      await expect
        .poll(
          async () => {
            const allRows = await this.getAllRows();
            lastIndex = allRows.findIndex((row) => row[columnIndex]?.includes(text));
            return lastIndex;
          },
          { timeout: timeoutMs },
        )
        .not.toBe(-1);
    } catch {
      // Genuinely not found within the timeout — return -1 and let the caller decide how to react,
      // matching this method's existing "no throw" contract rather than surfacing a poll timeout.
    }
    return lastIndex;
  }
}
