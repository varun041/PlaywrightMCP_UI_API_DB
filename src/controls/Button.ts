import { Locator } from '@playwright/test';
import { Timeouts } from '@constants/timeouts';

/** Thin wrapper over a `<button>` locator — the lowest layer; nothing above Controls touches a raw Playwright locator. */
export class Button {
  constructor(private readonly locator: Locator) {}

  async click(): Promise<void> {
    await this.locator.click({ timeout: Timeouts.DEFAULT_ACTION_TIMEOUT_MS });
  }

  async isEnabled(): Promise<boolean> {
    return this.locator.isEnabled();
  }

  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /** Focus + `Enter`, never `.click()` — for keyboard-only-operability flows (A11Y-04). */
  async focusAndPressEnter(): Promise<void> {
    await this.locator.focus();
    await this.locator.page().keyboard.press('Enter');
  }

  async getText(): Promise<string> {
    return (await this.locator.innerText()).trim();
  }

  get element(): Locator {
    return this.locator;
  }
}
