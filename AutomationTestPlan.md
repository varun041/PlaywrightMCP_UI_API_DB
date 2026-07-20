  # Automation Test Plan — Banking Customer Management System

**Based on:** `Requirement.md` (approved requirements analysis)
**Application under test:** `banking-app/` (Express + SQLite backend, React/Vite frontend)
**Automation framework:** Root-level Playwright + TypeScript (`playwright.config.ts`, `tests/`)
**Status:** Draft for review — no test cases have been executed yet; this plan defines strategy only.

---

## 1. Purpose & Objectives

This plan defines how the Banking Customer Management System will be verified across all layers (UI, API, DB) and quality dimensions (functional, security, accessibility, performance, compatibility), using the existing Playwright/TypeScript framework as the automation backbone, supplemented by targeted manual/tooling activities where automation is not yet feasible.

It is scoped to the features documented in `Requirement.md`: Authentication, Customer Management, Account Management, Transactions & Transfers, and the underlying SQLite data layer.

---

## 2. Current Automation Baseline (as-is)

| Layer | Current State |
|---|---|
| UI | Placeholder specs only (`tests/example.spec.ts` hits playwright.dev, not the app) |
| API | No specs yet |
| DB | One check (`countCustomers()` via `tests/utils/db.ts`) |
| CI | `.github/workflows/playwright.yml` runs `npx playwright test` on push/PR; does not currently start the app's backend/frontend |

This plan treats the above as the starting point to be built out, not as existing coverage.

---

## 3. Tools & Frameworks

| Purpose | Tool | Status |
|---|---|---|
| UI/E2E automation | Playwright (`@playwright/test`) | In place |
| API automation | Playwright `request` fixture, or `supertest` against Express directly | In place (Playwright), not yet used for API |
| DB verification | `sqlite3` via `tests/utils/db.ts`; `sqlite` MCP server for ad-hoc queries | In place |
| Accessibility | `@axe-core/playwright` | **To be added** |
| Security (functional) | Playwright + custom auth/negative-path specs | Partial — to be built |
| Security (scanning) | OWASP ZAP baseline scan (CI job) | **To be added** |
| Performance smoke | `k6` or `autocannon` against key endpoints | **To be added** |
| Cross-browser | Playwright projects: chromium, firefox, webkit (already configured) | In place |
| CI/CD | GitHub Actions (`playwright.yml`) | In place, needs app bootstrap step |

---

## 4. Test Environment Matrix

| Environment | Backend | Frontend | DB | Purpose |
|---|---|---|---|---|
| Local dev | `localhost:3000` | `localhost:3001` | `banking-app/backend/db/banking.db` | Day-to-day authoring/debugging |
| CI (GitHub Actions) | Started in-workflow (to be added) | Started in-workflow (to be added) | Fresh/seeded copy per run | PR gating, regression |
| Test data source of truth | — | — | `tests/DB/banking.db` (isolated copy) | DB-layer assertions without touching the live app DB |

All environments require Node.js 18+, `npm install` at root and in both `banking-app/backend` and `banking-app/frontend`, and a registered test user (see §5 of `Requirement.md` — no seeded login exists).

---

## 5. Overall Entry/Exit Criteria (Plan-Level)

**Entry Criteria (to begin executing this plan):**
- `Requirement.md` reviewed and open questions (§12) either answered or explicitly deferred with owner sign-off.
- App runnable locally per `README.md` (`npm start` backend, `npm run dev` frontend).
- A test user can be registered/authenticated via `/api/auth/register` + `/api/auth/login`.
- CI workflow updated to boot the backend/frontend before running UI/API specs (currently missing).

**Exit Criteria (plan considered fulfilled for a release):**
- All **P1** (High priority) suites below pass in CI.
- No open **Critical/High** defects in Authentication, Account creation/deletion, or Transfers.
- Smoke + Sanity suites green on every merge to `main`.
- Known risks from `Requirement.md` §10 either mitigated or explicitly accepted/deferred by the product owner.

---

## 6. Feature/Discipline Test Sections

