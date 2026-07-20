# Page Object Model — Architecture

**Based on:** `features/*.feature` (10 files, analyzed below), `banking-app/frontend/src/` (actual React components), `testdata/*.yml`, `AutomationTestPlan.md`
**Scope:** Architecture only — no implementation code. This defines the shape of the automation framework that step definitions (not yet built) will be written against.

---

## 1. Principles

1. **Business behavior lives in `features/*.feature`.** Step definitions (future work, not in this document) translate Gherkin steps into calls against this framework — they contain no locators and no assertions logic of their own.
2. **The Page Object Model (POM) owns UI interaction.** For `@API`/`@DB`-tagged scenarios, a parallel **Service Layer** (not a UI pattern) plays the equivalent role — both are covered here since the framework must serve all tagged scenarios coherently.
3. **Layered composition, not inheritance-heavy design:**

   ```
   Step Definitions  (future — not in scope today)
          │
          ▼
   Pages  ──uses──▶  Components  ──uses──▶  Widgets  ──uses──▶  Controls
          │                                                        │
          ▼                                                        ▼
   Navigation                                          Playwright Locator API
          │
          ▼
   Services (API/DB)  ──uses──▶  Utility Methods
          │
          ▼
   Fixtures (wire everything together per test)
   ```

   - **Controls** are the thinnest wrappers over raw Playwright locators (a button, a text input).
   - **Widgets** are generic, business-agnostic UI patterns built from Controls, reused across unrelated pages (an error banner, a loading spinner, a paginator).
   - **Components** are composite, business-aware UI regions built from Widgets/Controls, but still reused across more than one Page (the accounts table, the customer table).
   - **Pages** compose Components/Widgets into a screen and expose business-meaningful methods only (`login()`, `searchCustomers()`) — never raw locators.
4. **The app is a single-URL SPA** (`App.jsx` toggles `view` state between `list`/`details` and shows/hides modals — there is no client-side router). `Navigation` therefore returns Page Objects from action methods rather than doing `page.goto(url)` per screen, so the framework is insulated if real routing is added later.
5. **Enums/Constants remove magic strings** from every layer above them (account types, statuses, endpoints, timeouts).
6. **Fixtures are the composition root** — they are the only place that wires Pages + Services + Utilities + Enums into what a step definition actually receives.

---

## 2. Feature-to-UI Traceability (analysis basis)

| Feature file | UI surfaces exercised (`@UI`-tagged scenarios) |
|---|---|
| `user_authentication.feature` | Login/Register form, App header (logout) |
| `session_and_token_management.feature` | Login form, App header, browser tab/session behavior |
| `security_and_access_control.feature` | Customer Details (XSS rendering check) |
| `customer_profile_management.feature` | Customer Details, Add Customer modal |
| `customer_search_and_directory.feature` | Customer List (search, filter, pagination) |
| `account_management.feature` | Customer Details (accounts/transactions tables), Add Account modal, delete-confirmation dialog |
| `fund_transfer.feature` | Customer Details (accounts table), Transfer Funds modal |
| `fund_transfer_resilience.feature` | None — all `@API` |
| `system_health_and_error_handling.feature` | Generic error banner behavior (not page-specific) |
| `end_to_end_customer_banking_journey.feature` | Full journey: Login → Customer List → Customer Details → Add Account → Transfer Funds |

Scenarios tagged `@API`/`@DB` (the majority across most files) are served by the **Services** layer (§8), not Pages.

---

## 3. Pages

One Page Object per distinct app screen/view-state, mirroring the actual React components.

| Page Object | Maps to | Responsibilities | Used by |
|---|---|---|---|
| `BasePage` (abstract) | `App.jsx` shell | Common to every screen: access the `AppHeader` widget, access the global `ErrorBanner`/`LoadingIndicator` widgets, wait-for-ready hook | All pages inherit this |
| `LoginPage` | `LoginForm.jsx` | Toggle login/register mode; submit credentials; read validation/error state | `user_authentication`, `session_and_token_management`, E2E journey |
| `CustomerListPage` | `CustomerList.jsx` | Search/filter customers, trigger pagination, open Add Customer modal, select a customer row to view details | `customer_search_and_directory`, `customer_profile_management`, E2E journey |
| `CustomerDetailsPage` | `CustomerDetails.jsx` | Read profile fields; open Edit; open Add Account modal; act on a specific account row (Transfer/Delete); read accounts/transactions tables | `customer_profile_management`, `account_management`, `fund_transfer`, `security_and_access_control`, E2E journey |

