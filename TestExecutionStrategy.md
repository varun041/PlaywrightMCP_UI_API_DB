# Test Execution Strategy — Banking Customer Management System

**Framework:** Playwright + TypeScript + `playwright-bdd` (Gherkin features in `features/*.feature`, step definitions in `tests/step-definitions/*.steps.ts`)
**Companion docs:** `AutomationTestPlan.md` (discipline-level scope/risk), `PlaywrightAutomationArchitecture.md` (framework internals), `PageObjectModel.md`
**Scope of this document:** how the existing suites are actually invoked, ordered, parallelized, gated, retried, and reported — day to day and in CI.

---

## 1. Suite Definitions

All suites are tag-selected subsets of the same 10 feature files, run via `npm run test:<suite>` (`scripts/run-with-allure.js`, which wraps `playwright test --grep <tag>` and always regenerates the Allure report afterward, pass or fail).

### 1.1 Smoke Suite
| Attribute | Detail |
|---|---|
| Tag | `@Smoke` |
| Command | `npm run test:smoke` |
| Content today | Login (positive), register (positive), `/api/health`, customer list load, account creation happy path, transfer happy path — 8 scenarios across `user_authentication`, `account_management`, `customer_profile_management`, `customer_search_and_directory`, `fund_transfer`, `system_health_and_error_handling` |
| Purpose | "Is it alive" — fastest possible signal, gates every other suite |
| Target runtime | < 2 minutes |
| When it runs | First job in every CI pipeline; first command after any local environment change |

### 1.2 Regression Suite
| Attribute | Detail |
|---|---|
| Tag | `@Regression` minus `@KnownGap` |
| Command | `npm run test:regression` (`--grep @Regression --grep-invert @KnownGap`) |
| Content today | The full authored suite (~120 scenarios) excluding documented product gaps |
| Purpose | Release/merge gate — everything that is expected to pass today |
| When it runs | Every PR to `main`; required before merge |
| Note | `@KnownGap`-tagged scenarios (e.g. missing enum validation, missing RBAC, missing idempotency — see `Requirement.md` R-2/R-5/R-9) are real, executable specs that currently fail by design. They run via `npm run test:known-gaps` and are tracked separately, not folded into the pass/fail gate, until product/eng decides to fix or formally accept them. |

### 1.3 Sanity Suite
| Attribute | Detail |
|---|---|
| Tag | Ad hoc, developer-selected (no fixed `@Sanity` tag exists) |
| Command | `npx playwright test --grep "@transfer|@account"` style, scoped to the feature area touched by the change |
| Purpose | Fast, targeted confidence after a small change, before asking for the full regression run |
| When it runs | On demand, locally or in a draft-PR CI run, never as a merge gate by itself |
| Guardrail | Bounded to the changed feature's tags (e.g. `@Fund_Transfer`-adjacent tags/feature file) — if the selected set starts approaching the full regression suite, it isn't sanity anymore |

### 1.4 API Suite
| Attribute | Detail |
|---|---|
| Tag | `@API` |
| Command | `npm run test:api` |
| Content today | The large majority of scenarios — auth, customer CRUD/search, accounts, transfers, sessions, security, system health — run directly against the Express backend via the `request` fixture, no browser needed |
| Purpose | Contract-level verification, independent of UI rendering |
| Runs on | `chromium` project only (see §5) — no value in repeating pure API calls across browser engines |

### 1.5 Database Suite
| Attribter | Detail |
|---|---|
| Tag | `@DB` |
| Command | `npm run test:db` |
| Content today | Post-operation state checks layered onto API/UI scenarios — transfer balance + dual transaction-row verification, account-deletion cascade, auth/password-hash storage checks (`account_management`, `fund_transfer`, `user_authentication`, `system_health_and_error_handling`) |
| Purpose | Confirms the API's claimed success is actually reflected in SQLite, catching partial-write/silent-failure bugs the API response alone would miss |
| Dependency | Runs against the **per-run isolated DB copy** `global-setup.ts` creates at `tests/DB/banking-<timestamp>.db` — never the checked-in seed or a developer's local `banking-app/backend/db/banking.db` |

