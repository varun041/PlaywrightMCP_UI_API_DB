# Test Scenarios — Banking Customer Management System

**Based on:** `AutomationTestPlan.md` (approved) and `Requirement.md`
**Modules referenced:** `Auth`, `Customer`, `Account`, `Transfer`, `Search/Pagination`, `DB`, `UI`, `Cross-Cutting`
**Status:** Scenario-level only — no Gherkin/step-level test cases yet, per instruction.

Legend:
- **Priority** — business importance of covering this scenario: `P1` (High) / `P2` (Medium) / `P3` (Low)
- **Severity** — impact if this scenario reveals a defect: `Critical` / `High` / `Medium` / `Low`
- **Automation Candidate** — `Yes` (fully automatable now) / `Partial` (automatable with new tooling) / `Manual` (not practically automatable)
- **Risk** — cross-reference to `Requirement.md` §10 risk IDs (R-1…R-12) where applicable, else `—`

---

## 1. Positive (Happy Path) Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| POS-01 | Register a new user with valid username/password/email | Auth | P1 | High | Yes | — | 201 Created; JWT + userId returned |
| POS-02 | Log in with valid credentials | Auth | P1 | High | Yes | — | 200 OK; JWT + userId returned |
| POS-03 | List customers with default pagination | Customer | P1 | Medium | Yes | — | 200 OK; array of customers + total count |
| POS-04 | Search customers by name (default filter) | Customer | P2 | Medium | Yes | — | Matching customers returned |
| POS-05 | Search customers filtered by email | Customer | P2 | Medium | Yes | — | Only email-matching customers returned |
| POS-06 | Search customers filtered by phone | Customer | P2 | Medium | Yes | — | Only phone-matching customers returned |
| POS-07 | View a single customer's details | Customer | P1 | Medium | Yes | — | 200 OK; full customer profile returned |
| POS-08 | Create a customer with full address details | Customer | P1 | High | Yes | — | 201 Created; customer persisted with address fields |
| POS-09 | Create a customer with only required fields (firstName, lastName, email) | Customer | P1 | High | Yes | — | 201 Created; optional fields null/empty |
| POS-10 | Update an existing customer's profile | Customer | P2 | Medium | Yes | — | 200 OK; fields updated in DB |
| POS-11 | Delete a customer | Customer | P2 | Medium | Yes | — | 200 OK; customer no longer retrievable |
| POS-12 | Create a CHECKING account for a customer | Account | P1 | High | Yes | — | 201 Created; account with auto-generated ID/number, status ACTIVE |
| POS-13 | Create a SAVINGS/BUSINESS/CREDIT account for a customer | Account | P1 | High | Yes | — | 201 Created for each account type |
| POS-14 | View all accounts for a customer | Account | P1 | Medium | Yes | — | 200 OK; accounts array returned |
| POS-15 | View all transactions across a customer's accounts | Account | P2 | Medium | Yes | — | 200 OK; transactions array returned |
| POS-16 | Delete an account that has no transactions | Account | P1 | High | Yes | — | 200 OK; account removed |
| POS-17 | Delete an account that has existing transactions | Account | P1 | High | Yes | — | 200 OK; account and its transactions removed (cascade) |
| POS-18 | Transfer funds between two active accounts with sufficient balance | Transfer | P1 | Critical | Yes | — | 201 Created; both balances updated correctly; two linked TRANSFER transactions created |
| POS-19 | View updated balances/transactions in UI immediately after a transfer | Transfer / UI | P1 | High | Yes | — | UI reflects new balances and new transaction rows without manual refresh issues |
| POS-20 | Log out via UI | Auth / UI | P2 | Low | Yes | — | Token cleared from localStorage; user redirected to login |
| POS-21 | `GET /api/health` | Cross-Cutting | P1 | Low | Yes | — | 200 OK; status message |
| POS-22 | `GET /api/routes` | Cross-Cutting | P3 | Low | Yes | — | 200 OK; list of registered routes |

---

