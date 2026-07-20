import { Locator, Page } from '@playwright/test';
import { ErrorBanner } from '@widgets/ErrorBanner';
import { Timeouts } from '@constants/timeouts';

/** Wraps the shared `.modal-overlay`/`.modal` shell — `AddCustomerModal`/`AddAccountModal`/`TransferFundsModal` all extend this. */
export class ModalBase {
  protected readonly root: Locator;

  constructor(protected readonly page: Page) {
    this.root = page.locator('.modal-overlay .modal');
  }

  async waitUntilOpen(timeoutMs: number = Timeouts.DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  async waitUntilClosed(timeoutMs: number = Timeouts.DEFAULT_ACTION_TIMEOUT_MS): Promise<void> {
    await this.root.waitFor({ state: 'hidden', timeout: timeoutMs });
  }

  get errorBanner(): ErrorBanner {
    return new ErrorBanner(this.root);
  }
}
