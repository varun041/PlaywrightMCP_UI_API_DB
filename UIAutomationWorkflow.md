# UI Automation Workflow

How a single CLI command, filtered by tag, turns into browser actions, assertions, and a report — and which files in this repo are responsible for each step.

This framework is **Playwright + TypeScript + `playwright-bdd`** (not classic `cucumber-js`). `.feature` files are compiled into native Playwright spec files at test-collection time, then executed entirely through the standard `@playwright/test` runner. Tag filtering uses Playwright's own `--grep`, not Cucumber's `--tags`.

---

## 1. Entry point — CLI command with a tag

```bash
npm run test:ui
# → playwright test --grep @UI
```

Other tag-scoped scripts defined in [package.json](package.json):

| Script | Command | Tag(s) |
|---|---|---|
| `test:smoke` | `playwright test --grep @Smoke` | `@Smoke` |
| `test:regression` | `playwright test --grep @Regression --grep-invert @KnownGap` | `@Regression`, excludes `@KnownGap` |
| `test:ui` | `playwright test --grep @UI` | `@UI` |
| `test:api` | `playwright test --grep @API` | `@API` |
| `test:db` | `playwright test --grep @DB` | `@DB` |
| `test:accessibility` | `playwright test --grep @Accessibility` | `@Accessibility` |
| `test:security` | `playwright test --grep @Security` | `@Security` |
| `test:known-gaps` | `playwright test --grep @KnownGap` | `@KnownGap` |
| `test:report` | `playwright show-report reports/html` | — opens last HTML report |

Ad hoc combinations work too, e.g. `npx playwright test --grep "@Smoke.*@UI"`.

---

## 2. End-to-end flow diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  npm run test:ui   →   playwright test --grep @UI                            │
└───────────────────────────────────┬────────────────────────────────────────┬─┘
                                     │                                        │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 1. CONFIG LOAD — playwright.config.ts                                    │  │
