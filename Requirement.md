# Requirements Analysis — Banking Customer Management System

Source: `README.md`, `banking-app/README.md`, and the current implementation (`banking-app/backend/`, `banking-app/frontend/`) as of this analysis. Where the README is silent, requirements below are inferred from actual code behavior and are marked accordingly.

---

## 1. Business Summary

The system is a **Banking Customer Management application** used by bank staff to maintain customer records, the deposit/credit accounts each customer holds, and the transactions against those accounts, including moving funds between accounts. It is a back-office tool (there is no customer self-service login) exposed as a REST API (Node/Express + SQLite) with a React SPA front end, secured by JWT authentication.

Alongside the application, the repository also hosts a **Playwright + TypeScript test automation framework** intended to validate the system across UI, API, and DB layers, currently in early/scaffold stage (one DB-layer check, placeholder UI checks, no API-layer checks yet).

This document analyzes the **application's** requirements; the automation framework's own requirements are out of scope here except where they constrain testability (see Non-Functional Requirements and Risks).

---

## 2. Functional Requirements

### 2.1 Authentication
- FR-1: A user can register with `username`, `password`, `email`. Username must be unique.
- FR-2: A user can log in with `username` + `password`, receiving a JWT valid for 24 hours.
- FR-3: All API endpoints except `/auth/register` and `/auth/login` require a valid `Authorization: Bearer <token>` header.
- FR-4: There is no logout/token-revocation endpoint; the frontend "logout" only clears client-side `localStorage`.

### 2.2 Customer Management
- FR-5: Create a customer with required `firstName`, `lastName`, `email`, and optional `phone`, `dateOfBirth`, `address` (street/city/state/zipCode/country).
- FR-6: List customers with pagination (`limit`, `offset`).
- FR-7: Search customers by name/email (default) or restrict to `email` or `phone` via a `filter` param.
- FR-8: View a single customer's full profile.
- FR-9: Update a customer's profile fields.
- FR-10: Delete a customer by ID.

### 2.3 Account Management
- FR-11: Add a new account to an existing customer, specifying `accountType` (`CHECKING`/`SAVINGS`/`BUSINESS`/`CREDIT`), optional starting `balance` (defaults 0) and `currency` (defaults `USD`). The system auto-generates the account ID and a 10-digit account number, and sets status `ACTIVE`.
- FR-12: View all accounts belonging to a customer.
- FR-13: Delete an account by ID; deleting an account also deletes all of its transactions.

### 2.4 Transactions & Transfers
- FR-14: View all transactions across all of a customer's accounts.
- FR-15: Transfer funds from one account (`fromAccountId`) to another account identified by `toAccountNumber`, with an `amount` and optional `description`.
- FR-16: A successful transfer debits the source account and credits the destination account, and writes one `TRANSFER` transaction row per side, linked by a shared `reference`.

### 2.5 UI
- FR-17: Login/registration screen (toggle between the two modes).
- FR-18: Customer list screen with search, pagination, "Add Customer" entry point.
- FR-19: Customer details screen showing profile, accounts table, transactions table.
- FR-20: "Add Account" modal, launched from the customer details screen.
- FR-21: Per-account "Transfer" and "Delete" actions on the accounts table.
- FR-22: "Edit Customer" action from the details screen (UI wiring present; confirm end-to-end save behavior — see Missing Information).

---

## 3. Non-Functional Requirements

- NFR-1 (Security): Passwords are hashed with bcrypt before storage; never stored/returned in plaintext.
- NFR-2 (Security): Access control is via stateless JWT; no session store.
- NFR-3 (Portability): Data layer is a single-file SQLite database — no external DB server dependency.
- NFR-4 (Usability): UI provides loading and error states for all async operations.
- NFR-5 (Responsiveness): UI has mobile breakpoints (`@media max-width: 768px`) across all components.
- NFR-6 (Testability): The system exposes a `/api/routes` introspection endpoint and a `/api/health` liveness endpoint to support automated verification.
- NFR-7 (Maintainability): Backend routes are modularized by resource (`auth`, `customers`, `accounts`).
- NFR-8 (CI): Automated tests run in GitHub Actions on push/PR to `main`/`master`.

*(Performance, availability, and scalability targets are not specified anywhere — see Missing Information.)*

---

## 4. Business Rules

