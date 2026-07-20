import { Page } from '@playwright/test';
import { AppHeader } from '@components/AppHeader';
import { ErrorBanner } from '@widgets/ErrorBanner';
import { LoadingIndicator } from '@widgets/LoadingIndicator';

/** Common to every screen: the app header, the global error/loading widgets, and a wait-for-ready hook. */
export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  get header(): AppHeader {
    return new AppHeader(this.page);
  }

  get errorBanner(): ErrorBanner {
    return new ErrorBanner(this.page);
  }

  get loadingIndicator(): LoadingIndicator {
    return new LoadingIndicator(this.page);
  }

  async waitUntilReady(): Promise<void> {
    await this.loadingIndicator.waitUntilHidden();
  }
}
