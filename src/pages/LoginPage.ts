import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from '@pages/BasePage';
import { TextInput } from '@controls/TextInput';
import { Button } from '@controls/Button';
import { Link } from '@controls/Link';
import { Selectors } from '@constants/selectors';
import { Urls } from '@constants/urls';

/** `LoginForm.jsx` — one form toggled between Login/Register via `.toggle-btn`; no `id`/`htmlFor`, placeholder-only inputs. */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  static async open(page: Page): Promise<LoginPage> {
    await page.goto(Urls.FRONTEND_BASE_URL);
    return new LoginPage(page);
  }

  get usernameInput(): TextInput {
    return new TextInput(this.page.getByPlaceholder(Selectors.login.usernamePlaceholder));
  }

  private get emailInput(): TextInput {
    return new TextInput(this.page.getByPlaceholder(Selectors.login.emailPlaceholder));
  }

  private get passwordInput(): TextInput {
    return new TextInput(this.page.getByPlaceholder(Selectors.login.passwordPlaceholder));
  }

  // Role-based rather than a raw `.toggle-btn` class selector — the accessible name is one of the
  // two centralized Selectors.login toggle strings regardless of which mode is currently showing.
  private get toggleLink(): Link {
    const toRegister = this.page.getByRole('button', { name: Selectors.login.toggleToRegisterText, exact: true });
    const toLogin = this.page.getByRole('button', { name: Selectors.login.toggleToLoginText, exact: true });
    return new Link(toRegister.or(toLogin));
  }

  // `.auth-panel` (formerly `.login-form`) wraps the heading + form after the redesign.
  get heading(): Locator {
    return this.page.locator('.auth-panel').getByRole('heading', { level: 2 });
  }

  // Role-based rather than a raw `button[type="submit"]` CSS attribute chain; matches either mode's
  // accessible name since the label itself changes ('Login' vs 'Register'). Must be `exact: true`
  // with the full word — the toggle link's accessible name ("Don't have an account? Register")
  // also contains "Regis", so a substring match on either button ambiguously matches both and
  // throws a strict-mode violation.
  private get submitButton(): Button {
    const loginBtn = this.page.locator('.auth-panel').getByRole('button', { name: Selectors.login.submitButton('Login'), exact: true });
    const registerBtn = this.page.locator('.auth-panel').getByRole('button', { name: Selectors.login.submitButton('Register'), exact: true });
    return new Button(loginBtn.or(registerBtn));
  }

  async getHeadingText(): Promise<string> {
    return (await this.heading.innerText()).trim();
  }

  async isInLoginMode(): Promise<boolean> {
    return (await this.getHeadingText()) === Selectors.login.heading('Login');
  }

  async switchToRegisterMode(): Promise<void> {
    if (await this.isInLoginMode()) {
      await this.toggleLink.click();
      // Wait for the heading to actually flip before returning — the caller (login()/register())
      // fills inputs immediately after, and relying on the click's promise alone doesn't guarantee
      // the React re-render (and thus the swapped input set) has landed yet.
      await expect(this.heading).toHaveText(Selectors.login.heading('Register'));
    }
  }

  async switchToLoginMode(): Promise<void> {
    if (!(await this.isInLoginMode())) {
      await this.toggleLink.click();
      await expect(this.heading).toHaveText(Selectors.login.heading('Login'));
    }
  }

  async login(username: string, password: string): Promise<void> {
    await this.switchToLoginMode();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async register(username: string, password: string, email: string): Promise<void> {
    await this.switchToRegisterMode();
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** For NEG-05-style "missing username or password" validation scenarios — fills only what's provided. */
  async submitLoginWithPartialCredentials(partial: { username?: string; password?: string }): Promise<void> {
    await this.switchToLoginMode();
    if (partial.username !== undefined) {
      await this.usernameInput.fill(partial.username);
    }
    if (partial.password !== undefined) {
      await this.passwordInput.fill(partial.password);
    }
    await this.submitButton.click();
  }
}
