import { Locator, Page } from '@playwright/test';
import { Timeouts } from '@constants/timeouts';

/** Wraps the `.loading` div pattern (`CustomerListPage`, `CustomerDetailsPage`). */
export class LoadingIndicator {
  private readonly locator: Locator;

  constructor(scope: Page | Locator) {
    this.locator = scope.locator('.loading');
  }

  async isVisible(): Promise<boolean> {
    return this.locator.isVisible();
  }

  /** Resolves immediately if the indicator is already absent/hidden — no error if it never appeared. */
  async waitUntilHidden(timeoutMs: number = Timeouts.DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
    await this.locator.waitFor({ state: 'hidden', timeout: timeoutMs });
  }
}