## 2. Negative Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| NEG-01 | Register with a username that already exists | Auth | P1 | Medium | Yes | — | 409 Conflict; no duplicate user created |
| NEG-02 | Register with missing username/password/email | Auth | P1 | Medium | Yes | — | 400 Bad Request |
| NEG-03 | Log in with wrong password | Auth | P1 | High | Yes | — | 401 Unauthorized |
| NEG-04 | Log in with non-existent username | Auth | P1 | Medium | Yes | — | 401 Unauthorized |
| NEG-05 | Log in with missing username or password | Auth | P2 | Low | Yes | — | 400 Bad Request |
| NEG-06 | Call any protected endpoint with no `Authorization` header | Auth | P1 | Critical | Yes | — | 401 Unauthorized |
| NEG-07 | Call any protected endpoint with a malformed/garbage token | Auth | P1 | Critical | Yes | — | 403 Forbidden |
| NEG-08 | Create a customer missing firstName/lastName/email | Customer | P1 | Medium | Yes | — | 400 Bad Request |
| NEG-09 | Get a customer by a non-existent ID | Customer | P1 | Medium | Yes | — | 404 Not Found |
| NEG-10 | Update a customer by a non-existent ID | Customer | P2 | Low | Yes | R-9 (no existence check documented) | Currently returns success with 0 rows changed — **document actual vs. expected behavior** |
| NEG-11 | Delete a customer by a non-existent ID | Customer | P2 | Low | Yes | — | Currently returns success message regardless — **document actual behavior** |
| NEG-12 | Create an account for a non-existent customer ID | Account | P1 | Medium | Yes | — | 404 Not Found |
| NEG-13 | Create an account with missing `accountType` | Account | P1 | Medium | Yes | — | 400 Bad Request |
| NEG-14 | Delete a non-existent account | Account | P1 | Medium | Yes | — | 404 Not Found |
| NEG-15 | Transfer with missing `fromAccountId`/`toAccountNumber`/`amount` | Transfer | P1 | High | Yes | — | 400 Bad Request |
| NEG-16 | Transfer from a non-existent account ID | Transfer | P1 | High | Yes | — | 404 Not Found |
| NEG-17 | Transfer to a non-existent destination account number | Transfer | P1 | High | Yes | — | 404 Not Found |
| NEG-18 | Transfer where source and destination are the same account | Transfer | P1 | High | Yes | — | 400 Bad Request ("Cannot transfer to the same account") |
| NEG-19 | Transfer amount greater than source account balance | Transfer | P1 | Critical | Yes | — | 400 Bad Request ("Insufficient funds"); no balance change |
| NEG-20 | Transfer where either account status is `INACTIVE` | Transfer | P1 | Critical | Yes | — | 400 Bad Request ("Both accounts must be active") |
| NEG-21 | Transfer with a zero or negative amount | Transfer | P1 | High | Yes | — | 400 Bad Request |
| NEG-22 | Search customers with no `query` param | Customer | P2 | Low | Yes | — | 400 Bad Request ("Search query required") |

---

## 3. Boundary Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| BND-01 | List customers with `limit=0` | Customer | P3 | Low | Yes | — | Document actual behavior (falls back to default 10 due to `parseInt(0) || 10` truthiness bug) |
| BND-02 | List customers with `limit=1` | Customer | P2 | Low | Yes | — | Exactly 1 customer returned |
| BND-03 | List customers with a very large `limit` (e.g., 10000) | Customer | P2 | Medium | Yes | R-10 | All matching rows returned; no server error; response-time noted for §Performance |
| BND-04 | List customers with `offset` beyond total record count | Customer | P2 | Low | Yes | — | Empty array returned, no error |
| BND-05 | Transfer amount exactly equal to source balance | Transfer | P1 | High | Yes | — | Succeeds; source balance becomes exactly 0 |
| BND-06 | Transfer amount equal to source balance + 0.01 | Transfer | P1 | High | Yes | — | Rejected as insufficient funds |
| BND-07 | Transfer amount with more than 2 decimal places (e.g., 10.005) | Transfer | P2 | Medium | Yes | R-8 | Document rounding/precision behavior against `REAL` storage |
| BND-08 | Transfer minimum positive amount (0.01) | Transfer | P2 | Medium | Yes | — | Succeeds; balances adjusted by exactly 0.01 |
| BND-09 | Create account with `balance` omitted (defaults to 0) | Account | P2 | Low | Yes | — | Account created with balance 0 |
| BND-10 | Create account with a negative initial `balance` | Account | P2 | Medium | Yes | R-9 | Currently accepted (no validation) — document as gap, not defect, pending product decision |
| BND-11 | Search with a 1-character query | Customer | P3 | Low | Yes | — | Broad match results returned, no error |
| BND-12 | Search query containing SQL wildcard characters (`%`, `_`) | Customer | P2 | Medium | Yes | — | Treated as literal characters in `LIKE`, no unexpected matches/errors |
| BND-13 | Create customer with empty-string optional fields (phone, address parts) | Customer | P3 | Low | Yes | — | Accepted; stored as empty/null consistently |
| BND-14 | Customer email at an unusually long length (e.g., 254 chars) | Customer | P3 | Low | Yes | — | Document actual behavior — no length validation present |

