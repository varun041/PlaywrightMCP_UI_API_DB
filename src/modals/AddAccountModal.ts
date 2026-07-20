import { Page } from '@playwright/test';
import { ModalBase } from '@widgets/ModalBase';
import { TextInput } from '@controls/TextInput';
import { SelectDropdown } from '@controls/SelectDropdown';
import { Button } from '@controls/Button';
import { Selectors } from '@constants/selectors';
import { CreateAccountRequestBody } from '@app-types/domain';

/**
 * `AddAccount.jsx` — the `accountType` `<select>` only offers CHECKING/SAVINGS/BUSINESS/CREDIT, so
 * values outside that enumeration (VAL-04/VAL-05) are only reachable via the API service, never
 * through this modal, matching those scenarios' `@API`-only tagging in account_management.feature.
 */
export class AddAccountModal extends ModalBase {
  constructor(page: Page) {
    super(page);
  }

  private get accountTypeSelect(): SelectDropdown {
    return new SelectDropdown(this.root.locator('select[name="accountType"]'));
  }

  private get balanceInput(): TextInput {
    return new TextInput(this.root.locator('input[name="balance"]'));
  }

  private get currencyInput(): TextInput {
    return new TextInput(this.root.locator('input[name="currency"]'));
  }

  private get submitButton(): Button {
    return new Button(this.root.getByRole('button', { name: Selectors.addAccountModal.submitButton, exact: true }));
  }

  /**
   * The only current test coverage of this modal is the keyboard-only end-to-end journey
   * (`*ViaKeyboard` below); no scenario needs a mouse-driven fill/submit through this modal today
   * (account creation is otherwise verified via `AccountApiService`), so only the keyboard-driven
   * API is exposed here.
   */
  async fillViaKeyboard(account: CreateAccountRequestBody): Promise<void> {
    if (account.accountType !== undefined) {
      await this.accountTypeSelect.selectOption(account.accountType);
    }
    if (account.balance !== undefined && account.balance !== null) {
      await this.balanceInput.focusAndType(String(account.balance));
    }
    if (account.currency !== undefined) {
      await this.currencyInput.focusAndType(account.currency);
    }
  }

  async submitViaKeyboard(): Promise<void> {
    await this.submitButton.focusAndPressEnter();
  }

  async createAccountViaKeyboard(account: CreateAccountRequestBody): Promise<void> {
    await this.fillViaKeyboard(account);
    await this.submitViaKeyboard();
  }
}
