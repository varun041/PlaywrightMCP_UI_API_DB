# Playwright Automation Architecture

**Based on:** `PageObjectModel.md` (UI layer detail), `AutomationTestPlan.md` (strategy/tooling), `features/*.feature` + tags, `testdata/*.yml`, existing `playwright.config.ts`
**Scope:** Architecture only — no implementation code. This is the execution engine that wraps around the Page Object Model already designed in `PageObjectModel.md`.

---

## 1. How This Fits With Prior Artifacts

| Document | Answers |
|---|---|
| `Requirement.md` | What does the system do, what are the risks? |
| `AutomationTestPlan.md` | What test types, at what priority, with what strategy? |
| `TestScenarios.md` / `features/*.feature` | What are the concrete scenarios, tagged how? |
| `testdata/*.yml` | What data backs each scenario? |
| `PageObjectModel.md` | How is the UI abstracted (Pages/Components/Widgets/Controls)? |
| **This document** | How does the whole thing actually **run**: fixtures, DI, API/DB access, assertions, reporting, retries, parallelism, tags? |

Nothing here contradicts `PageObjectModel.md` — its `src/pages`, `src/services`, `src/fixtures`, `src/enums`, `src/constants` are the building blocks; this document adds the execution-engine layer around them (config, DI composition, assertions, reporting, CI strategy).

---

## 2. Layered Execution Architecture

```
CI Trigger (GitHub Actions matrix: project × shard)
        │
        ▼
Global Setup  (health-check app, snapshot isolated DB, provision base test user/token)
        │
        ▼
Playwright Test Runner  (playwright.config.ts — projects, workers, retries, reporters)
        │
        ▼
Worker Process  ──▶  Worker-scoped Fixtures   (base APIRequestContext, DB connection)
        │                    │
        ▼                    ▼
Test Instance  ──▶  Test-scoped Fixtures      (authenticatedPage, testData, seededCustomer/Account)
        │                    │
        ▼                    ▼
Step Definitions  ──▶  Pages / Services / Custom Assertions / Reusable Helpers
        │
        ▼
Test-scoped Teardown  (API cleanup of seeded data, dispose derived contexts)
        │
        ▼
Worker Teardown  (close DB connection, dispose base context)
        │
        ▼
Global Teardown  (restore/clean isolated DB copy)
        │
        ▼
Reporters  (HTML / JUnit / blob-merge / trace) ──▶ CI artifact upload
```

---

## 3. TypeScript Conventions

