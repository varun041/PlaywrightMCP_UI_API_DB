import { Page } from '@playwright/test';
import { BasePage } from '@pages/BasePage';
import { TextInput } from '@controls/TextInput';
import { SelectDropdown } from '@controls/SelectDropdown';
import { Button } from '@controls/Button';
import { CustomerTable } from '@components/CustomerTable';
import { Selectors } from '@constants/selectors';
import { SearchFilter } from '@enums/SearchFilter';

/** `CustomerList.jsx` — search/filter, "Add Customer" entry point, row selection into details. */
export class CustomerListPage extends BasePage {
  readonly table: CustomerTable;

  constructor(page: Page) {
    super(page);
    this.table = new CustomerTable(page);
  }

  private get searchInput(): TextInput {
    return new TextInput(this.page.getByPlaceholder(Selectors.customerList.searchPlaceholder));
  }

  private get filterSelect(): SelectDropdown {
    return new SelectDropdown(this.page.locator('.search-filter-select'));
  }

  private get searchButton(): Button {
    return new Button(this.page.getByRole('button', { name: Selectors.customerList.searchButton, exact: true }));
  }

  private get addCustomerButton(): Button {
    return new Button(this.page.getByRole('button', { name: Selectors.customerList.addCustomerButton, exact: true }));
  }

  // The filter must be set before the search text is filled — CustomerList.jsx keys its query-effect
  // off the filter value already being in place, so filling the text first and switching the filter
  // after can run the search against the wrong filter on the first keystroke.
  async search(query: string, filter: SearchFilter = SearchFilter.ALL): Promise<void> {
    await this.filterSelect.selectOption(filter);
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async clickAddCustomer(): Promise<void> {
    await this.addCustomerButton.click();
  }

  /** Focus + `Enter`, never `.click()`/`.fill()` — for keyboard-only-operability flows (A11Y-04). */
  async clickAddCustomerViaKeyboard(): Promise<void> {
    await this.addCustomerButton.focusAndPressEnter();
  }

  async searchViaKeyboard(query: string): Promise<void> {
    await this.searchInput.focusAndType(query);
    await this.searchButton.focusAndPressEnter();
  }

  async openCustomerByName(fullName: string): Promise<void> {
    await this.table.clickViewForRowMatchingName(fullName);
  }

  async openCustomerByNameViaKeyboard(fullName: string): Promise<void> {
    await this.table.clickViewForRowMatchingNameViaKeyboard(fullName);
  }
}
