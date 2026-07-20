import { Locator, Page } from '@playwright/test';

/** Wraps the `.error` div pattern — present on every page and every modal (LoginForm.css, AddCustomer.css, CustomerDetails.css). */
export class ErrorBanner {
  private readonly locator: Locator;

  constructor(scope: Page | Locator) {
    this.locator = scope.locator('.error');
  }

  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  async getMessage(): Promise<string> {
    return (await this.locator.innerText()).trim();
  }

  get element(): Locator {
    return this.locator;
  }
}
