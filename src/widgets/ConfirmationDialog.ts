import { Page } from '@playwright/test';

/**
 * Wraps the native `window.confirm()` used for account deletion (CustomerDetails.jsx). Playwright
 * auto-dismisses unhandled dialogs, so the handler MUST be registered via `acceptNext()`/`dismissNext()`
 * BEFORE the action that triggers it — this is the one Widget that is not locator-based
 * (PageObjectModel.md §14.3).
 *
 * Usage: `const pending = confirmationDialog.acceptNext(); await accountsTable.clickDelete(...); const { message } = await pending;`
 */
export class ConfirmationDialog {
  constructor(private readonly page: Page) {}

  acceptNext(): Promise<{ message: string }> {
    return new Promise((resolve) => {
      this.page.once('dialog', async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        resolve({ message });
      });
    });
  }

  dismissNext(): Promise<{ message: string }> {
    return new Promise((resolve) => {
      this.page.once('dialog', async (dialog) => {
        const message = dialog.message();
        await dialog.dismiss();
        resolve({ message });
      });
    });
  }
}