---

## 4. Validation Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| VAL-01 | Create customer with an invalid email format (e.g., `not-an-email`) | Customer | P1 | Medium | Yes | R-9 | Currently accepted (no format check) — document as validation gap |
| VAL-02 | Create customer with non-numeric/garbage `phone` value | Customer | P3 | Low | Yes | R-9 | Accepted as free text — document as expected (no format enforced) |
| VAL-03 | Create customer with an invalid `dateOfBirth` (e.g., `"not-a-date"`) | Customer | P2 | Medium | Yes | R-9 | Stored as-is (TEXT column, no date validation) — document gap |
| VAL-04 | Create account with an `accountType` outside the UI's enum (e.g., `"FOO"`) | Account | P1 | Medium | Yes | R-9, BR-2 | Currently accepted by API (only UI `<select>` restricts) — confirms documented gap |
| VAL-05 | Create account with an unsupported `currency` code | Account | P2 | Medium | Yes | R-9 | Currently accepted — document gap |
| VAL-06 | Transfer with `amount` sent as a non-numeric string | Transfer | P1 | High | Yes | — | Rejected — `parseFloat` yields `NaN`, falsy check triggers 400 |
| VAL-07 | POST request with missing `Content-Type: application/json` header | Cross-Cutting | P3 | Low | Yes | — | Document actual Express/body-parser behavior (likely 400 or empty body) |
| VAL-08 | POST request with malformed JSON body | Cross-Cutting | P2 | Medium | Yes | — | 400 Bad Request from body-parser, not a 500 |

---

## 5. Business Rule Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| BR-01 | New account always created with status `ACTIVE` | Account | P1 | Medium | Yes | BR-3 | Status field is `ACTIVE` regardless of input |
| BR-02 | Deleting an account also deletes its transactions | Account / DB | P1 | High | Yes | BR-11 | Zero orphaned transaction rows post-delete |
| BR-03 | Deleting a customer does **not** cascade-delete their accounts/transactions | Customer / DB | P1 | High | Yes | R-6, BR-11 | Accounts/transactions remain in DB after customer deletion — confirms known gap |
| BR-04 | Transfer requires both accounts to be `ACTIVE` | Transfer | P1 | Critical | Yes | BR-4 | Rejected if either account is `INACTIVE` |
| BR-05 | Transfer requires sufficient source balance | Transfer | P1 | Critical | Yes | BR-5 | Rejected if balance insufficient |
| BR-06 | Transfer cannot target the same account | Transfer | P1 | High | Yes | BR-6 | Rejected with explicit error |
| BR-07 | A completed transfer writes two `TRANSFER` transactions sharing one `reference` | Transfer / DB | P1 | Critical | Yes | BR-8 | Both transaction rows present, linked by identical `reference` value |
| BR-08 | JWT issued at login expires after 24 hours | Auth | P2 | Medium | Partial (requires time manipulation/mocking) | BR-10 | Requests with an expired token rejected with 403 |
| BR-09 | Account number is a system-generated 10-digit numeric string | Account | P2 | Low | Yes | BR-12 | Generated `accountNumber` matches expected format |
| BR-10 | `CREDIT` account type permitted to go negative via transfer/debit | Account | P2 | Medium | Yes | BR-13 | Confirms no credit-limit enforcement exists (documented gap, not defect until product defines rule) |

---

