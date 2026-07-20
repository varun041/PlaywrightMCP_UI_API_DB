import { Page } from '@playwright/test';
import { ModalBase } from '@widgets/ModalBase';
import { TextInput } from '@controls/TextInput';
import { Button } from '@controls/Button';
import { Selectors } from '@constants/selectors';

export interface TransferFundsFormInput {
  toAccountNumber?: string;
  amount?: number | string;
  description?: string;
}

/** `TransferFunds.jsx` — the "From account" line is read-only display text, not a form field. */
export class TransferFundsModal extends ModalBase {
  constructor(page: Page) {
    super(page);
  }

  private get toAccountNumberInput(): TextInput {
    return new TextInput(this.root.locator('input[name="toAccountNumber"]'));
  }

  private get amountInput(): TextInput {
    return new TextInput(this.root.locator('input[name="amount"]'));
  }

  private get descriptionInput(): TextInput {
    return new TextInput(this.root.locator('input[name="description"]'));
  }

  private get submitButton(): Button {
    return new Button(this.root.getByRole('button', { name: Selectors.transferFundsModal.submitButton, exact: true }));
  }

  /**
   * The only current test coverage of this modal is the keyboard-only end-to-end journey
   * (`*ViaKeyboard` below); no scenario needs a mouse-driven fill/submit through this modal today
   * (transfers are otherwise verified via `TransferApiService`), so only the keyboard-driven API is
   * exposed here.
   */
  async fillViaKeyboard(transfer: TransferFundsFormInput): Promise<void> {
    if (transfer.toAccountNumber !== undefined) await this.toAccountNumberInput.focusAndType(transfer.toAccountNumber);
    if (transfer.amount !== undefined) await this.amountInput.focusAndType(String(transfer.amount));
    if (transfer.description !== undefined) await this.descriptionInput.focusAndType(transfer.description);
  }

  async submitViaKeyboard(): Promise<void> {
    await this.submitButton.focusAndPressEnter();
  }

  async transferViaKeyboard(
    details: Required<Pick<TransferFundsFormInput, 'toAccountNumber' | 'amount'>> & Pick<TransferFundsFormInput, 'description'>,
  ): Promise<void> {
    await this.fillViaKeyboard(details);
    await this.submitViaKeyboard();
  }
}