│    • dotenv.config() → config/environments/local.env | ci.env            │  │
│    • defineBddConfig({features, steps, outputDir, importTestFrom})       │  │
│         features: 'features/*.feature'                                  │  │
│         steps:    'tests/step-definitions/*.steps.ts'                   │  │
│         outputDir:'tests/.features-gen'                                 │  │
│    • testDir = bddTestDir  (generated specs, NOT features/ directly)     │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 2. BDD CODEGEN — playwright-bdd (bddgen, auto-triggered by config)       │  │
│    Reads:  features/*.feature  (Gherkin + tags: @Smoke @UI @Regression…) │  │
│    Binds:  tests/step-definitions/*.steps.ts (Given/When/Then matchers)  │  │
│    Writes: tests/.features-gen/*.spec.ts — one generated spec per        │  │
│            scenario, each carrying its Gherkin tags as Playwright        │  │
│            annotations so --grep @UI can filter on them                  │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 3. TAG FILTER — Playwright test runner                                   │  │
│    --grep @UI selects only generated specs whose tag annotations match   │  │
│    e.g. features/user_authentication.feature → "Log out clears session"  │  │
│         tagged @Smoke @Regression @UI @Positive                          │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 4. GLOBAL SETUP — config/global-setup.ts  (once per whole run)           │  │
│    • copySeedDatabase() → copies banking-app/backend/db/banking.db to    │  │
│      an isolated runtime copy; sets process.env.RUNTIME_DB_PATH          │  │
│    • BackendProcessManager.spawn() → boots Express+SQLite backend        │  │
│      against that runtime DB copy, waits for health check                │  │
│    • spawnFrontend() → `npm run dev` (React/Vite) in banking-app/frontend│  │
│    • waitForHealthy(FRONTEND_BASE_URL)                                   │  │
│    • writeRunState() → PIDs + DB path persisted to run-state.json        │  │
│      (consumed later by global-teardown.ts)                              │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 5. FIXTURE COMPOSITION ROOT — src/fixtures/index.ts                      │  │
│    Sequential .extend() chain, each file building on the last:           │  │
│                                                                            │  │
│    db.fixtures.ts        worker-scoped `dbService` (new DbService())     │  │
│         │                                                                 │  │
│         ▼                                                                 │  │
│    api.fixtures.ts       worker-scoped `apiRequestContext`;              │  │
│                           test-scoped `unauthenticatedApiClient`,        │  │
│                           `authApiService`                               │  │
│         │                                                                 │  │
│         ▼                                                                 │  │
│    auth.fixtures.ts      test-scoped `registeredUser` (created via API   │  │
│                           register call); `apiClient` with bearer token; │  │
│                           `customerApiService`/`accountApiService`/      │  │
│                           `transferApiService`                           │  │
│         │                                                                 │  │
│         ▼                                                                 │  │
│    page.fixtures.ts   ★  UI-CRITICAL LAYER  ★                            │  │
│         `appNavigator`      → new AppNavigator(page)                     │  │
│         `guestPage`         → appNavigator.openLogin() → LoginPage       │  │
│         `authenticatedPage` → appNavigator.login(user) → CustomerListPage│  │
│         │                                                                 │  │
│         ▼                                                                 │  │
│    data.fixtures.ts      test-scoped `seededCustomer`/`seededAccount`,   │  │
│                           created via API before test, deleted via API   │  │
│                           after (teardown code runs after `await use()`) │  │
│                                                                            │  │
│    Browser/page lifecycle itself (launch, context, close) is Playwright's│  │
│    own built-in `page` fixture — never called manually in this repo.     │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 6. STEP REGISTRATION — tests/step-definitions/support/bdd.ts             │  │
│    • const { Given, When, Then } = createBdd(test)   ← ONE call for the  │  │
│      whole suite; every *.steps.ts imports from here, never calls        │  │
│      createBdd() itself → one shared fixture universe, one step registry │  │
│    • `state: ScenarioState` fixture — fresh per-scenario scratch object  │  │
│      (lastApiResponse, capturedToken, customer, account, transactions…)  │  │
│    • test = base.extend({ state })  where base = src/fixtures/index.ts   │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 7. STEP EXECUTION — tests/step-definitions/*.steps.ts                    │  │
│    Generated spec calls into matching Given/When/Then handlers.          │  │
│    UI-relevant example (authentication.steps.ts):                        │  │
│                                                                            │  │
│      When('I run an automated accessibility scan...',                   │  │
│        async ({ page, appNavigator, state }) => {                       │  │
│          await appNavigator.openLogin();                                │  │
│          state.extra.colorContrastResult =                              │  │
│            await AccessibilityScanner.scanColorContrast(page);          │  │
│        });                                                               │  │
│                                                                            │  │
│      Then('I should be returned to the login screen', async ({ page }) =>│  │
│        expect(page.locator('.login-form h2')).toHaveText('Login'));     │  │
│                                                                            │  │
│    Test data for the step comes from TestData.<feature>.get(testCaseId) │  │
│    (src/utils/TestDataLoader.ts) keyed off a {string} placeholder in the │  │
│    Gherkin text — testdata/*.yml — NOT a fixture, since the id is only   │  │
│    known at runtime from the captured Gherkin text.                     │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 8. NAVIGATION LAYER — src/navigation/AppNavigator.ts                     │  │
│    Hides that the app is a single-URL SPA (toggles view: 'list'|'details'│  │
│    rather than routing). Every method returns the next Page Object:      │  │
│      openLogin() → goto(FRONTEND_BASE_URL) → new LoginPage(page)        │  │
│      login(user,pass) → LoginPage.login() → waits for logout button →   │  │
│                          new CustomerListPage(page)                     │  │
│      logout(), openCustomerDetails(), openAddCustomerModal(),           │  │
│      openAddAccountModal(), openTransferFundsModal()                    │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 9. PAGE OBJECT MODEL LAYERS — src/                                       │  │
│                                                                            │  │
│    Pages (src/pages/)            BasePage → LoginPage, CustomerListPage, │  │
│                                   CustomerDetailsPage — business methods  │  │
│                                   only (login, register, search…)        │  │
│         │ composes                                                       │  │
│         ▼                                                                │  │
│    Modals (src/modals/)          ModalBase → AddCustomerModal,           │  │
│                                   AddAccountModal, TransferFundsModal    │  │
│         │ composes                                                       │  │
│         ▼                                                                │  │
│    Components (src/components/)  AppHeader, CustomerTable, AccountsTable,│  │
│                                   TransactionsTable, AddressFieldGroup   │  │
│         │ composes                                                       │  │
│         ▼                                                                │  │
│    Widgets (src/widgets/)        ErrorBanner, LoadingIndicator,          │  │
│                                   NoDataMessage, PaginationControl,      │  │
│                                   ConfirmationDialog                    │  │
│         │ composes                                                       │  │
│         ▼                                                                │  │
│    Controls (src/controls/)      TextInput, Button, Link, SelectDropdown,│  │
│                                   DataTable — thinnest wrappers, one     │  │
│                                   Locator each, nothing above touches    │  │
│                                   raw Playwright Locator directly        │  │
│         │ built from                                                     │  │
│         ▼                                                                │  │
│    Locators — src/constants/selectors.ts (role/text/placeholder based;   │  │
│    app has no data-testid attributes) → Playwright Locator API → page   │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 10. BROWSER ACTIONS — Playwright engine                                  │  │
│     Chromium / Firefox / WebKit projects (playwright.config.ts)          │  │
│     Real clicks/fills/navigations against banking-app frontend           │  │
│     (booted in step 4) at baseURL = FRONTEND_BASE_URL                    │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 11. ASSERTIONS — src/assertions/                                         │  │
│     expect() re-exported from src/fixtures/index.ts with custom matchers │  │
│     registered via expect.extend() in src/assertions/index.ts:           │  │
│       accountAssertions (toHaveAccountStatus, toHaveBalance)             │  │
│       transactionAssertions (toHaveLinkedTransactions)                  │  │
│       apiAssertions (toMatchApiError)                                   │  │
│       accessibilityAssertions (toBeAccessible) ← used with              │  │
│         src/utils/AccessibilityScanner.ts (@axe-core/playwright) for    │  │
│         @Accessibility-tagged UI scenarios                              │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 12. TEST TEARDOWN (reverse fixture order, automatic)                     │  │
│     data.fixtures.ts deletes seededCustomer/seededAccount via API →      │  │
│     auth.fixtures.ts / api.fixtures.ts / db.fixtures.ts unwind           │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 13. REPORTERS — playwright.config.ts `reporter:` array                   │  │
│     list        → console output during the run                        │  │
│     html        → reports/html  (npm run test:report to view)          │  │
│     junit       → reports/junit/results.xml  (CI ingestion)             │  │
│     blob        → reports/blob  (per-shard raw results)                 │  │
│     On failure: trace (on-first-retry), screenshot (only-on-failure),   │  │
│     video (retain-on-failure) — set in `use:` in the same config file   │  │
└───────────────────────────────────┬──────────────────────────────────────┘  │
                                     ▼                                        │
┌──────────────────────────────────────────────────────────────────────────┐  │
│ 14. GLOBAL TEARDOWN — config/global-teardown.ts  (once per whole run)   │◄─┘
│     Reads run-state.json → ProcessUtils.killTree() for backend/frontend  │
│     PIDs → deletes runtime DB copy + -shm/-wal sidecar files             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. File map — every file in the UI automation path

| # | Layer | File | Role |
|---|---|---|---|
| 1 | Entry | [package.json](package.json) | Defines tag-scoped npm scripts (`test:ui`, `test:smoke`, …) |
| 2 | Config | [playwright.config.ts](playwright.config.ts) | Loads env, wires `defineBddConfig`, sets `testDir`, reporters, browser projects, global setup/teardown hooks |
| 3 | Config | [tsconfig.json](tsconfig.json) | Path aliases (`@pages`, `@components`, `@utils`, etc.) used throughout `src/` and `tests/` |
| 4 | Config | [config/environments/local.env](config/environments/local.env), [config/environments/ci.env](config/environments/ci.env) | `FRONTEND_BASE_URL`, `API_BASE_URL`, timeouts, `JWT_SECRET` per environment |
| 5 | Config | [config/global-setup.ts](config/global-setup.ts) | Boots isolated DB copy, backend, and frontend once per run |
| 6 | Config | [config/global-teardown.ts](config/global-teardown.ts) | Kills backend/frontend process trees, deletes runtime DB copy |
| 7 | Gherkin | [features/*.feature](features/) | 10 feature files; scenario tags (`@Smoke`, `@UI`, `@Regression`, `@Accessibility`, …) drive `--grep` filtering |
| 8 | Test data | [testdata/*.yml](testdata/) | One YAML per feature, keyed by `TestCaseId` (e.g. `POS-01`) |
| 9 | Test data | [src/utils/TestDataLoader.ts](src/utils/TestDataLoader.ts) | Generic cached YAML loader; exports `TestData.<feature>` singletons |
| 10 | Codegen output | `tests/.features-gen/*.spec.ts` | Generated by `playwright-bdd`; actual files Playwright runs (excluded from typecheck) |
| 11 | Step glue | [tests/step-definitions/support/bdd.ts](tests/step-definitions/support/bdd.ts) | Single `createBdd(test)` call; defines `ScenarioState` fixture; exports `Given/When/Then/expect` |
| 12 | Steps | [tests/step-definitions/*.steps.ts](tests/step-definitions/) | Maps Gherkin steps to Page Object / Navigator / Service calls |
| 13 | Fixtures | [src/fixtures/db.fixtures.ts](src/fixtures/db.fixtures.ts) → [api.fixtures.ts](src/fixtures/api.fixtures.ts) → [auth.fixtures.ts](src/fixtures/auth.fixtures.ts) → [page.fixtures.ts](src/fixtures/page.fixtures.ts) → [data.fixtures.ts](src/fixtures/data.fixtures.ts) → [index.ts](src/fixtures/index.ts) | DI composition chain; `page.fixtures.ts` is the UI-critical layer (`appNavigator`, `guestPage`, `authenticatedPage`) |
| 14 | Navigation | [src/navigation/AppNavigator.ts](src/navigation/AppNavigator.ts) | Cross-screen actions; hides SPA view-toggling; returns next Page Object |
| 15 | Pages | [src/pages/BasePage.ts](src/pages/BasePage.ts), [LoginPage.ts](src/pages/LoginPage.ts), [CustomerListPage.ts](src/pages/CustomerListPage.ts), [CustomerDetailsPage.ts](src/pages/CustomerDetailsPage.ts) | Business-level page methods |
| 16 | Modals | [src/modals/](src/modals/) — `AddCustomerModal`, `AddAccountModal`, `TransferFundsModal` | Extend `ModalBase`; scoped modal interactions |
| 17 | Components | [src/components/](src/components/) — `AppHeader`, `CustomerTable`, `AccountsTable`, `TransactionsTable`, `AddressFieldGroup` | Composite, business-aware UI regions reused across pages |
| 18 | Widgets | [src/widgets/](src/widgets/) — `ErrorBanner`, `LoadingIndicator`, `NoDataMessage`, `ModalBase`, `PaginationControl`, `ConfirmationDialog` | Generic, business-agnostic reusable UI patterns |
| 19 | Controls | [src/controls/](src/controls/) — `TextInput`, `Button`, `Link`, `SelectDropdown`, `DataTable` | Thinnest wrappers over one Playwright `Locator` each |
| 20 | Locators | [src/constants/selectors.ts](src/constants/selectors.ts) | Centralized role/text/placeholder selector strings |
| 21 | Constants | [src/constants/urls.ts](src/constants/urls.ts), [timeouts.ts](src/constants/timeouts.ts), [messages.ts](src/constants/messages.ts), [filePaths.ts](src/constants/filePaths.ts), [endpoints.ts](src/constants/endpoints.ts) | Magic-string elimination |
| 22 | Assertions | [src/assertions/index.ts](src/assertions/index.ts) + `accountAssertions.ts`, `transactionAssertions.ts`, `apiAssertions.ts`, `accessibilityAssertions.ts` | Custom `expect()` matchers registered via `expect.extend()` |
| 23 | Utils | [src/utils/AccessibilityScanner.ts](src/utils/AccessibilityScanner.ts) | `@axe-core/playwright` wrapper for `@Accessibility`-tagged UI scenarios |
| 24 | Utils | [src/utils/RandomDataGenerator.ts](src/utils/RandomDataGenerator.ts), [TokenUtils.ts](src/utils/TokenUtils.ts), [DateUtils.ts](src/utils/DateUtils.ts), [CurrencyUtils.ts](src/utils/CurrencyUtils.ts), [WaitUtils.ts](src/utils/WaitUtils.ts), [Logger.ts](src/utils/Logger.ts) | Cross-cutting helpers used by steps/pages |
| 25 | Utils (process) | [src/utils/BackendProcessManager.ts](src/utils/BackendProcessManager.ts), [ProcessUtils.ts](src/utils/ProcessUtils.ts) | Spawn/health-check/kill the backend process for `global-setup`/`global-teardown` |
| 26 | Services | [src/services/ApiClient.ts](src/services/ApiClient.ts), `AuthApiService.ts`, `CustomerApiService.ts`, `AccountApiService.ts`, `TransferApiService.ts`, `DbService.ts` | Support fixtures for seeding/verifying state alongside UI actions |
| 27 | Types | [src/types/domain.ts](src/types/domain.ts), `testdata.ts`, `index.ts` | TS shapes mirroring API/DB records and YAML test data |
| 28 | Enums | [src/enums/](src/enums/) — `AccountStatus`, `AccountType`, `TransactionStatus`, `TransactionType`, `ViewState`, etc. | Typed domain values used in assertions/page logic |
| 29 | Reporting | `reports/html`, `reports/junit/results.xml`, `reports/blob` (generated), `playwright-report/` (CI artifact) | Output of the `reporter:` array in `playwright.config.ts` |
| 30 | App under test | `banking-app/backend/`, `banking-app/frontend/` | Express+SQLite backend and React/Vite frontend booted by `global-setup.ts` |

---

## 4. Worked example — one UI scenario end to end

Scenario: `@Smoke @Regression @UI @Positive` — *"Log out clears the active session on the client"* in [features/user_authentication.feature](features/user_authentication.feature).

1. `npm run test:ui` runs `playwright test --grep @UI`.
2. `playwright-bdd` (already bound via `defineBddConfig` in `playwright.config.ts`) has materialized this scenario as a spec in `tests/.features-gen/`, tagged `@UI` among others — it matches the grep filter.
3. `global-setup.ts` has already booted the backend (against an isolated DB copy) and frontend before any spec runs.
4. The fixture chain resolves for this test: `dbService` → `apiClient`/`authApiService` → `registeredUser` (created via a real API register call) → `appNavigator`, `authenticatedPage`.
5. Step `Given I am logged in as a registered bank staff user` resolves through the `authenticatedPage` fixture, which called `appNavigator.login()` → `LoginPage.login()` (using `TextInput`/`Button` controls built on `selectors.ts` locators) → asserted the logout button is visible → returned a `CustomerListPage`.
6. Step `When I log out` calls `appNavigator.logout()` → `AppHeader.logout()` (Component) → returns a `LoginPage`.
7. Step `Then I should be returned to the login screen` asserts `page.locator('.login-form h2')` via Playwright's `expect`.
8. Step `And my session token should no longer be used by the application` reads `state.capturedToken` (from `ScenarioState`, set earlier in the scenario) and verifies it's rejected — combining `state` fixture with an API/service check.
9. `data.fixtures.ts` teardown deletes anything seeded via API for this test; fixture chain unwinds in reverse order.
10. Reporters (`list`, `html`, `junit`, `blob`) record the result; on failure, trace/screenshot/video are attached automatically.
11. After the full run, `global-teardown.ts` kills the backend/frontend processes and deletes the runtime DB copy.

---

## 5. Related design docs already in this repo

- [PlaywrightAutomationArchitecture.md](PlaywrightAutomationArchitecture.md) — original layered-execution design; this document reflects that design as actually implemented.
- [PageObjectModel.md](PageObjectModel.md) — authoritative spec for the `Pages → Components → Widgets → Controls` layering used in §9 above.
- [AutomationTestPlan.md](AutomationTestPlan.md) — testing strategy per discipline (UI/API/DB/Accessibility/Security/Performance/etc.) and tag conventions.
- [TestScenarios.md](TestScenarios.md) — scenario catalog (`POS-xx`/`NEG-xx`/`SEC-xx` IDs) that `testdata/*.yml` and feature files trace back to.
- [Requirement.md](Requirement.md) — requirements/risk analysis of the banking app under test.