Each subsection below covers one testing discipline across the application's features (Authentication, Customers, Accounts, Transfers, Search/Pagination).

### 6.1 UI Testing

| Attribute | Detail |
|---|---|
| **Scope** | Login/Register form, Customer List (search, pagination, add), Customer Details (profile, accounts table, transactions table), Add Customer modal, Add Account modal, Transfer Funds modal, per-account Delete/Transfer actions, logout. |
| **Out of Scope** | Visual/pixel-perfect design regression (no baseline tool configured); animation/transition timing. |
| **Risks** | No `data-testid` attributes present — selectors must rely on roles/text/labels, which are more brittle to copy changes. `window.confirm()` is used for delete confirmation, which Playwright must handle via `page.on('dialog')`. |
| **Dependencies** | Frontend (`npm run dev`) and backend both running; a valid registered user. |
| **Priority** | High (Auth, Add Customer, Add Account, Transfer, Delete Account); Medium (Search/Pagination, Edit Customer). |
| **Automation Feasibility** | High — Playwright already configured with 3 browser projects. |
| **Execution Strategy** | Page-Object-Model layer over existing components; run on every PR (smoke subset) and nightly (full UI regression). |
| **Test Data Strategy** | Seeded `banking.db` provides existing customers/accounts for read/search flows; new customers/accounts created and cleaned up (or tagged) per test run to avoid polluting shared data. |
| **Environment Requirements** | Local or CI-booted frontend+backend; Chromium as default CI browser, Firefox/WebKit for cross-browser pass (§6.12). |
| **Entry Criteria** | App boots without console errors; test user can log in. |
| **Exit Criteria** | All P1 UI flows (login, add customer, add account, transfer, delete account) pass on Chromium in CI; no unhandled JS console errors during the run. |

### 6.2 API Testing

| Attribute | Detail |
|---|---|
| **Scope** | All endpoints in `Requirement.md` §7: `/auth/register`, `/auth/login`, `/customers` (CRUD, search, accounts, transactions), `/customers/:id/accounts` (create), `/accounts/:id` (delete), `/accounts/transfer`, `/health`, `/routes`. Positive, negative, and boundary cases (missing fields, invalid IDs, insufficient funds, inactive accounts, self-transfer). |
| **Out of Scope** | Load/concurrency testing (covered under Performance Smoke, §6.11, at a basic level only). |
| **Risks** | No server-side validation of `accountType`/`currency` enums (Requirement.md BR-2, R-9) — tests must document this as a known gap, not a defect, unless product decides to enforce it. No transaction atomicity on transfer (R-4) — needs a dedicated race-condition test (see §6.4). |
| **Dependencies** | Backend running; JWT obtained via `/auth/login` for authenticated calls. |
| **Priority** | High — API is the contract underlying both UI and any future integrations. |
| **Automation Feasibility** | High — stateless REST over HTTP, ideal for Playwright `request` context or `supertest`. |
| **Execution Strategy** | Contract-style specs per resource; run on every PR. Chain register → login → CRUD → cleanup. |
| **Test Data Strategy** | Dynamically create/delete test customers and accounts per test (self-contained); use unique emails (timestamp-suffixed) to avoid the unique-email constraint collisions. |
| **Environment Requirements** | Backend + SQLite only (no frontend needed). |
| **Entry Criteria** | `/api/health` returns 200. |
| **Exit Criteria** | 100% of documented endpoints have at least one positive and one negative test; all pass in CI. |

### 6.3 Database Testing