- BR-1: A customer requires `firstName`, `lastName`, `email`; all other fields are optional.
- BR-2: Account types are constrained to `CHECKING`, `SAVINGS`, `BUSINESS`, `CREDIT` (enforced only in the UI dropdown — **not** enforced by the API, which accepts any string).
- BR-3: New accounts always start as `ACTIVE`.
- BR-4: A transfer is only permitted when **both** the source and destination accounts have status `ACTIVE`.
- BR-5: A transfer is rejected if the source account's balance is less than the transfer amount.
- BR-6: A transfer cannot target the same account it originates from.
- BR-7: Transfer amount must be a positive number.
- BR-8: Transaction `type` values observed in seed data: `DEBIT`, `CREDIT`, `TRANSFER`. Transfers created by this system always use `TRANSFER`.
- BR-9: Transaction `status` values: `PENDING`, `COMPLETED` (transfers are written as `COMPLETED` immediately — no pending/approval workflow).
- BR-10: JWT tokens expire after 24 hours; there is no refresh-token mechanism.
- BR-11: Deleting an account cascades to delete its transactions. **Deleting a customer does not cascade** to their accounts or transactions (see Risks — orphaned data).
- BR-12: Account numbers are system-generated 10-digit numeric strings and are expected to be unique, but **uniqueness is not enforced at the application layer** (see Risks).
- BR-13: `CREDIT`-type accounts are permitted to carry a negative balance (observed in seed data), implying overdraft/credit-line semantics exist conceptually but are not modeled or validated anywhere.

---

## 5. Actors

| Actor | Description |
|---|---|
| **Bank Staff / Admin User** | The only modeled actor. Registers/logs in and performs all CRUD + transfer operations on any customer/account. No distinction between roles (e.g., teller vs. manager vs. auditor) — the `users` table has no role/permission field. |
| **Customer (data subject)** | Represented only as a record being managed; has no login, no self-service access, no visibility into their own data. |
| **System/Automation Client** | The Playwright test framework and/or any script calling the REST API directly via bearer token. |

---

## 6. UI Components

| Component | Responsibility |
|---|---|
| `LoginForm.jsx` | Login/registration toggle form |
| `CustomerList.jsx` | Paginated, searchable customer table; entry point to add a customer |
| `CustomerDetails.jsx` | Customer profile, accounts table (with transfer/delete actions), transactions table |
| `AddCustomer.jsx` | Modal form to create a customer, including address sub-form |
| `AddAccount.jsx` | Modal form to create an account for the currently viewed customer |
| `TransferFunds.jsx` | Modal form to transfer funds from a selected account to a destination account number |
| `App.jsx` | Shell/header, view routing (`list` / `details`), auth gate |
| `AuthContext.jsx` / `useAuth.js` | Client-side auth state (token, login/register/logout) backed by `localStorage` |

---

## 7. APIs

Base URL: `http://localhost:3000/api`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | No | Create a user account |
| POST | `/auth/login` | No | Obtain a JWT |
| GET | `/customers` | Yes | List customers (paginated) |
| GET | `/customers/search` | Yes | Search customers |
| GET | `/customers/:id` | Yes | Get one customer |
| GET | `/customers/:id/accounts` | Yes | List a customer's accounts |
| GET | `/customers/:id/transactions` | Yes | List transactions across a customer's accounts |
| POST | `/customers` | Yes | Create a customer |
| PUT | `/customers/:id` | Yes | Update a customer |
| DELETE | `/customers/:id` | Yes | Delete a customer |
| POST | `/customers/:id/accounts` | Yes | Create an account for a customer |
| DELETE | `/accounts/:id` | Yes | Delete an account (+ its transactions) |
| POST | `/accounts/transfer` | Yes | Transfer funds between two accounts |
| GET | `/health` | No | Liveness check |
| GET | `/routes` | No | Route introspection |

---

## 8. Database Tables

**customers** — `id` (PK), `firstName`, `lastName`, `email`, `phone`, `dateOfBirth`, `address_street`, `address_city`, `address_state`, `address_zipCode`, `address_country`, `createdAt`, `updatedAt`

**accounts** — `id` (PK), `customerId` (FK → customers.id, not DB-enforced), `accountNumber`, `accountType`, `balance` (REAL), `currency`, `status`, `createdAt`, `updatedAt`

**transactions** — `id` (PK), `accountId` (FK → accounts.id, not DB-enforced), `type`, `amount` (REAL), `description`, `reference`, `status`, `createdAt`, `updatedAt`

**users** — `id` (PK), `username` (unique), `email`, `password` (bcrypt hash), `createdAt`