**Design note:** `CustomerListPage` and `CustomerDetailsPage` are two Page Objects even though they render inside one `App.jsx` view-switch (not two URLs), because they are distinct, independently testable screens from a business perspective. `AppNavigator` (§6) is what hides the fact that "navigating" between them is really a state change, not a URL change.

---

## 4. Components

Composite, business-aware regions reused **across** pages/modals.

| Component | Maps to | Reused by | Responsibilities |
|---|---|---|---|
| `AppHeader` | `App.jsx` header | Every page | Read app title; trigger logout |
| `CustomerTable` | `CustomerList.jsx` table | `CustomerListPage` | Row lookup by name/email/phone; read cell values; trigger "View" |
| `AccountsTable` | `CustomerDetails.jsx` accounts section | `CustomerDetailsPage` | Row lookup by account number; read balance/type/status/currency; trigger Transfer/Delete per row |
| `TransactionsTable` | `CustomerDetails.jsx` transactions section | `CustomerDetailsPage` | Row lookup; read date/type/amount/description/status |
| `AddressFieldGroup` | `AddCustomer.jsx` address sub-section | `AddCustomerModal` | Fill/read street, city, state, zip, country as one unit |

---

## 5. Reusable Widgets

Generic, business-agnostic UI patterns — the same widget class is instantiated wherever the corresponding CSS pattern (`.error`, `.loading`, `.no-data`, `.modal-overlay`) appears in the app.

| Widget | Maps to (CSS/pattern) | Responsibilities | Notable usage |
|---|---|---|---|
| `ErrorBanner` | `.error` div | Read the displayed error message; assert visibility | Every page and every modal |
| `LoadingIndicator` | `.loading` div | Assert visible/hidden; wait-until-hidden helper | `CustomerListPage`, `CustomerDetailsPage` |
| `NoDataMessage` | `.no-data` div | Assert visible; read text | Customer table, accounts table, transactions table |
| `ModalBase` | `.modal-overlay` / `.modal` | Open/close state; read modal title; scoped locator root for the 3 modals below | `AddCustomerModal`, `AddAccountModal`, `TransferFundsModal` |
| `PaginationControl` | `.pagination` (Previous/Next) | Click Next/Previous; read enabled/disabled state | `CustomerListPage` |
| `ConfirmationDialog` | native `window.confirm()` | Accept/dismiss the browser-native prompt; read prompt text | Delete Account flow (`account_management`) |

---

## 6. Navigation

`AppNavigator` — a single class that encapsulates all cross-screen movement as **Page-Object-returning methods**, so step definitions never reason about URLs or app internals.

| Method | Behavior | Returns |
|---|---|---|
| `login(testCaseId)` | Fills and submits `LoginPage` using resolved test data | `CustomerListPage` |
| `logout()` | Clicks logout via `AppHeader` | `LoginPage` |
| `openCustomerDetails(customerIdentifier)` | Locates the row via `CustomerTable`, clicks View | `CustomerDetailsPage` |
| `returnToCustomerList()` | Clicks Back on `CustomerDetailsPage` | `CustomerListPage` |
| `openAddCustomerModal()` | Clicks "Add Customer" on `CustomerListPage` | `AddCustomerModal` |
| `openAddAccountModal()` | Clicks "Add Account" on `CustomerDetailsPage` | `AddAccountModal` |
| `openTransferFundsModal(accountIdentifier)` | Clicks "Transfer" on the matching `AccountsTable` row | `TransferFundsModal` |

**Design note:** because `AddCustomer`/`AddAccount`/`TransferFunds` render as overlay modals rather than separate views, closing them (Cancel or successful submit) always resolves back to whichever Page was already active underneath — `AppNavigator` models this as the modal's `close()` returning the *parent* Page Object, not a fresh navigation.

---

## 7. Common Controls

The lowest layer — thin, generic wrappers over Playwright locators. Every Widget/Component is built from these; nothing above this layer touches a raw locator.

| Control | Wraps | Exposes |
|---|---|---|
| `Button` | `<button>` | click, isEnabled, getText |
| `TextInput` | `<input>` (text/email/tel/date/number/password) | fill, clear, getValue, getPlaceholder |
| `SelectDropdown` | `<select>` | selectOption, getSelectedOption, getAvailableOptions |
| `DataTable` | `<table>` | getRowCount, getRowByMatchingCellText, getCellValue(row, column), getAllRows |
| `Link` | `<button class="toggle-btn">` / anchor-style controls | click, getText |

---

## 8. Services (parallel to POM, for `@API`/`@DB` scenarios)

Not part of the Page Object Model itself, but required for the majority of scenarios (most are `@API`/`@DB`-tagged, not `@UI`). Listed here because Fixtures (§10) wire these in alongside Pages.