- `strict: true` in `tsconfig.json`; no implicit `any` anywhere in `src/`.
- Path aliases (`@pages/*`, `@services/*`, `@utils/*`, `@fixtures/*`, `@enums/*`, `@constants/*`, `@assertions/*`) so step definitions never use deep relative imports (`../../../src/pages/...`).
- One `interface`/`type` per test-data shape, mirroring each `testdata/*.yml` schema (e.g. a `CustomerProfileData` type matching `customer_profile_management.yml`'s entries) — `TestDataLoader` returns these typed shapes, not `any`/raw YAML objects.
- Enums (`src/enums`) used at every call site instead of string literals for account type/status, transaction type/status, and search filter — matching `PageObjectModel.md` §11.

---

## 4. Playwright Fixtures as the Dependency Injection Container

Playwright's `test.extend<T>()` **is** the DI mechanism here — there is no separate DI framework. Fixtures declare what they depend on by destructuring other fixtures; Playwright resolves the dependency graph and instantiates each fixture lazily, exactly once per its declared scope.

| Concept | How it's realized |
|---|---|
| Declaration | Each fixture file (`auth.fixtures.ts`, `api.fixtures.ts`, `db.fixtures.ts`, `data.fixtures.ts`, `page.fixtures.ts`) exports a partial `test.extend()` |
| Composition root | `src/fixtures/index.ts` chains all partial `.extend()` calls into one exported `test`, which every step definition imports |
| Dependency declaration | A fixture that needs another (e.g. `authenticatedPage` needs `guestPage` + `testData`) receives them as destructured parameters — Playwright injects them automatically |
| Scope control | `{ scope: 'worker' }` for expensive, shareable resources (base `APIRequestContext`, DB connection); default test-scope for anything that must be fresh per test (seeded customer/account, resolved test data) |
| Teardown | Each fixture's code after `use()` runs its cleanup, in reverse dependency order, automatically |

| Fixture | Scope | Depends on | Purpose |
|---|---|---|---|
| `baseApiContext` | worker | — | Anonymous `APIRequestContext` against `API_BASE_URL`, for register/login calls |
| `dbConnection` | worker | — | Scoped SQLite connection to the isolated test-run DB copy |
| `testData` | test | — | Resolves the `TestCaseId` referenced by the current scenario via `TestDataLoader` |
| `registeredUser` | test | `baseApiContext`, `testData` | Run-unique user provisioned via API, not UI |
| `apiContext` | test | `baseApiContext`, `registeredUser` | Bearer-token-authenticated `APIRequestContext` |
| `guestPage` | test | — | Browser page at the login screen, unauthenticated |
| `authenticatedPage` | test | `guestPage`, `registeredUser` | Page already past login, via `AppNavigator.login()` |
| `seededCustomer` | test | `apiContext` | Disposable customer created via API before the test, deleted after |
| `seededAccount` | test | `apiContext`, `seededCustomer` | Disposable account (optionally with transaction history) created via API, deleted after |

---

## 5. APIRequestContext Strategy

- **Worker-scoped base context** (`baseApiContext`): created once per worker via `request.newContext({ baseURL: API_BASE_URL })`. Used for anonymous calls (`/auth/register`, `/auth/login`) and as the parent for authenticated contexts, so TCP/TLS setup isn't repeated per test.
- **Test-scoped authenticated context** (`apiContext`): derived from the base context with the `Authorization: Bearer <token>` header injected after a fresh login for that test's `registeredUser` — never shared across tests, so token expiry/tampering scenarios (`session_and_token_management.feature`, `security_and_access_control.feature`) can freely mutate their own context without affecting others.
- **Dual-purpose usage**: the same `APIRequestContext` backs both (a) `@API`-tagged step definitions asserting directly against endpoints, and (b) UI-flow preconditions — `seededCustomer`/`seededAccount` create state via the API rather than by driving the UI, so UI specs start from a known state without depending on the Add Customer/Add Account UI flows being correct (avoids circular dependency between "UI test" and "UI-created precondition").
- **Disposal**: `apiContext.dispose()` and `baseApiContext.dispose()` run in fixture teardown to release connections cleanly at test/worker end.

---

## 6. Database Utilities

- Extends the existing `tests/utils/db.ts` into the `DbService` defined in `PageObjectModel.md` §8, adding:
  - **Isolated-copy strategy**: global setup copies `banking-app/backend/db/banking.db` (or the existing `tests/DB/banking.db`) to a fresh, per-run working copy before the suite starts, so tests never mutate the developer's live seed data.
  - **Query helpers** matching the real schema: `getAccountBalance(accountId)`, `getTransactionsByReference(reference)`, `countOrphanedTransactions()`, `getUserPasswordHash(username)`.
  - **Concurrency awareness**: SQLite is single-writer — `DbService` centralizes connection handling so the framework has exactly one place to apply retry-on-`SQLITE_BUSY` logic, rather than each test reinventing it (relevant to `@DB` and `@Concurrency` scenarios — see §9).
- Used both directly (in `@DB`-tagged step definitions) and indirectly (by Custom Assertions, §7, that need to cross-check UI/API state against the database).

---

## 7. Custom Assertions

Domain-specific matchers registered once via `expect.extend()` in `src/assertions/index.ts`, imported by every spec/step-definition file so assertions read in business terms instead of raw locator/response checks.

| Matcher | Backs |
|---|---|
| `toHaveAccountStatus(expected: AccountStatus)` | Account lifecycle scenarios |
| `toHaveBalance(expected: number, tolerance?: number)` | Transfer/boundary scenarios — tolerance parameter exists specifically because balances are stored as floating-point `REAL` (Requirement.md R-8) |
| `toHaveLinkedTransactions(reference: string)` | Transfer transaction-pair verification (BR-07) |
| `toMatchApiError(testCaseId: string)` | Resolves the expected error message from the same YAML entry `TestDataLoader` already loaded, instead of hardcoding message text in assertions |
| `toBeAccessible()` | Wraps `AccessibilityScanner` violations into a single matcher for every `@Accessibility` scenario |
| `toRespondWithinThreshold(ms: number)` | `@PerformanceSmoke` scenarios |

These live in `src/assertions/`, one file per domain area (`accountAssertions.ts`, `transactionAssertions.ts`, `apiAssertions.ts`, `accessibilityAssertions.ts`), registered from a single `index.ts` so global setup only needs one import.

---

## 8. Reusable Helpers

Already itemized in `PageObjectModel.md` §9 (`TestDataLoader`, `RandomDataGenerator`, `DateUtils`, `CurrencyUtils`, `TokenUtils`, `WaitUtils`, `AccessibilityScanner`). In this architecture they are **injected via fixtures**, not imported ad hoc into step definitions — this keeps step definitions swappable/mockable per environment and keeps a single instantiation point per test/worker rather than scattered `new Helper()` calls.

---

## 9. Folder Structure

Extends `PageObjectModel.md` §13 with the execution-engine-specific pieces (config, step definitions, assertions, reporting):

```
PlayWright_API_DB_UI_AI/
├── features/                        # Gherkin (existing)
├── testdata/                        # YAML test data (existing)
├── tests/
│   ├── DB/banking.db                 # existing seed source (copied, never mutated directly)
│   ├── example.spec.ts               # existing
│   ├── utils/db.ts                   # existing — wrapped by src/services/DbService.ts
│   └── step-definitions/
│       ├── authentication.steps.ts
│       ├── session.steps.ts
│       ├── security.steps.ts
│       ├── customer-profile.steps.ts
│       ├── customer-search.steps.ts
│       ├── account.steps.ts
│       ├── transfer.steps.ts
│       ├── transfer-resilience.steps.ts
│       ├── system-health.steps.ts
│       └── e2e-journey.steps.ts
├── src/                               # (as designed in PageObjectModel.md, unchanged)
│   ├── pages/  modals/  components/  widgets/  controls/  navigation/
│   ├── services/  utils/  enums/  constants/
│   ├── fixtures/
│   │   ├── index.ts                   # composition root — chained .extend() calls
│   │   ├── auth.fixtures.ts
│   │   ├── api.fixtures.ts
│   │   ├── db.fixtures.ts
│   │   ├── data.fixtures.ts
│   │   └── page.fixtures.ts
│   └── assertions/
│       ├── index.ts                   # expect.extend() registration
│       ├── accountAssertions.ts
│       ├── transactionAssertions.ts
│       ├── apiAssertions.ts
│       └── accessibilityAssertions.ts
├── config/
│   ├── environments/
│   │   ├── local.env
│   │   └── ci.env
│   ├── global-setup.ts
│   └── global-teardown.ts
├── reports/                            # generated, gitignored
│   ├── html/
│   ├── junit/
│   └── blob/                           # per-shard results, merged in CI
├── playwright.config.ts
├── playwright-bdd.config.ts            # Gherkin↔step-definition binding (not yet installed — see §12)
├── tsconfig.json
└── package.json
```

---

## 10. Naming Convention

| Artifact | Convention | Example |
|---|---|---|
| Feature files | kebab-case (existing) | `fund_transfer.feature` |
| Step definition files | `<capability>.steps.ts` | `account.steps.ts` |
| Page Objects | PascalCase + `Page` suffix | `CustomerDetailsPage` |
| Modals | PascalCase + `Modal` suffix | `TransferFundsModal` |
| Components / Widgets / Controls | PascalCase, no suffix | `AccountsTable`, `ErrorBanner`, `Button` |
| Services | PascalCase + `Service` suffix | `TransferApiService` |
| Fixtures | camelCase, no suffix | `authenticatedPage`, `seededAccount` |
| Custom assertion matchers | camelCase, `toXxx` (Jest/Playwright convention) | `toHaveBalance` |
| Enums | PascalCase, singular noun | `AccountType` (not `AccountTypes`) |
| Primitive constants | UPPER_SNAKE_CASE | `TOKEN_EXPIRY_HOURS` |
| Grouped constants | PascalCase object, dotted access | `Endpoints.CUSTOMERS` |
| TestCaseIds | `<CATEGORY>-<NN>` (existing, from `TestScenarios.md`) | `BND-06`, `POS-13-SAVINGS` |
| Tags | PascalCase, `@`-prefixed (existing) | `@PerformanceSmoke` |

---

## 11. Execution Flow

1. **CI trigger** — push/PR fires the GitHub Actions matrix (project × shard).
2. **Global setup** (`config/global-setup.ts`) — health-check backend/frontend, copy a fresh isolated DB working copy, provision/verify the base test user, warm any shared tokens.
3. **Runner launches configured projects** (chromium/firefox/webkit, per `playwright.config.ts`), each as its own worker pool; shards subdivide the test file list per CI job.
4. **Worker-scoped fixtures instantiate once per worker**: `baseApiContext`, `dbConnection`.
5. **Per test, test-scoped fixtures resolve in dependency order**: `testData` → `registeredUser` → `apiContext`/`guestPage` → `authenticatedPage` → `seededCustomer`/`seededAccount`, exactly as declared by each step definition's needs.
6. **Step definitions execute**, translating Gherkin steps into calls against Pages/Services, asserting via Custom Assertions.
7. **On failure** — Playwright captures a screenshot, video (retain-on-failure), and trace (on-first-retry); the retry policy (§12) decides whether to re-run.
8. **Test-scoped teardown** — seeded customers/accounts deleted via API, derived `apiContext` disposed, in reverse dependency order.
9. **Worker teardown** — `dbConnection` closed, `baseApiContext` disposed at the end of the worker's lifetime.
10. **Global teardown** (`config/global-teardown.ts`) — discard/clean the isolated DB working copy.
11. **Reporters** emit HTML/JUnit/blob output; CI merges per-shard blobs into one report and uploads all artifacts.

---

## 12. Reporting

- **Multi-reporter config**: `html` (existing default, kept for local debugging), `junit` (new — CI test-result ingestion), `blob` (new — per-shard results for merging), `list`/`dot` for console feedback during local runs.
- **Trace/screenshot/video**: keep existing `trace: 'on-first-retry'`; add `screenshot: 'only-on-failure'` and `video: 'retain-on-failure'` so UI failures are diagnosable without re-running locally.
- **Shard merging**: each CI shard uploads its `blob` report; a final job runs Playwright's report-merge step to produce one consolidated HTML report before publishing.
- **`@KnownGap` visibility** (see §14): reporting should distinguish scenarios that are *expected* to currently fail (the intentional discovery scenarios like `CONC-01`, `RETRY-01`, `RECOV-01`) from genuine regressions, so a red pipeline always means a real problem, not a known, already-tracked gap.
- **Artifact retention**: existing `.github/workflows/playwright.yml` already uploads `playwright-report/` for 30 days — extend the same job to also upload `reports/junit/` and merged traces.

---

## 13. Retry Strategy

- **Baseline**: keep the existing pattern already in `playwright.config.ts` — `retries: process.env.CI ? 2 : 0`. Local runs never silently retry; CI gets two attempts to absorb genuine environment flakiness (slow CI runners, network blips).
- **Exception for `@Concurrency` / `@Retry` / `@Recovery`-tagged scenarios**: these scenarios (`fund_transfer_resilience.feature` and the equivalent tagged scenarios elsewhere) are *deliberately* probing known, currently-unfixed race conditions and idempotency gaps (Requirement.md R-4/R-5). Blind retries here are actively harmful:
  - A flaky-but-sometimes-passing race condition could retry into a false "pass," hiding the defect.
  - Retrying doesn't add signal — the point of these scenarios is to characterize instability, not achieve a stable green result.
  - **Policy**: run these with `retries: 0` regardless of CI/local, and treat any outcome (pass or fail) as informational rather than pipeline-blocking (see §14/§15 — these run in a separate, non-blocking job).
- **Flake tracking**: for all other tags, a test that only passes after a retry should still be flagged (via JUnit's retry-count metadata) for follow-up de-flaking — retries absorb noise for pipeline stability, but a test that *needs* retries repeatedly is a maintenance signal, not something to ignore indefinitely.

---

## 14. Parallel Execution Strategy

- **Current baseline**: existing `playwright.config.ts` sets `workers: process.env.CI ? 1 : undefined` — effectively serial in CI today. This architecture's isolation guarantees (every test creates/tears down its own customer/account via `seededCustomer`/`seededAccount`, never touching shared rows) are what make it safe to raise this.
- **Recommended tiering**:
  - **`@UI` scenarios** — parallelize per browser project (chromium/firefox/webkit already configured as separate projects); each project gets its own worker pool since browser instances are naturally isolated.
  - **`@API` read-only scenarios** (list/search/view) — fully parallelizable; no shared mutable state.
  - **`@API` write scenarios** (create/delete/transfer) — parallelizable *between* tests because each owns its own rows, but keep worker count moderate (e.g. 4, not maximal) since SQLite is still a single physical file underneath and excessive concurrent writers increase `SQLITE_BUSY` contention even with row-level isolation at the test level.
  - **`@DB` scenarios and the `@Concurrency` race-condition probes specifically** — run in a dedicated project with a capped worker count (or serially), because these scenarios need *controlled* concurrency (a deliberately orchestrated simultaneous request pair), not *incidental* concurrency from unrelated parallel tests stepping on the same file.
- **Sharding**: CI matrix uses `--shard=N/M` to split each project's test files across machines; the DB-sensitive project is either excluded from horizontal sharding or given a dedicated single shard, consistent with the capped-concurrency requirement above.

---

## 15. Tag Strategy

Tags already exist across all 10 `features/*.feature` files (assigned during Gherkin authoring); this section formalizes how the CI layer consumes them. **No changes to the existing feature files are implied except the one new tag proposed below.**

| Category | Tags | Purpose |
|---|---|---|
| Execution-control | `@Smoke`, `@Regression`, `@E2E` | Which CI job/grep pattern runs them |
| Layer | `@UI`, `@API`, `@DB` | Which project/runner executes them; feeds the Parallel Execution tiering in §14 |
| Test-type (traceable to `TestScenarios.md`) | `@Positive`, `@Negative`, `@Boundary`, `@Validation`, `@BusinessRule`, `@Authorization`, `@Authentication`, `@Session`, `@ErrorHandling`, `@Integration`, `@Concurrency`, `@Retry`, `@Recovery`, `@Accessibility`, `@Security`, `@PerformanceSmoke` | Risk-based reporting and selective quality-dimension runs |
| **Special-handling (proposed new tag)** | `@KnownGap` | Marks scenarios that intentionally document a current, un-remediated defect (e.g. `CONC-01`, `RETRY-01`, `RECOV-01`, the `AUTHZ-*` IDOR scenarios, the hardcoded-secret scenario) so they can be run informationally without blocking the pipeline (§13/§14), while still being tracked for remediation |

**CI job matrix (grep patterns):**

| Job | Command pattern | Blocking? |
|---|---|---|
| PR gate | `--grep "@Smoke"` | Yes — fast, must pass |
| Nightly regression | `--grep "@Regression" --grep-invert "@KnownGap"` | Yes |
| Security audit (weekly) | `--grep "@Security"` | Yes |
| Accessibility audit | `--grep "@Accessibility"` | Advisory |
| Performance smoke | `--grep "@PerformanceSmoke"` | Advisory |
| Known-gap tracking | `--grep "@KnownGap"` | No — informational only |

---

## 16. Open Items / Dependencies

1. **`playwright-bdd` (or equivalent) is not yet installed.** This entire architecture assumes a Cucumber-compatible Playwright runner binds `features/*.feature` to `tests/step-definitions/`; `playwright.config.ts` currently only points `testDir` at `./tests`. Same open item as `PageObjectModel.md` §14.1.
2. **`@KnownGap` is a new proposal**, not a tag already present in the `.feature` files — applying it is a follow-up edit to `fund_transfer_resilience.feature` and the relevant scenarios in `security_and_access_control.feature`, not something already done.
3. **Raising CI parallelism from the current `workers: 1`** should happen only after the `seededCustomer`/`seededAccount` fixture-based isolation (§4) is actually implemented and proven — don't flip CI to parallel before that safety net exists.
4. **Global setup's DB copy strategy** needs a decision on source of truth: copy from `banking-app/backend/db/banking.db` (the live seed) or from `tests/DB/banking.db` (already an isolated copy) — recommend the latter to avoid any path where a CI run could accidentally touch the developer-facing seed file.