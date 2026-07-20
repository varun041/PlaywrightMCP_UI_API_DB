import { Locator } from '@playwright/test';

/** Thin wrapper over `<input>` (text/email/tel/date/number/password) — no form has `id`/`htmlFor` label association, so callers pass an already-scoped locator (by `placeholder` or `name` attribute). */
export class TextInput {
  constructor(private readonly locator: Locator) {}

  async fill(value: string): Promise<void> {
    await this.locator.fill(value);
  }

  /** Focus + type via real keyboard events, never `.fill()` — for keyboard-only-operability flows (A11Y-04). */
  async focusAndType(value: string): Promise<void> {
    await this.locator.focus();
    await this.locator.page().keyboard.type(value);
  }

  async getValue(): Promise<string> {
    return this.locator.inputValue();
  }

  get element(): Locator {
    return this.locator;
  }
}