## 6. Authorization Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| AUTHZ-01 | User A's valid token used to view User B's created customer | Customer | P1 | Critical | Yes | R-2 | Currently succeeds — confirms no ownership/tenancy model (documented gap, escalate to product owner) |
| AUTHZ-02 | User A's token used to delete a customer/account created under a different user's session | Customer / Account | P1 | Critical | Yes | R-2 | Currently succeeds — same as above |
| AUTHZ-03 | Any authenticated user can call `/accounts/transfer` regardless of who "owns" the accounts | Transfer | P1 | Critical | Yes | R-2 | Currently succeeds — no role/ownership check exists |
| AUTHZ-04 | Any authenticated user can call destructive endpoints (delete customer/account) with no elevated-role requirement | Cross-Cutting | P1 | Critical | Yes | R-2 | Confirms flat permission model; recommend RBAC before production |

---

## 7. Authentication Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| AUTHN-01 | Valid login issues a well-formed JWT | Auth | P1 | Critical | Yes | — | Token decodes with expected `userId` claim and future `exp` |
| AUTHN-02 | Token signed with a different/incorrect secret is rejected | Auth | P1 | Critical | Yes | R-1 | 403 Forbidden |
| AUTHN-03 | Expired JWT is rejected | Auth | P1 | Critical | Partial (needs clock/token mocking) | — | 403 Forbidden |
| AUTHN-04 | Token sent without the `Bearer ` prefix is rejected | Auth | P2 | Medium | Yes | — | 401/403 as appropriate |
| AUTHN-05 | Token sent in a non-standard header is ignored/rejected | Auth | P3 | Low | Yes | — | 401 Unauthorized |
| AUTHN-06 | Application falls back to the hardcoded default `JWT_SECRET` when env var is unset | Auth | P1 | Critical | Yes | R-1 | Confirms critical secret-management gap — must be flagged, not silently accepted |
| AUTHN-07 | Multiple concurrent valid logins for the same user produce independent valid tokens | Auth | P3 | Low | Yes | — | Both tokens independently authorize requests (expected — stateless JWT) |

---

## 8. Session Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| SESS-01 | "Logout" clears client-side token/userId from `localStorage` | Auth / UI | P2 | Medium | Yes | — | Subsequent UI state shows login screen |
| SESS-02 | A token captured before "logout" remains valid against the API after UI logout | Auth | P1 | High | Yes | R-11 | Token still authorizes API calls — confirms no server-side revocation (documented gap) |
| SESS-03 | Refreshing the browser page preserves the logged-in state via `localStorage` token | UI | P2 | Low | Yes | — | User remains logged in after refresh |
| SESS-04 | Two browser tabs share the same `localStorage` session | UI | P3 | Low | Manual (multi-tab orchestration) | — | Both tabs behave as logged-in simultaneously |
| SESS-05 | API returns 401/403 mid-session (e.g., token expired) — UI handling | UI | P2 | Medium | Partial | — | Document actual UI behavior; recommend graceful redirect-to-login if missing |

---

## 9. Error Handling Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| ERR-01 | All API errors return a consistent `{ error: string }` JSON shape | Cross-Cutting | P1 | Medium | Yes | — | Verified across all endpoints' error responses |
| ERR-02 | Unhandled server exception (e.g., simulated DB failure) is caught by the global error handler | Cross-Cutting | P1 | High | Partial (needs DB fault injection) | — | 500 response with `err.message`, not an unhandled crash |
| ERR-03 | Error responses do not leak stack traces to the client | Cross-Cutting | P1 | High | Yes | — | Response body contains only `error` message field, no stack trace |
| ERR-04 | UI surfaces the API's `error` field as a user-facing message on failed actions | UI | P1 | Medium | Yes | — | Error banner/text shown matches API error message |
| ERR-05 | UI handles complete API unavailability (connection refused) gracefully | UI | P2 | Medium | Partial (requires network fault injection) | — | UI shows a generic failure state, not a blank/crashed screen |
| ERR-06 | Malformed JSON body handled without a 500 | Cross-Cutting | P2 | Medium | Yes | — | 400-level response |

---

