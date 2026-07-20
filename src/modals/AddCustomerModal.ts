import { Page } from '@playwright/test';
import { ModalBase } from '@widgets/ModalBase';
import { TextInput } from '@controls/TextInput';
import { Button } from '@controls/Button';
import { AddressFieldGroup } from '@components/AddressFieldGroup';
import { Selectors } from '@constants/selectors';
import { CreateCustomerRequestBody } from '@app-types/domain';

/** `AddCustomer.jsx` — inputs are `name`-attribute-only, no `id`; labels aren't programmatically associated. */
export class AddCustomerModal extends ModalBase {
  readonly address: AddressFieldGroup;

  constructor(page: Page) {
    super(page);
    this.address = new AddressFieldGroup(this.root);
  }

  private input(name: string): TextInput {
    return new TextInput(this.root.locator(`input[name="${name}"]`));
  }

  private get submitButton(): Button {
    return new Button(this.root.getByRole('button', { name: Selectors.addCustomerModal.submitButton, exact: true }));
  }

  async fill(customer: CreateCustomerRequestBody): Promise<void> {
    if (customer.firstName !== undefined) await this.input('firstName').fill(customer.firstName);
    if (customer.lastName !== undefined) await this.input('lastName').fill(customer.lastName);
    if (customer.email !== undefined) await this.input('email').fill(customer.email);
    if (customer.phone !== undefined) await this.input('phone').fill(customer.phone);
    if (customer.dateOfBirth !== undefined) await this.input('dateOfBirth').fill(customer.dateOfBirth);
    if (customer.address) await this.address.fill(customer.address);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async createCustomer(customer: CreateCustomerRequestBody): Promise<void> {
    await this.fill(customer);
    await this.submit();
  }

  /** Focus + type/Enter via real keyboard events, never `.fill()`/`.click()` — for keyboard-only-operability flows (A11Y-04). */
  async fillViaKeyboard(customer: CreateCustomerRequestBody): Promise<void> {
    if (customer.firstName !== undefined) await this.input('firstName').focusAndType(customer.firstName);
    if (customer.lastName !== undefined) await this.input('lastName').focusAndType(customer.lastName);
    if (customer.email !== undefined) await this.input('email').focusAndType(customer.email);
    if (customer.phone !== undefined) await this.input('phone').focusAndType(customer.phone);
    if (customer.dateOfBirth !== undefined) await this.input('dateOfBirth').focusAndType(customer.dateOfBirth);
    if (customer.address) await this.address.fillViaKeyboard(customer.address);
  }

  async submitViaKeyboard(): Promise<void> {
    await this.submitButton.focusAndPressEnter();
  }

  async createCustomerViaKeyboard(customer: CreateCustomerRequestBody): Promise<void> {
    await this.fillViaKeyboard(customer);
    await this.submitViaKeyboard();
  }
}
