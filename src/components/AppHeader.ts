import { Page } from '@playwright/test';
import { Button } from '@controls/Button';
import { Selectors } from '@constants/selectors';

/** Wraps `App.jsx`'s header — reused by every page, only rendered once authenticated. */
export class AppHeader {
  constructor(private readonly page: Page) {}

  /** Public so callers can assert on it directly (`expect(header.logoutButton.element).toBeVisible()`)
   *  instead of re-hardcoding the 'Logout' role/name lookup themselves. */
  get logoutButton(): Button {
    return new Button(this.page.getByRole('button', { name: Selectors.header.logoutButton, exact: true }));
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