### 1.6 E2E Suite
| Attribute | Detail |
|---|---|
| Tag | `@E2E` |
| Command | `npx playwright test --grep @E2E` |
| Content today | One curated journey in `end_to_end_customer_banking_journey.feature`: register → login → add customer → add account → transfer → verify UI/DB → delete → logout |
| Purpose | Full-stack, real-browser confidence on the path stakeholders actually care about |
| Characteristics | Slowest, most brittle layer (`@slow`-tagged) — deliberately kept small rather than duplicating UI/API edge cases |

---

## 2. Parallel Execution

- `fullyParallel: true` in `playwright.config.ts` — every test file (i.e., every generated BDD scenario) is its own isolated worker-parallel unit.
- **Local:** `workers` is unset → Playwright defaults to CPU-core-based parallelism. Fast, but flaky output ordering; use `--workers=1` when debugging a specific failure.
- **CI:** `workers: 1` — deliberately serial. Root cause: all scenarios share one backend process and one SQLite file (`global-setup.ts` boots a single backend instance against a single copied DB for the whole run); SQLite's single-writer semantics and shared server-side state (e.g., customer list pagination, search) make cross-worker parallel writes a source of flaky, order-dependent failures rather than real bugs. **Do not raise CI worker count without first giving each worker its own backend+DB instance** (e.g., per-worker port + DB file) — that is a prerequisite, not a config toggle.
- Cross-browser projects (`chromium`, `firefox`, `webkit`) execute as separate parallel top-level jobs/projects, each internally serial in CI per the point above.
- Within a suite, independent scenarios (different customers/accounts, timestamp-suffixed emails) are safe to interleave; scenarios that mutate shared/seeded rows (e.g., a fixed always-present test account) are not — author new specs to create/own their own data rather than relying on parallel-safe shared fixtures.

---

## 3. CI/CD Pipeline

Current pipeline: `.github/workflows/playwright.yml`, triggered on push/PR to `main`/`master` and manual `workflow_dispatch`.

```
checkout
  → setup Node (lts/*)
  → npm ci (root)
  → npm ci (banking-app/backend)
  → npm ci (banking-app/frontend)
  → npx playwright install --with-deps
  → npm run bdd:gen                  (materializes features/*.feature → tests/.features-gen)
  → npx playwright test              (global-setup boots backend+frontend against a fresh DB copy, all 3 projects run)
  → upload playwright-report/ artifact (always, even on failure)
```

Notes on the current pipeline:
- It runs the **entire** suite (all tags, all 3 browser projects) on every push/PR — there is no Smoke → Regression staging yet. Recommended evolution (see §5 Execution Order) is to split this into staged jobs so a smoke failure fails fast (~2 min) instead of waiting for the full ~60-minute budget.
- Backend/frontend bootstrap is **not** a separate CI step — it's handled per-run by `globalSetup`/`globalTeardown` in `config/global-setup.ts`, which also owns DB isolation (copies the seed DB, kills stale processes on the target ports, waits for health checks) and cleanup. This means `npx playwright test` is self-sufficient in CI; no manual `npm start`/`npm run dev` steps are needed before it.
- `forbidOnly: true` in CI (`playwright.config.ts`) — any `test.only`/`.only` scenario accidentally left in a feature/step file fails the CI build rather than silently narrowing the run.
- Artifact upload path (`playwright-report/`) should be reconciled with the actual configured output folder (`reports/html` per `playwright.config.ts` reporter config) — verify before relying on the uploaded artifact.

---

## 4. Tag Mapping

Tags observed across `features/*.feature`, grouped by purpose:

| Category | Tags | Meaning |
|---|---|---|
| Suite selection | `@Smoke`, `@Regression`, `@E2E` | Which run this scenario belongs to |
| Layer | `@UI`, `@API`, `@DB`, `@Integration` | Which system layer(s) the scenario exercises |
| Case type | `@Positive`, `@Negative`, `@Boundary`, `@Validation` | Nature of the assertion |
| Quality discipline | `@Security`, `@Accessibility`, `@PerformanceSmoke`, `@Authentication`, `@Authorization`, `@Session`, `@BusinessRule`, `@Concurrency`, `@Recovery`, `@Retry`, `@ErrorHandling` | Cross-cutting concern under test |
| Status/meta | `@KnownGap` | Scenario documents a currently-failing/unimplemented product behavior (see `Requirement.md` risks R-2/R-5/R-9) — excluded from the regression pass/fail gate by design, not a flake |
| Speed/cost | `@slow` | Long-running scenario (e.g. the E2E journey, full accessibility scans) — candidate for exclusion from fast feedback loops |
| Misc/legacy | `@FirstCase`, `@login` | Narrow, single-scenario markers used for targeted debugging (`test:FirstCase`) rather than suite composition |

