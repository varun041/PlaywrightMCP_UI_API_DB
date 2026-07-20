import { Locator } from '@playwright/test';

/** Thin wrapper over `<select>`. */
export class SelectDropdown {
  constructor(private readonly locator: Locator) {}

  async selectOption(value: string): Promise<void> {
    await this.locator.selectOption(value);
  }

  get element(): Locator {
    return this.locator;
  }
}