## 10. Integration Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| INT-01 | Newly added account appears in Customer Details UI and in `GET /accounts` and in DB, all consistent | Account | P1 | High | Yes | — | All three views agree |
| INT-02 | Transfer updates both accounts' balances consistently across API response, DB rows, and UI display | Transfer | P1 | Critical | Yes | — | All three views agree |
| INT-03 | Deleted account no longer appears via API, UI, or DB query; its transactions are also gone from all three | Account | P1 | High | Yes | BR-2 | Consistent absence across layers |
| INT-04 | Transaction pair created by a transfer shares one `reference` value verifiable via direct DB query | Transfer / DB | P1 | High | Yes | — | DB query confirms linkage |
| INT-05 | Deleting a customer leaves their accounts/transactions retrievable via `GET /accounts` even though the customer itself 404s | Customer / DB | P2 | High | Yes | R-6 | Confirms orphaned-data risk end-to-end |

---

## 11. Concurrency Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| CONC-01 | Two simultaneous transfers from the same account, each individually valid, but combined exceeding the balance | Transfer | P1 | Critical | Partial (needs precise timing harness) | R-4 | **Expected to currently fail-unsafe** (both may succeed, overdrawing the account) — discovery test, not a hard gate until remediated |
| CONC-02 | Two simultaneous "create account" requests for the same customer | Account | P2 | Medium | Yes | R-7 | Both succeed with distinct IDs; check for any account-number collision |
| CONC-03 | A transfer targeting an account that is being deleted at the same moment | Transfer / Account | P2 | High | Partial | — | Document actual race outcome (likely inconsistent state — a defect candidate) |
| CONC-04 | High-volume concurrent reads (`list`/`search`) do not block a concurrent write (`transfer`) | Cross-Cutting | P3 | Medium | Partial | — | Reads and writes both complete without SQLite lock errors surfacing as user-facing failures |

---

## 12. Retry Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| RETRY-01 | Client retries a `POST /accounts/transfer` after a timeout, without the first request having actually failed | Transfer | P1 | Critical | Yes | R-5 | **Expected defect**: funds are transferred twice — no idempotency key exists |
| RETRY-02 | Client retries `POST /customers` with identical payload after a timeout | Customer | P2 | Medium | Yes | — | Two distinct customer records created (no uniqueness beyond ID) |
| RETRY-03 | Client retries `POST /customers/:id/accounts` after a timeout | Account | P2 | Medium | Yes | — | Two distinct accounts created |
| RETRY-04 | Client retries `POST /auth/login` after a network blip | Auth | P3 | Low | Yes | — | Safe — login is naturally idempotent (no side effect beyond issuing a new token) |

---

## 13. Recovery Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| RECOV-01 | Backend process is killed between the two balance-update statements of a transfer | Transfer / DB | P1 | Critical | Manual (requires fault injection at process level) | R-4 | **Expected defect**: source debited without destination credited (or vice versa) — no transaction wrapping |
| RECOV-02 | Backend restarts after a crash; previously persisted data is intact | Cross-Cutting / DB | P1 | High | Partial | — | SQLite file persists all prior commits; app reconnects cleanly |
| RECOV-03 | Frontend recovers/reconnects gracefully after the backend restarts mid-session | UI | P2 | Medium | Manual | — | Next user action either succeeds or shows a clear retry-able error, not a silent hang |
| RECOV-04 | Concurrent writes triggering SQLite `SQLITE_BUSY`/lock contention are surfaced as a handled error, not a crash | Cross-Cutting / DB | P2 | Medium | Partial | — | Backend returns a 500 with message, process stays alive |

---

## 14. Accessibility Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| A11Y-01 | Automated axe-core scan of Login/Register form | UI | P2 | Medium | Partial (tooling not yet installed) | — | No critical/serious violations |
| A11Y-02 | Automated axe-core scan of Customer List and Customer Details screens | UI | P2 | Medium | Partial | — | No critical/serious violations |
| A11Y-03 | Automated axe-core scan of Add Customer / Add Account / Transfer Funds modals | UI | P2 | Medium | Partial | — | No critical/serious violations; check for focus trapping |
| A11Y-04 | Keyboard-only navigation through a full "add customer → add account → transfer" flow | UI | P2 | Medium | Manual | — | All interactive elements reachable and operable via keyboard alone |
| A11Y-05 | Screen reader announces form validation/error messages | UI | P3 | Medium | Manual | — | Document current gap — errors render as plain `<div>`s with no `aria-live` |
| A11Y-06 | Color contrast of error banners and buttons meets WCAG AA | UI | P3 | Low | Partial (axe-core contrast rule) | — | Passes automated contrast check |
| A11Y-07 | Native `window.confirm()` delete-confirmation dialog is operable via keyboard/screen reader | UI | P3 | Low | Manual | — | Browser-native dialog is inherently accessible; confirm no custom override breaks this |