| Service | Responsibility | Backs |
|---|---|---|
| `ApiClient` | Low-level authenticated HTTP wrapper (base URL, bearer token injection, JSON handling) | All API services below |
| `AuthApiService` | register, login, build-expired/tampered token helpers | `user_authentication`, `session_and_token_management`, `security_and_access_control` |
| `CustomerApiService` | CRUD + search/pagination against `/api/customers` | `customer_profile_management`, `customer_search_and_directory` |
| `AccountApiService` | create/delete against `/api/customers/:id/accounts`, `/api/accounts/:id` | `account_management` |
| `TransferApiService` | `/api/accounts/transfer`, incl. concurrent/retry call patterns | `fund_transfer`, `fund_transfer_resilience` |
| `DbService` | Wraps/extends existing `tests/utils/db.ts`; direct SQLite assertions and fixture seeding | All `@DB`-tagged scenarios |

---

## 9. Utility Methods

Cross-cutting helpers with no UI/API identity of their own.

| Utility | Purpose |
|---|---|
| `TestDataLoader` | Resolves a `testdata/<feature>.yml` file + `TestCaseId` (as referenced in the Gherkin steps) into a typed data object |
| `RandomDataGenerator` | Produces run-unique variants of YAML template data (e.g., timestamp-suffixed emails/usernames) to satisfy the "self-contained, no cross-run collisions" test data strategy from `AutomationTestPlan.md` |
| `DateUtils` | Format dates for `<input type="date">`; parse displayed transaction/date-of-birth text |
| `CurrencyUtils` | Parse/format the app's `$${amount.toFixed(2)}` display convention |
| `TokenUtils` | Decode a JWT; build a tampered-payload token; build a wrong-secret token; build an expired token (backs the Session & Security feature files) |
| `AccessibilityScanner` | Wraps an axe-core scan against a given Page/Component root; returns violations (backs every `@Accessibility` scenario) |
| `WaitUtils` | Wait-for-row-count, wait-for-network-idle, wait-for-toast-to-clear style helpers |

---

## 10. Fixtures

The composition root. Each fixture is what a step definition would actually request; none of them expose raw Playwright primitives directly.

| Fixture | Provides | Built from |
|---|---|---|
| `testData` | The resolved data object for the `TestCaseId` referenced in the current scenario | `TestDataLoader` |
| `guestPage` | A fresh browser page at the login screen, not yet authenticated | `LoginPage` |
| `authenticatedPage` | A page already past login (default staff test user) | `AppNavigator.login()` + `testData` |
| `registeredUser` | A freshly registered, run-unique user provisioned via API (not UI) | `AuthApiService` + `RandomDataGenerator` |
| `apiContext` | An authenticated Playwright API request context (bearer token pre-attached) | `AuthApiService` |
| `dbConnection` | A scoped SQLite connection, isolated per test run | `DbService` |
| `seededCustomer` | A disposable customer created via API before the test, deleted after | `CustomerApiService` |
| `seededAccount` | A disposable account (optionally with transaction history) created via API before the test, deleted after | `AccountApiService` |

---

## 11. Enums

| Enum | Values | Source of truth |
|---|---|---|
| `AccountType` | `CHECKING`, `SAVINGS`, `BUSINESS`, `CREDIT` | `banking-app` account creation UI/API |
| `AccountStatus` | `ACTIVE`, `INACTIVE` | `accounts.status` |
| `TransactionType` | `DEBIT`, `CREDIT`, `TRANSFER` | `transactions.type` |
| `TransactionStatus` | `PENDING`, `COMPLETED` | `transactions.status` |
| `SearchFilter` | `ALL` (`""`), `EMAIL` (`"email"`), `PHONE` (`"phone"`) | `CustomerList.jsx` filter `<select>` |
| `ViewState` | `LIST`, `DETAILS` | `App.jsx` internal `view` state, mirrored for `AppNavigator` assertions |
| `HttpStatusCode` | `OK=200`, `CREATED=201`, `BAD_REQUEST=400`, `UNAUTHORIZED=401`, `FORBIDDEN=403`, `NOT_FOUND=404`, `CONFLICT=409`, `SERVER_ERROR=500` | Used across all API service assertions for readability |

---

## 12. Constants