| Attribute | Detail |
|---|---|
| **Scope** | Schema shape (`customers`, `accounts`, `transactions`, `users`), referential consistency (account belongs to existing customer, transaction belongs to existing account), post-operation state verification (e.g., after a transfer, both accounts' balances and two new transaction rows exist with a shared `reference`), cascade-delete behavior for accounts. |
| **Out of Scope** | DB performance/index tuning; migration testing (no migration framework exists — tables are created ad hoc). |
| **Risks** | No enforced FK constraints at the SQLite level (Requirement.md §8 note) — orphaned rows are possible and won't raise DB errors, only app-level bugs. Direct DB tests must not assume constraint enforcement. |
| **Dependencies** | `tests/utils/db.ts` helpers; a DB file to query — either `tests/DB/banking.db` or the live `banking-app/backend/db/banking.db`, decided by test isolation strategy below. |
| **Priority** | High for Transfers (money movement correctness) and cascade-delete; Medium for general schema checks. |
| **Automation Feasibility** | High — `sqlite3` Node driver already a dependency; `sqlite` MCP available for ad hoc exploration during authoring. |
| **Execution Strategy** | After each API-level state-changing test (transfer, delete), assert directly against the DB rather than trusting only the API's response body — this catches bugs where the API claims success but the DB write is wrong/partial. |
| **Test Data Strategy** | Prefer a disposable DB copy per CI run so DB assertions don't depend on execution order or leftover state from prior runs. |
| **Environment Requirements** | No frontend/backend process required for pure DB tests — backend required if asserting via API-then-DB combined flows. |
| **Entry Criteria** | Target `.db` file exists and matches the documented schema. |
| **Exit Criteria** | All transfer and delete operations verified to leave the DB in the expected state; zero orphaned transaction rows after account deletion. |

### 6.4 Integration Testing

| Attribute | Detail |
|---|---|
| **Scope** | Cross-layer flows where API + DB + (optionally) UI must agree: Add Account → account visible in Customer Details and in DB; Transfer → both accounts' balances update consistently and are reflected in the UI's transactions table; Delete Account → account and its transactions disappear from both API responses and DB. Also: concurrent-transfer race condition probe (fire two simultaneous transfers from the same account exceeding combined balance) to characterize R-4 from `Requirement.md`. |
| **Out of Scope** | Integration with external systems — none exist per `Requirement.md` §9. |
| **Risks** | The concurrency probe is expected to currently **fail** (no DB transaction/locking) — this is a discovery test, not a regression gate, until the product owner decides whether to fix it (see Requirement.md Q4). |
| **Dependencies** | Full stack (backend + DB; frontend only for UI-inclusive integration checks). |
| **Priority** | High for the transfer money-movement integration path; Medium for account lifecycle. |
| **Automation Feasibility** | High for API+DB integration; Medium for UI-inclusive (slower, more brittle). |
| **Execution Strategy** | Run as part of the API suite but tagged `@integration`; concurrency probe isolated as its own tagged spec so it can be excluded from a hard pass/fail gate until triaged. |
| **Test Data Strategy** | Two freshly created accounts with a known starting balance per test, torn down after. |
| **Environment Requirements** | Same as API + DB testing. |
| **Entry Criteria** | API and DB suites (§6.2, §6.3) individually passing. |
| **Exit Criteria** | Account lifecycle and transfer integration paths pass; concurrency probe result documented and triaged (fixed, or formally accepted as a known limitation). |

### 6.5 End-to-End (E2E) Testing

| Attribute | Detail |
|---|---|
| **Scope** | Full user journeys through the real UI against the real API/DB: register → login → add customer → add account → transfer funds to another account → verify updated balances/transactions in UI → delete account → logout. |
| **Out of Scope** | Journeys involving unimplemented features (self-service customer login, notifications, statements). |
| **Risks** | Slowest and most brittle layer; UI copy/selector changes break these first. Keep the E2E suite small and journey-focused rather than duplicating every UI/API edge case here. |
| **Dependencies** | Full stack running (backend + frontend + DB). |
| **Priority** | High — this is the suite closest to real user value and is what stakeholders will trust as "it works." |
| **Automation Feasibility** | High with Playwright, but higher maintenance cost than API/DB layers. |
| **Execution Strategy** | Small, curated set (5–10 journeys) run on every PR to `main`; kept independent of the larger UI regression pack (§6.1) which can run nightly. |
| **Test Data Strategy** | Fully synthetic, unique-per-run data (timestamped emails/usernames) to avoid cross-run collisions; clean up created customers/accounts at the end of each journey. |
| **Environment Requirements** | CI must boot both backend and frontend before this suite runs (current gap — see §5). |
| **Entry Criteria** | Smoke suite (§6.7) green. |
| **Exit Criteria** | All curated journeys pass on the primary browser (Chromium) before merge to `main`. |

### 6.6 Regression Testing

| Attribute | Detail |
|---|---|
| **Scope** | The full accumulated suite (UI + API + DB + Integration) run against every change to prevent reintroduction of fixed defects, with special attention to the three newest features: Add Account, Delete Account, Transfer Funds. |
| **Out of Scope** | Newly authored, not-yet-stabilized specs (quarantine until reliable, then promote into regression). |
| **Risks** | As the suite grows, flaky tests (especially E2E) can erode trust in the gate — needs a flake-tracking/quarantine process from the start. |
| **Dependencies** | All prior sections' suites. |
| **Priority** | High. |
| **Automation Feasibility** | High — this is a re-execution strategy over existing automation, not new authoring. |
| **Execution Strategy** | Full suite nightly; risk-based subset (P1 tests only) on every PR for fast feedback, full suite required before release/tag. |
| **Test Data Strategy** | Same as underlying suites; regression runs should not share mutable state between specs (each spec creates/tears down its own data). |
| **Environment Requirements** | CI, matching production-like Node version. |
| **Entry Criteria** | Underlying suites individually stable (<5% flake rate). |
| **Exit Criteria** | Full regression suite green (or all failures triaged as known/accepted) before any release. |

### 6.7 Smoke Testing

| Attribute | Detail |
|---|---|
| **Scope** | Minimal "is it alive" check: `/api/health` returns 200, login succeeds, customer list loads, one account is viewable. |
| **Out of Scope** | Any negative-path or edge-case validation. |
| **Risks** | Low — by design this suite is small and shouldn't have complex risk surface. |
| **Dependencies** | App deployed/running in target environment. |
| **Priority** | High — this is the fastest signal and gates everything else. |
| **Automation Feasibility** | High — trivial to automate, should run in under a minute. |
| **Execution Strategy** | Runs first in every CI pipeline, and immediately after any deployment, before any other suite is allowed to start. |
| **Test Data Strategy** | Uses one fixed, always-present test account (or creates/discards one trivial customer). |
| **Environment Requirements** | Whatever environment was just deployed to. |
| **Entry Criteria** | Deployment/build completed. |
| **Exit Criteria** | 100% pass required to proceed to any other suite. |

### 6.8 Sanity Testing

| Attribute | Detail |
|---|---|
| **Scope** | Focused verification that a specific recent change works as intended and hasn't broken its immediate neighbors — e.g., after a change to the transfer endpoint, sanity-check create account, view accounts, and transfer, but not the entire regression pack. |
| **Out of Scope** | Full regression; unrelated feature areas. |
| **Risks** | Scope creep — sanity runs can balloon into de facto regression if not deliberately bounded. |
| **Dependencies** | Knowledge of what changed (PR diff / release notes). |
| **Priority** | Medium — used tactically, not as a release gate by itself. |
| **Automation Feasibility** | High — implemented as tag-selected subsets of existing API/UI suites (e.g., `--grep @transfer`). |
| **Execution Strategy** | Run on-demand by the developer/reviewer for a given PR, using Playwright's `--grep`/tag filtering against the affected feature area. |
| **Test Data Strategy** | Same as the underlying tagged tests. |
| **Environment Requirements** | Local or CI, developer's choice. |
| **Entry Criteria** | A change has been made and its affected area identified. |
| **Exit Criteria** | Tagged subset passes; broader regression still required before merge per §6.6. |

### 6.9 Accessibility Testing

| Attribute | Detail |
|---|---|
| **Scope** | Automated WCAG 2.1 AA checks (color contrast, form labeling, ARIA roles, keyboard focus order) on Login, Customer List, Customer Details, and all three modals (Add Customer/Add Account/Transfer Funds). |
| **Out of Scope** | Manual screen-reader (NVDA/VoiceOver) walkthroughs, full WCAG AAA — recommended as a periodic manual activity, not part of this automated plan. |
| **Risks** | No accessibility tooling currently wired into the project (`@axe-core/playwright` not installed) — this is net-new investment, not existing coverage. Modal focus-trapping was not verified during implementation and is a likely gap. |
| **Dependencies** | `@axe-core/playwright` added as a dev dependency. |
| **Priority** | Medium (no explicit compliance requirement stated in `Requirement.md` — raise as a question to the product owner if this is a hard requirement, e.g., for regulatory reasons common in banking). |
| **Automation Feasibility** | High for automated axe-core scans; Low for true assistive-technology behavior (manual only). |
| **Execution Strategy** | Inject an axe-core scan at the end of each existing UI spec's page-load step rather than authoring a fully separate suite; fail the build only on "serious"/"critical" violations initially, track "moderate"/"minor" as a backlog. |
| **Test Data Strategy** | N/A — accessibility scans operate on rendered DOM, not business data. |
| **Environment Requirements** | Same as UI Testing (§6.1). |
| **Entry Criteria** | Tooling installed; baseline scan run once to establish current violation count. |
| **Exit Criteria** | Zero new "critical"/"serious" axe violations introduced versus baseline. |

### 6.10 Security Testing

| Attribute | Detail |
|---|---|
| **Scope** | Functional security checks automatable today: unauthenticated access to protected endpoints is rejected (401), expired/malformed JWT rejected (403), SQL-injection-style payloads in search/customer fields don't break parameterized queries, password is never returned in any API response, bcrypt hash format stored (not plaintext) verified via direct DB check. |
| **Out of Scope** | Full penetration testing, SAST/dependency-vulnerability scanning, and the deeper architectural risks already flagged in `Requirement.md` (hardcoded `JWT_SECRET` fallback, open CORS, no RBAC) — these are **fix-first** items, not test-automation items; they should be remediated, then verified by tests, not merely tested against as-is. |
| **Risks** | `Requirement.md` R-1 (hardcoded JWT secret fallback) and R-3 (open CORS) mean the app is **not currently production-safe**; security tests here validate the *application logic* (auth gate works), not that the *deployment* is hardened. |
| **Dependencies** | Backend running; a way to mint expired/invalid tokens for negative tests (can sign a token with a wrong secret locally). |
| **Priority** | High for the functional auth-gate checks; the deeper hardening items are Critical but tracked as defects/backlog, not test-plan line items. |
| **Automation Feasibility** | High for the functional checks listed in Scope; Low/manual for penetration testing (requires a dedicated engagement or tool like OWASP ZAP). |
| **Execution Strategy** | Functional security specs run as part of the API suite (§6.2), tagged `@security`; recommend adding an OWASP ZAP baseline scan as a separate, occasional CI job (not on every PR, given runtime cost). |
| **Test Data Strategy** | Deliberately malformed/malicious payloads (SQLi strings, oversized inputs, tampered JWTs) as a fixed fixture set. |
| **Environment Requirements** | Backend only; ZAP scan (if adopted) needs the full app running in a disposable environment. |
| **Entry Criteria** | Functional security specs authored and reviewed. |
| **Exit Criteria** | All functional auth-gate/negative-path checks pass; R-1 and R-3 from `Requirement.md` have an accepted remediation plan (even if not yet implemented) before production go-live. |

### 6.11 Performance Smoke Testing

| Attribute | Detail |
|---|---|
| **Scope** | Lightweight response-time sanity checks on the hottest endpoints: `/customers` (list), `/customers/search`, `/accounts/transfer` — assert each responds within an agreed threshold (e.g., <500ms) under a small concurrent load (e.g., 10 virtual users, 30 seconds), against the seeded dataset (~151 customers / ~452 accounts / ~150 transactions per `banking-app/README.md`). |
| **Out of Scope** | Full load/stress/soak testing, capacity planning, production-scale data volumes — no NFR targets for these exist yet (`Requirement.md` §11), so this plan only covers a smoke-level check, not a certified performance benchmark. |
| **Risks** | Without stated NFR thresholds, "pass/fail" numbers here are provisional and must be confirmed with the product owner (tie back to `Requirement.md` open questions). |
| **Dependencies** | A performance tool (`k6` or `autocannon`) added as a new dev dependency; a running backend with representative seed data volume. |
| **Priority** | Low/Medium until real NFRs are defined; escalate to High if the app is expected to handle meaningful production traffic soon. |
| **Automation Feasibility** | High to script; Medium confidence in results without agreed thresholds. |
| **Execution Strategy** | Run as a separate, infrequent CI job (e.g., weekly or pre-release), not on every PR, to avoid noisy/slow pipelines. |
| **Test Data Strategy** | Use the existing seeded `banking.db` volume as a realistic-enough baseline; avoid running against a nearly-empty DB, which would understate query costs. |
| **Environment Requirements** | Isolated environment (not shared/noisy CI runners) for repeatable timing results. |
| **Entry Criteria** | Provisional thresholds agreed with stakeholders. |
| **Exit Criteria** | All measured endpoints within agreed threshold; regressions beyond an agreed % tracked as defects. |

### 6.12 Cross-Browser Testing

| Attribute | Detail |
|---|---|
| **Scope** | All P1 UI/E2E flows (§6.1, §6.5) executed on Chromium, Firefox, and WebKit — already configured as separate projects in `playwright.config.ts`. |
| **Out of Scope** | Legacy browsers (IE11, old Edge) — not configured and not a stated requirement. |
| **Risks** | WebKit/Firefox-specific rendering or timing differences (e.g., modal focus, date input widgets) may surface flakiness not seen on Chromium. |
| **Dependencies** | `npx playwright install --with-deps` for all three engines. |
| **Priority** | Medium — Chromium as primary gate, Firefox/WebKit as broader confidence pass. |
| **Automation Feasibility** | High — no additional authoring needed beyond running existing specs against all three configured projects. |
| **Execution Strategy** | Chromium runs on every PR (fast feedback); full 3-browser matrix runs nightly or pre-release. |
| **Test Data Strategy** | Same as UI Testing (§6.1); each browser project runs independently against its own created test data. |
| **Environment Requirements** | CI runner with all three browser binaries installed (`--with-deps`). |
| **Entry Criteria** | Chromium pass achieved first. |
| **Exit Criteria** | All P1 flows pass on all three browsers before release; browser-specific failures triaged and either fixed or explicitly waived. |

### 6.13 Responsive Testing

| Attribute | Detail |
|---|---|
| **Scope** | Verify layout and usability at the mobile breakpoint already defined in CSS (`@media max-width: 768px`) across Customer List, Customer Details, and all modals — table layouts, form stacking, button accessibility at small viewport widths. |
| **Out of Scope** | Native mobile app testing (there is no native app — this is a responsive web UI only); tablet-specific breakpoints (none defined in CSS beyond the single 768px rule). |
| **Risks** | Only one breakpoint exists in the codebase — anything between breakpoints is untested by design; modals with `max-height: 90vh` + internal scroll need explicit verification on short viewports. |
| **Dependencies** | Playwright's `page.setViewportSize()` / device emulation. |
| **Priority** | Medium. |
| **Automation Feasibility** | High — Playwright supports arbitrary viewport sizes and device presets natively. |
| **Execution Strategy** | Re-run a subset of P1 UI specs at a mobile viewport (e.g., 375×667) alongside the default desktop viewport, tagged `@responsive`. |
| **Test Data Strategy** | Same as UI Testing (§6.1). |
| **Environment Requirements** | Same as UI Testing; no additional infrastructure. |
| **Entry Criteria** | Desktop-viewport UI suite passing. |
| **Exit Criteria** | No layout-breaking defects (overlapping/clipped/unreachable controls) at the mobile breakpoint for P1 flows. |

### 6.14 Localization Testing

| Attribute | Detail |
|---|---|
| **Scope** | **Currently limited** — the application has no i18n framework; all UI strings are hardcoded English literals (e.g., `"Login"`, `"Add Customer"`, `"Transfer Funds"`) and there is no locale-switching mechanism. Realistic scope today is limited to: verifying date fields (`dateOfBirth`, transaction dates) and currency displays render sensibly for the browser's default locale, and that non-ASCII input (customer names, addresses) is accepted/stored/displayed correctly (UTF-8 round-trip). |
| **Out of Scope** | Full multi-locale UI translation testing, RTL layout testing — not applicable until an i18n framework is adopted. |
| **Risks** | Because there's no i18n layer, any future localization work is a **feature gap**, not a test gap — flag this explicitly to the product owner (ties to `Requirement.md` §11 Missing Information) rather than treating it as a testing deficiency. |
| **Dependencies** | None beyond existing UI/API suites. |
| **Priority** | Low, given no stated localization requirement. |
| **Automation Feasibility** | High for the limited UTF-8/date-format checks in scope; N/A for full localization until the feature exists. |
| **Execution Strategy** | Add a handful of specs to the existing Add Customer / API suites using non-ASCII names/addresses and confirm correct round-trip through UI → API → DB → UI. |
| **Test Data Strategy** | Non-ASCII test fixtures (e.g., accented characters, non-Latin scripts) for name/address fields. |
| **Environment Requirements** | Same as UI/API Testing. |
| **Entry Criteria** | None additional. |
| **Exit Criteria** | Non-ASCII data survives a full UI→API→DB→UI round trip without corruption or display errors. |

---

## 7. Traceability to `Requirement.md`

| Requirement.md Item | Addressed In |
|---|---|
| R-1 (hardcoded JWT secret) | §6.10 Security Testing |
| R-2 (no RBAC) | §6.10 Security Testing (flagged as design gap, not test item) |
| R-3 (open CORS) | §6.10 Security Testing |
| R-4 (no transaction atomicity on transfer) | §6.4 Integration Testing (concurrency probe) |
| R-5 (no idempotency on transfer) | §6.2 API Testing (recommend adding a negative test once product decides on desired behavior) |
| R-6 (no cascade-delete for customers) | §6.3 Database Testing |
| R-7 (account number collision risk) | §6.3 Database Testing (documented, low priority given probability) |
| R-8 (floating-point money) | §6.3 Database Testing (documented; precision assertions use tolerant comparison) |
| R-9 (no server-side enum validation) | §6.2 API Testing |
| R-11 (JWT not revocable) | §6.10 Security Testing |
| R-12 (thin current coverage) | This entire plan |
| Q1–Q10 (product owner questions) | Referenced inline where relevant (§6.4, §6.10, §6.11); must be resolved before those sections' exit criteria can be finalized. |

---

## 8. Assumptions

- The product owner will answer or explicitly defer the open questions in `Requirement.md` §12 before high-priority suites are finalized as release gates.
- CI will be updated to boot the backend and frontend before UI/API/E2E suites run (currently a gap).
- A dedicated, disposable test database/environment will be available for CI so tests don't mutate developers' local seed data.
- No production deployment will occur before R-1 (hardcoded JWT secret) and R-3 (open CORS) are remediated or formally risk-accepted.

---

## 9. Open Items Before Full Execution

1. Confirm pass/fail thresholds for Performance Smoke (§6.11) with stakeholders.
2. Decide whether Accessibility (§6.9) is a hard compliance requirement (common in banking) or best-effort.
3. Add missing tooling: `@axe-core/playwright`, a performance tool (`k6`/`autocannon`), and optionally OWASP ZAP for periodic scans.
4. Update `.github/workflows/playwright.yml` to start `banking-app/backend` and `banking-app/frontend` before running suites that need them.
5. Resolve `Requirement.md` §12 questions that block Integration (§6.4) and Security (§6.10) exit criteria.

---

*This plan defines strategy only. Test case authoring begins after this plan is reviewed/approved.*