Scripted mappings (`package.json`):

| npm script | Grep expression |
|---|---|
| `test` | (none — full suite, all tags) |
| `test:smoke` | `@Smoke` |
| `test:regression` | `@Regression` and not `@KnownGap` |
| `test:known-gaps` | `@KnownGap` |
| `test:security` | `@Security` |
| `test:accessibility` | `@Accessibility` |
| `test:performance` | `@PerformanceSmoke` |
| `test:ui` | `@UI` |
| `test:api` | `@API` |
| `test:db` | `@DB` |
| `test:FirstCase` | `@FirstCase` |

A scenario should carry **exactly one** suite tag (`@Smoke`/`@Regression`/`@E2E` — note `@Smoke` scenarios today are *also* tagged `@Regression`, i.e. smoke is a subset of regression, not a separate track) plus one-or-more layer and discipline tags. When authoring new scenarios, tag by what the scenario *proves*, not by which file it lives in.

---

## 5. Execution Order

Recommended staged order (target state — current CI runs everything in one untagged pass, see §3):

1. **Smoke** (`@Smoke`, chromium only) — fail fast, ~2 min. Hard gate: nothing below runs if this fails.
2. **API + DB** (`@API`, `@DB`, chromium only) — fastest full-coverage layer, no browser rendering cost.
3. **UI** (`@UI`, chromium) — page-object-driven functional coverage on the primary browser.
4. **E2E** (`@E2E`, chromium) — small curated journey suite, run after unit-level layers are already green so a failure here is more likely a real integration issue than a symptom of a lower-layer bug.
5. **Cross-browser pass** (`@UI` re-run on `firefox`, `webkit`) — per `playwright.config.ts`, these projects already `grep: /@UI/` so API/DB-only scenarios aren't redundantly repeated. Runs in parallel with (not blocking) steps 2–4, or nightly, per §6/§7 cadence.
6. **Known Gaps** (`@KnownGap`) — always runs, never blocks; tracked as a visibility report, not a gate.

Rationale for this order: cheapest/fastest signal first (smoke), then layers roughly in increasing cost and decreasing isolation (API/DB → UI → E2E → multi-browser), so a real regression is caught before the pipeline spends time on the slowest suites.

---

## 6. Environment Matrix

| Environment | Backend | Frontend | Database | `.env` file | Notes |
|---|---|---|---|---|---|
| Local dev | `localhost:3000` (spawned by `global-setup.ts`) | `localhost:3001` (spawned by `global-setup.ts`) | Fresh copy of seed DB per run at `tests/DB/banking-<timestamp>.db` | `config/environments/local.env` | Action timeout 10s / nav timeout 15s / perf threshold 500ms; `retries: 1` |
| CI (GitHub Actions) | Same spawn mechanism, `ubuntu-latest` runner | Same | Same isolation mechanism, discarded on teardown | `config/environments/ci.env` | Action timeout 15s / nav timeout 20s / perf threshold 800ms (looser, to absorb shared-runner variance); `retries: 2`; `workers: 1`; `forbidOnly: true` |
| Browsers | — | `chromium` (full suite), `firefox` + `webkit` (`@UI`-tagged only) | — | — | Selected via `projects` in `playwright.config.ts` |

Environment selection is automatic: `playwright.config.ts` loads `ci.env` when `process.env.CI` is set, `local.env` otherwise — there is no manual environment flag to pass. Every run — local or CI — gets its own disposable backend process and DB file; no suite run ever touches a shared/long-lived database.

---

## 7. Failure Handling