| Constant group | Examples |
|---|---|
| `Urls` | `FRONTEND_BASE_URL` (`http://localhost:3001`), `API_BASE_URL` (`http://localhost:3000/api`) |
| `Endpoints` | `/auth/register`, `/auth/login`, `/customers`, `/customers/:id/accounts`, `/customers/:id/transactions`, `/accounts/:id`, `/accounts/transfer`, `/health`, `/routes` |
| `Timeouts` | `DEFAULT_ACTION_TIMEOUT`, `DEFAULT_NAVIGATION_TIMEOUT`, `TOKEN_EXPIRY_HOURS = 24` (backs `TokenUtils`, traces to BR-08) |
| `FilePaths` | `TESTDATA_DIR = "testdata/"`, `ISOLATED_DB_PATH = "tests/DB/banking.db"` |
| `Selectors` | Centralized role/label/text-based locator strings (e.g. button text "Add Customer", placeholder "Username") — since the app has **no `data-testid` attributes today** (a known risk from `AutomationTestPlan.md` §6.1), this constants module is the single place to update if/when those attributes are added, so Controls/Widgets never hardcode selector strings inline |

---

## 13. Folder Structure

```
PlayWright_API_DB_UI_AI/
├── features/                        # Gherkin business specs (existing)
├── testdata/                        # YAML test data (existing)
├── tests/
│   ├── DB/banking.db                 # existing isolated DB copy
│   ├── example.spec.ts               # existing
│   ├── utils/db.ts                   # existing low-level DB helper (wrapped by DbService)
│   └── step-definitions/             # future — Gherkin-to-framework glue (not built yet)
├── src/                              # the automation framework (this document's subject)
│   ├── pages/
│   │   ├── BasePage.ts
│   │   ├── LoginPage.ts
│   │   ├── CustomerListPage.ts
│   │   └── CustomerDetailsPage.ts
│   ├── modals/
│   │   ├── AddCustomerModal.ts
│   │   ├── AddAccountModal.ts
│   │   └── TransferFundsModal.ts
│   ├── components/
│   │   ├── AppHeader.ts
│   │   ├── CustomerTable.ts
│   │   ├── AccountsTable.ts
│   │   ├── TransactionsTable.ts
│   │   └── AddressFieldGroup.ts
│   ├── widgets/
│   │   ├── ErrorBanner.ts
│   │   ├── LoadingIndicator.ts
│   │   ├── NoDataMessage.ts
│   │   ├── ModalBase.ts
│   │   ├── PaginationControl.ts
│   │   └── ConfirmationDialog.ts
│   ├── controls/
│   │   ├── Button.ts
│   │   ├── TextInput.ts
│   │   ├── SelectDropdown.ts
│   │   ├── DataTable.ts
│   │   └── Link.ts
│   ├── navigation/
│   │   └── AppNavigator.ts
│   ├── services/
│   │   ├── ApiClient.ts
│   │   ├── AuthApiService.ts
│   │   ├── CustomerApiService.ts
│   │   ├── AccountApiService.ts
│   │   ├── TransferApiService.ts
│   │   └── DbService.ts
│   ├── utils/
│   │   ├── TestDataLoader.ts
│   │   ├── RandomDataGenerator.ts
│   │   ├── DateUtils.ts
│   │   ├── CurrencyUtils.ts
│   │   ├── TokenUtils.ts
│   │   ├── AccessibilityScanner.ts
│   │   └── WaitUtils.ts
│   ├── fixtures/
│   │   ├── authFixtures.ts
│   │   ├── apiFixtures.ts
│   │   ├── dbFixtures.ts
│   │   └── dataFixtures.ts
│   ├── enums/
│   │   ├── AccountType.ts
│   │   ├── AccountStatus.ts
│   │   ├── TransactionType.ts
│   │   ├── TransactionStatus.ts
│   │   ├── SearchFilter.ts
│   │   ├── ViewState.ts
│   │   └── HttpStatusCode.ts
│   └── constants/
│       ├── urls.ts
│       ├── endpoints.ts
│       ├── timeouts.ts
│       ├── filePaths.ts
│       └── selectors.ts
├── banking-app/                      # application under test (existing)
├── playwright.config.ts
└── package.json
```

---

## 14. Open Items Before Implementation

1. This framework assumes a Cucumber-compatible Playwright runner (e.g. `playwright-bdd`) to connect `features/*.feature` to step definitions calling into `src/`. No such runner is configured yet (`playwright.config.ts` currently points `testDir` at `./tests` only).
2. The app has no `data-testid` attributes; the `Selectors` constants module (§12) is the intended mitigation, but role/text-based locators remain more brittle to UI copy changes until that's addressed (tracked in `AutomationTestPlan.md` §6.1 Risks).
3. `ConfirmationDialog` wraps the native `window.confirm()` used for account deletion — Playwright handles this via a page-level `dialog` event listener rather than a locator, which makes it architecturally distinct from every other Widget; flagged here so it isn't implemented as a normal locator-based class by mistake.