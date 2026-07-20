import { Locator } from '@playwright/test';

/** Thin wrapper over anchor-style/toggle controls (e.g. LoginForm's `.toggle-btn`) that are semantically links, not primary actions. */
export class Link {
  constructor(private readonly locator: Locator) {}

  async click(): Promise<void> {
    await this.locator.click();
  }

  async getText(): Promise<string> {
    return (await this.locator.innerText()).trim();
  }

  get element(): Locator {
    return this.locator;
  }
}