---

## 15. Security Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| SEC-01 | SQL-injection-style payload in customer search query (`' OR '1'='1`) | Customer | P1 | Critical | Yes | — | No injection possible — parameterized queries confirmed safe |
| SEC-02 | SQL-injection-style payload in customer creation fields | Customer | P1 | Critical | Yes | — | Stored literally, no query manipulation |
| SEC-03 | XSS payload (`<script>...</script>`) in customer name/address rendered in UI | UI | P1 | High | Yes | — | React auto-escapes; no script execution |
| SEC-04 | Password is never present in any API response body (register, login, get user) | Auth | P1 | Critical | Yes | — | Confirmed absent from all payloads |
| SEC-05 | Stored password is a bcrypt hash, not plaintext, verified via direct DB query | Auth / DB | P1 | Critical | Yes | — | DB value matches bcrypt hash format |
| SEC-06 | Repeated rapid failed login attempts against one username | Auth | P2 | High | Yes | — | **Expected gap**: no rate limiting/lockout currently implemented |
| SEC-07 | CORS policy accepts requests from an arbitrary origin | Cross-Cutting | P1 | High | Yes | R-3 | Confirms open CORS — flag as pre-production hardening item |
| SEC-08 | Direct object reference — access/modify a customer/account by guessing/incrementing IDs with any valid token | Cross-Cutting | P1 | Critical | Yes | R-2 | Confirms IDOR exposure due to no ownership model |
| SEC-09 | Tampered JWT payload (e.g., altered `userId`) with original signature is rejected | Auth | P1 | Critical | Yes | R-1 | Signature validation fails; 403 |
| SEC-10 | `.env`/`JWT_SECRET` absence falls back to a publicly-known default string in source code | Auth | P1 | Critical | Yes | R-1 | Confirms critical misconfiguration risk if deployed without setting the env var |

---

## 16. Performance Smoke Scenarios

| ID | Scenario | Module | Priority | Severity | Automation Candidate | Risk | Expected Outcome |
|---|---|---|---|---|---|---|---|
| PERF-01 | `GET /customers` response time against seeded volume (~151 customers) | Customer | P2 | Medium | Partial (tooling not yet installed) | — | Response within provisional threshold (e.g., <500ms) |
| PERF-02 | `GET /customers/search` response time with a broad query | Customer | P2 | Medium | Partial | — | Response within provisional threshold |
| PERF-03 | `POST /accounts/transfer` response time under light concurrent load (~10 VUs) | Transfer | P2 | Medium | Partial | — | Response within provisional threshold; no errors under light load |
| PERF-04 | `GET /customers` with a very large `limit` value under load | Customer | P3 | Low | Partial | R-10 | Response time degradation measured and documented, not assumed |
| PERF-05 | Baseline smoke run against an idle vs. seeded database, to confirm seed volume is representative | Cross-Cutting | P3 | Low | Partial | — | Timing difference documented to validate test data realism |

---

## Summary Counts

| Category | # Scenarios |
|---|---|
| Positive | 22 |
| Negative | 22 |
| Boundary | 14 |
| Validation | 8 |
| Business Rule | 10 |
| Authorization | 4 |
| Authentication | 7 |
| Session | 5 |
| Error Handling | 6 |
| Integration | 5 |
| Concurrency | 4 |
| Retry | 4 |
| Recovery | 4 |
| Accessibility | 7 |
| Security | 10 |
| Performance Smoke | 5 |
| **Total** | **137** |

---

*No Gherkin/step-level test cases have been authored — this is scenario inventory only, per instruction. Awaiting review before proceeding to detailed test case / Gherkin authoring.*
