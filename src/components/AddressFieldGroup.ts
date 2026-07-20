import { Locator } from '@playwright/test';
import { TextInput } from '@controls/TextInput';
import { AddressInput } from '@app-types/domain';

/** `AddCustomer.jsx`'s address sub-section — fills/reads street/city/state/zip/country as one unit. Inputs are `name="address_<field>"`, no `id`. */
export class AddressFieldGroup {
  constructor(private readonly root: Locator) {}

  private input(field: keyof AddressInput): TextInput {
    return new TextInput(this.root.locator(`input[name="address_${field}"]`));
  }

  async fill(address: AddressInput): Promise<void> {
    if (address.street !== undefined) await this.input('street').fill(address.street);
    if (address.city !== undefined) await this.input('city').fill(address.city);
    if (address.state !== undefined) await this.input('state').fill(address.state);
    if (address.zipCode !== undefined) await this.input('zipCode').fill(address.zipCode);
    if (address.country !== undefined) await this.input('country').fill(address.country);
  }

  /** Focus + type via real keyboard events, never `.fill()` — for keyboard-only-operability flows (A11Y-04). */
  async fillViaKeyboard(address: AddressInput): Promise<void> {
    if (address.street !== undefined) await this.input('street').focusAndType(address.street);
    if (address.city !== undefined) await this.input('city').focusAndType(address.city);
    if (address.state !== undefined) await this.input('state').focusAndType(address.state);
    if (address.zipCode !== undefined) await this.input('zipCode').focusAndType(address.zipCode);
    if (address.country !== undefined) await this.input('country').focusAndType(address.country);
  }

  async read(): Promise<Required<AddressInput>> {
    return {
      street: await this.input('street').getValue(),
      city: await this.input('city').getValue(),
      state: await this.input('state').getValue(),
      zipCode: await this.input('zipCode').getValue(),
      country: await this.input('country').getValue(),
    };
  }
}
