# Playwright + TypeScript Automation Framework (UI / API / DB)

An end-to-end test automation framework built with **Playwright** and **TypeScript**, designed to exercise all three layers of an application from a single repo:

- **UI** — browser automation against the React frontend
- **API** — HTTP-level testing of the Express REST backend
- **DB** — direct SQLite assertions against the underlying data

The application under test is the **Banking Customer Management App** (`banking-app/`), a full-stack Node.js/Express + React + SQLite app. This framework was built iteratively with **Claude Code**, using **MCP (Model Context Protocol) servers** to drive the browser, query the database, and interact with GitHub directly from the coding assistant.

## 📋 Table of Contents

- [Repository Structure](#repository-structure)
- [MCP Integration](#mcp-integration)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the App Under Test](#running-the-app-under-test)
- [Running Tests](#running-tests)
- [Test Credentials](#test-credentials)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

---

## 📁 Repository Structure

```
PlayWright_API_DB_UI_AI/
├── playwright.config.ts         # Root Playwright config (chromium/firefox/webkit projects)
├── package.json                 # Root framework deps: @playwright/test, sqlite3
├── tests/
│   ├── example.spec.ts          # Starter spec: DB count check + UI smoke tests
│   ├── utils/
│   │   └── db.ts                # Direct SQLite helpers (getDatabase, countCustomers, queryDatabase)
│   └── DB/
│       └── banking.db           # Local SQLite copy used by DB-layer tests
│
├── .github/workflows/
│   └── playwright.yml           # CI: npm ci → install browsers → npx playwright test
│
├── .mcp.json / .vscode/mcp.json # MCP server definitions (playwright, sqlite, github)
│
└── banking-app/                 # Application under test
    ├── README.md                 # App-specific setup/details
    ├── backend/                  # Express REST API
    │   ├── server.js
    │   ├── db.js                 # SQLite connection + query/run helpers
    │   ├── routes/
    │   │   ├── auth.js           # /api/auth/register, /api/auth/login
    │   │   ├── customers.js      # Customer CRUD + nested accounts/transactions
    │   │   └── accounts.js       # Account delete + funds transfer
    │   ├── middleware/auth.js    # JWT auth middleware
    │   ├── db/banking.db         # Live SQLite database (pre-populated)
    │   └── .env / .env.example
    │
    └── frontend/                 # React (Vite) SPA
        └── src/
            ├── components/
            │   ├── LoginForm.jsx
            │   ├── CustomerList.jsx
            │   ├── CustomerDetails.jsx
            │   ├── AddCustomer.jsx
            │   ├── AddAccount.jsx
            │   └── TransferFunds.jsx
            ├── context/AuthContext.jsx
            ├── hooks/useAuth.js
            ├── services/api.js   # Axios client (customersAPI, accountsAPI, authAPI)
            └── styles/*.css
```

---

## 🔌 MCP Integration

This framework is driven from Claude Code using three MCP servers (configured in `.mcp.json` / `.vscode/mcp.json`):

| Server | Purpose |
|---|---|
| **playwright** | Drives a real browser (navigate, click, fill forms, take snapshots) so UI flows can be automated and inspected interactively, not just scripted blind. |
| **sqlite** | Queries `banking-app/backend/db/banking.db` directly — used to seed assertions, verify schema, and cross-check API responses against the source of truth. |
| **github** | Reads/writes the repo (files, branches, PRs) without needing a local `git` shell. |

> **Security note:** `.mcp.json` holds credentials (e.g. a GitHub PAT) for these servers. It is git-ignored — never commit it. Use `.env` / `.env.example` in `banking-app/backend/` the same way for API secrets.

---

## ✅ Prerequisites

- **Node.js** v18+ (v14+ for the app itself, but Playwright requires 18+)
- **npm**
- **Git**

```bash
node --version
npm --version
git --version
```

---

## ⚙️ Setup

Install dependencies in all three places — they're independent `package.json`s:

```bash
# 1. Root test framework
npm install
npx playwright install --with-deps

# 2. Backend (Express API)
cd banking-app/backend 
npm install
cp .env.example .env   # if .env doesn't already exist

# 3. Frontend (React/Vite)
cd ../frontend
npm install
```

---

## ▶️ Running the App Under Test

Tests assume the app is already running locally.

```bash
# Terminal 1 — backend (http://localhost:3000)


npm start

# Terminal 2 — frontend (http://localhost:3001, proxies /api → :3000)
cd banking-app/frontend
npm run dev
```

Verify the backend is healthy:
```bash
curl http://localhost:3000/api/health
# {"status":"Banking API is running"}
```

---

## 🧪 Running Tests

From the repo root:

```bash
npx playwright test              # all projects (chromium, firefox, webkit)
npx playwright test --project=chromium
npx playwright test --ui         # interactive UI mode
npx playwright show-report       # view the HTML report after a run
```

**Current coverage** (`tests/example.spec.ts`):
- **DB layer** — `countCustomers()` from `tests/utils/db.ts` asserts the seeded `customers` table is non-empty, querying `tests/DB/banking.db` directly with `sqlite3`.
- **UI layer** — smoke tests against playwright.dev as placeholders for the pattern; replace with flows against `http://localhost:3001` (login → list customers → add account → transfer funds, etc.).
- **API layer** — not yet scaffolded; add specs that hit `http://localhost:3000/api/*` directly (register/login for a token, then call customer/account endpoints with `Authorization: Bearer <token>`).

`tests/utils/db.ts` exports `getDatabase()`, `countCustomers()`, and `queryDatabase(sql, params)` for any spec that needs to assert directly against SQLite state (e.g. confirming a transfer actually moved balances between two `accounts` rows).

---

## 🔑 Test Credentials

The app has no seeded login — register once, then reuse:

```
Username: admin
Password: password123
```

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123","email":"admin@banking.com"}'
```

Subsequent logins:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

All endpoints below except `/auth/*` require `Authorization: Bearer <token>`.

---

## 📡 API Reference

Base URL: `http://localhost:3000/api`

### Auth
| Method | Path | Body |
|---|---|---|
| POST | `/auth/register` | `{ username, password, email }` |
| POST | `/auth/login` | `{ username, password }` |

### Customers
| Method | Path | Notes |
|---|---|---|
| GET | `/customers?limit=&offset=` | Paginated list |
| GET | `/customers/search?query=&filter=` | `filter`: `email`, `phone`, or omitted (name+email) |
| GET | `/customers/:id` | Single customer |
| GET | `/customers/:id/accounts` | Accounts for a customer |
| GET | `/customers/:id/transactions` | Transactions across all of a customer's accounts |
| POST | `/customers` | `{ firstName, lastName, email, phone?, dateOfBirth?, address? }` |
| PUT | `/customers/:id` | Same shape as create |
| DELETE | `/customers/:id` | |

### Accounts & Transfers
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/customers/:id/accounts` | `{ accountType, balance?, currency? }` | Creates an account for an existing customer; `accountType` ∈ `CHECKING`/`SAVINGS`/`BUSINESS`/`CREDIT` |
| DELETE | `/accounts/:id` | | Deletes the account and its transactions |
| POST | `/accounts/transfer` | `{ fromAccountId, toAccountNumber, amount, description? }` | Moves funds between two **active** accounts, rejects if `fromAccountId` balance < `amount`; writes a `TRANSFER` transaction row on both sides sharing a `reference` |

### Misc
| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/routes` |

---

## 💾 Database Schema

`banking-app/backend/db/banking.db` (SQLite)

**customers** — `id`, `firstName`, `lastName`, `email`, `phone`, `dateOfBirth`, `address_street/city/state/zipCode/country`, `createdAt`, `updatedAt`

**accounts** — `id`, `customerId` (FK), `accountNumber` (unique), `accountType`, `balance`, `currency`, `status` (`ACTIVE`/`INACTIVE`), `createdAt`, `updatedAt`

**transactions** — `id`, `accountId` (FK), `type` (`DEBIT`/`CREDIT`/`TRANSFER`), `amount`, `description`, `reference`, `status` (`PENDING`/`COMPLETED`), `createdAt`, `updatedAt`

**users** — `id`, `username` (unique), `email`, `password` (bcrypt hash), `createdAt` — auto-created on first `/auth/register` call

---

## 🔄 CI/CD

`.github/workflows/playwright.yml` runs on push/PR to `main`/`master`:
1. `npm ci`
2. `npx playwright install --with-deps`
3. `npx playwright test`
4. Uploads the HTML report as a build artifact (30-day retention)

> Note: CI currently only installs root framework deps — it does not start `banking-app`'s backend/frontend. Add a `webServer` block to `playwright.config.ts` (or explicit setup steps in the workflow) once UI/API specs depend on the live app.

---

## 🐛 Troubleshooting

**Port 3000/3001 already in use**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**`npx playwright test` can't find browsers**
```bash
npx playwright install --with-deps
```

**Backend can't reach the DB / `no such table`**
Check `DB_PATH` in `banking-app/backend/.env` and that `banking-app/backend/db/banking.db` exists — tables are created lazily on first request except `users`, which needs at least one `/auth/register` call.

**Frontend shows blank screen after login**
Clear `localStorage` (`token`/`userId`) in devtools and log in again; check the browser console and confirm the Vite proxy in `banking-app/frontend/vite.config.js` points at the running backend port.

---

## 📄 License

ISC