*Note:* Foreign keys between tables are conceptual (documented in `banking-app/README.md`'s SQL) but the actual runtime schema in `banking.db` was not confirmed to have `FOREIGN KEY` / `UNIQUE` / `NOT NULL` constraints enforced by SQLite itself — application code is the only place referential integrity is (partially) maintained.

---

## 9. Integrations

- **None (business/external).** No payment rails, core banking system, KYC/AML provider, notification service (email/SMS), or reporting/BI export exists.
- **Tooling integrations (non-production):** MCP servers used during development/testing —
  - `playwright` MCP (browser automation)
  - `sqlite` MCP (direct DB inspection)
  - `github` MCP (repo operations)
  
  These are developer/CI-time tooling, not part of the deployed application's integration surface.

---

## 10. Risks

| # | Risk | Impact |
|---|---|---|
| R-1 | `JWT_SECRET` falls back to a hardcoded default (`'your_jwt_secret_key'`) if the environment variable is unset. | Critical — token forgery if deployed without setting the env var. |
| R-2 | No role-based access control — any authenticated user can read/modify/delete **any** customer, account, or transaction. | High — no separation of duties, no least-privilege. |
| R-3 | `cors()` is enabled with no origin restriction (allows all origins). | High in production — CSRF/credential exposure surface. |
| R-4 | Balance updates during a transfer are two separate `UPDATE` statements with no DB transaction/locking. | High — concurrent transfers could race and corrupt balances; a mid-transfer crash leaves an inconsistent debit/credit. |
| R-5 | No idempotency key on `/accounts/transfer` — a retried/duplicated request double-transfers funds. | High |
| R-6 | Deleting a customer does not cascade-delete their accounts/transactions, leaving orphaned rows. | Medium — data integrity / reporting drift. |
| R-7 | Account numbers are generated with `Math.random()` and never checked for collision against existing accounts. | Medium — low-probability but possible duplicate account numbers. |
| R-8 | Monetary values stored as SQLite `REAL` (floating point), not fixed-point/decimal. | Medium — rounding errors over many transactions. |
| R-9 | No input validation on `accountType`, `currency`, or numeric bounds at the API layer (only enforced by the UI `<select>`). | Medium — bad data enterable via direct API calls. |
| R-10 | No pagination cap on `limit`/`amount` query params. | Low/Medium — potential resource exhaustion. |
| R-11 | JWTs cannot be revoked/invalidated server-side; "logout" is purely client-side. | Medium — a leaked token remains valid until natural expiry. |
| R-12 | Test automation coverage is minimal today (one DB check, placeholder UI checks, no API checks), so regressions in the above risk areas would not currently be caught by CI. | Medium — false confidence from a "green" CI. |

---

## 11. Missing Information

- No specification of user **roles/permissions** (teller vs. manager vs. admin, etc.).
- No **currency conversion** rules for cross-currency transfers (the code doesn't check that source/destination currencies match at all).
- No **overdraft/credit-line** rules for `CREDIT` accounts despite negative balances appearing in seed data.
- No **transaction limits** (daily/per-transfer caps), **fraud/AML checks**, or **KYC** requirements.
- No **audit trail** of which user performed a given action (JWT `userId` is authenticated but never persisted against customer/account/transaction records).
- No **notification** requirements (email/SMS on transfer, statement generation, etc.).
- No **password policy** (minimum length/complexity) specified or enforced.
- No confirmation of whether "Edit Customer" (`PUT /customers/:id`) is fully wired end-to-end in the UI beyond the button click (analysis focused on the accounts/transfer features added most recently).
- No non-functional targets: expected load, concurrent user count, response-time SLAs, uptime requirements, data retention/backup policy.
- No environment/deployment requirements beyond local dev (`NODE_ENV=production` checklist exists in `banking-app/README.md` but isn't implemented as actual guardrails in code).

---

## 12. Questions for Product Owner

1. **Roles:** Should different staff roles (e.g., teller vs. manager) have different permissions, or is "any authenticated user can do anything" intentional for this phase?
2. **Cross-currency transfers:** Should `/accounts/transfer` reject transfers between accounts with different `currency` values, or is currency conversion in scope?
3. **Overdraft rules:** What are the intended rules for `CREDIT` account types going negative — is there a credit limit to enforce?
4. **Concurrency/atomicity:** Is it acceptable for the current transfer implementation to lack DB-transaction atomicity, or should this be hardened before further feature work builds on it?
5. **Audit requirements:** Is there a compliance need to record *who* (which user) performed each customer/account/transaction change?
6. **Customer self-service:** Is a customer-facing login ever in scope, or is this permanently a staff-only back-office tool?
7. **Cascade-delete:** When a customer is deleted, should their accounts/transactions be deleted too, archived, or blocked (e.g., "cannot delete a customer with active accounts")?
8. **Account number generation:** Is a random 10-digit number acceptable long-term, or should it follow a real banking account-number scheme (check digit, bank routing prefix, etc.)?
9. **Test scope:** For the Playwright framework, what's the priority order for filling in coverage — UI flows, API contract tests, or DB-integrity tests first?
10. **Secrets management:** Is there a deployment target where `JWT_SECRET` and other `.env` values will be properly injected (e.g., a secrets manager), or is local `.env` the permanent model?

---

*Test cases have intentionally not been generated. Awaiting review/approval of the above before proceeding.*