- **Trace/screenshot/video capture:** `trace: on-first-retry`, `screenshot: only-on-failure`, `video: retain-on-failure` (`playwright.config.ts`) — first-attempt failures get a screenshot+video immediately; a full trace is only captured on the retry attempt (to avoid tracing overhead on every passing test).
- **`@KnownGap` scenarios:** expected to fail today; excluded from the regression gate (`--grep-invert @KnownGap`) so they don't block merges, but still executed (`test:known-gaps`) so regressions-of-the-gap (e.g. it starts failing for a *new* reason) or unexpected fixes are visible.
- **`@Concurrency` scenarios** (e.g. `fund_transfer_resilience.feature`, the transfer race-condition probe): several are also `@KnownGap` — treated as discovery/characterization tests, not hard gates, until the underlying transaction-atomicity gap (`Requirement.md` R-4) is fixed or formally accepted.
- **Environment bootstrap failure:** if `global-setup.ts`'s health-check wait fails (backend/frontend never come up), the entire run aborts before any test executes — this is a hard infra failure, not a test failure, and should be triaged as such (check `ProcessUtils.killProcessOnPort`/port collisions first, per the comments in `global-setup.ts`).
- **`forbidOnly` in CI:** an accidental `.only()` fails the build outright rather than silently reducing coverage — treat this failure as a code-review miss, not a flake.
- **Flaky-test policy:** not yet formalized. Recommended: any spec that fails intermittently across 3+ CI runs without an environment-side explanation gets quarantined (moved out of `@Regression` into its own `@Quarantine` tag) with a tracked follow-up, rather than left in the gate accumulating retries and eroding trust in the suite (this mirrors the flake-tracking risk already called out in `AutomationTestPlan.md` §6.6).

---

## 8. Retry Rules

| Setting | Local | CI |
|---|---|---|
| `retries` | 1 | 2 |
| Trace on retry | `on-first-retry` (both) | `on-first-retry` (both) |

- Retries are Playwright's built-in per-test retry (`playwright.config.ts` → `retries`), not a custom mechanism — a test that fails is re-run in a fresh page/context up to the configured count before being marked failed.
- Retries mask true flakiness in the pass/fail signal but not in reporting: Allure/JUnit/HTML reporters record retry attempts, so a test passing only on retry 2/2 is visible in the report even though CI shows green — review these periodically rather than treating "green build" as "zero flake."
- `@Retry`-tagged scenarios (e.g. `user_authentication.feature:65`, `account_management.feature:110`) are testing the **application's own retry/resilience behavior** (e.g. idempotent login retry, backend reconnect) — do not confuse this with Playwright's test-runner retry setting above; these are functional assertions about the app, not a note about test flakiness.
- Do not raise CI `retries` as a workaround for a genuinely flaky spec — fix or quarantine it (§7) instead; retries are meant to absorb transient infra noise, not systemic test instability.

---

## 9. Reporting Flow

Configured reporters (`playwright.config.ts`):

| Reporter | Output | Purpose |
|---|---|---|
| `list` | stdout | Live console feedback during the run |
| `html` | `reports/html/` | Human-browsable run report (`npm run test:report` opens it) |
| `junit` | `reports/junit/results.xml` | CI-system-consumable results (test-count/pass-fail trend integrations) |
| `blob` | `reports/blob/` | Playwright's merge-friendly format, for combining sharded/multi-project runs into one report |
| `allure-playwright` | `reports/allure-results/` | Source data for the Allure report |

Flow:
1. Every `npm run test:*` script routes through `scripts/run-with-allure.js`, which runs `playwright test` first, **then unconditionally** runs `npx allure generate reports/allure-results --clean -o reports/allure` — even on a failed test run, so a report always exists to inspect.
2. **Locally:** if generation succeeds, `npx allure open reports/allure` launches a detached local preview server (non-blocking — the script exits and doesn't wait on it).
3. **In CI:** the open step is skipped (`isCI` check); instead the workflow uploads `playwright-report/` as a build artifact (30-day retention) via `actions/upload-artifact` — see the reconciliation note in §3 about matching this path to the actual configured `html` output folder.
4. `npm run allure:report` is available as a standalone command to regenerate + open the Allure report from existing `reports/allure-results/` without re-running tests (useful after pulling someone else's CI artifacts locally).
5. Recommended addition (not yet implemented): publish the Allure/HTML report to a durable location (GitHub Pages, or an artifact-hosting step) so results are reviewable without downloading and unzipping the CI artifact.

---

*This document describes execution mechanics only. For per-discipline scope, risk, and entry/exit criteria, see `AutomationTestPlan.md`.*
