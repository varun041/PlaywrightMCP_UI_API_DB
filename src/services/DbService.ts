import sqlite3 from 'sqlite3';
import { Logger } from '@utils/Logger';
import { FilePaths } from '@constants/filePaths';
import { AccountRecord, CustomerRecord, TransactionRecord, UserRecord } from '@app-types/domain';

const logger = Logger.forScope('DbService');

function resolveRuntimeDbPath(): string {
  return process.env.RUNTIME_DB_PATH ?? FilePaths.SEED_DB_PATH;
}

const SQLITE_BUSY_RETRY_ATTEMPTS = 5;
const SQLITE_BUSY_RETRY_DELAY_MS = 100;

/**
 * Extends `tests/utils/db.ts`'s connection pattern (same `sqlite3` driver, same promisified query
 * shape) with a configurable path instead of a hardcoded one — global-setup points this at an
 * isolated per-run working copy of `tests/DB/banking.db`, never the checked-in seed file directly.
 * Centralizes `SQLITE_BUSY` retry so `@DB`/`@Concurrency` scenarios don't each reinvent it
 * (PlaywrightAutomationArchitecture.md §6). `tests/utils/db.ts` itself is left untouched.
 *
 * Note: the backend's own `db.js` runs `CREATE TABLE IF NOT EXISTS users (...)` against whichever
 * `DB_PATH` it's launched with. Because global-setup launches the backend-under-test against this
 * same runtime copy, the `users` table ends up in this file too (not only in the separate
 * `banking-app/backend/db/banking.db`) — so one connection here serves both auth and
 * customer/account/transaction assertions.
 */
export class DbService {
  private readonly dbPath: string;

  constructor(dbPath: string = resolveRuntimeDbPath()) {
    this.dbPath = dbPath;
  }

  private open(): sqlite3.Database {
    return new sqlite3.Database(this.dbPath);
  }

  private all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.withBusyRetry(
      () =>
        new Promise<T[]>((resolve, reject) => {
          const db = this.open();
          db.all(sql, params, (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows as T[]);
          });
        }),
    );
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    return this.withBusyRetry(
      () =>
        new Promise<void>((resolve, reject) => {
          const db = this.open();
          db.run(sql, params, (err) => {
            db.close();
            if (err) reject(err);
            else resolve();
          });
        }),
    );
  }

  private async withBusyRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= SQLITE_BUSY_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const isBusy = error instanceof Error && /SQLITE_BUSY/.test(error.message);
        if (!isBusy) {
          throw error;
        }
        logger.warn(`SQLITE_BUSY — retrying (attempt ${attempt}/${SQLITE_BUSY_RETRY_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, SQLITE_BUSY_RETRY_DELAY_MS));
      }
    }
    throw lastError;
  }

  async countCustomers(): Promise<number> {
    const rows = await this.all<{ count: number }>('SELECT COUNT(*) as count FROM customers');
    return rows[0]?.count ?? 0;
  }

  async getCustomerById(id: string): Promise<CustomerRecord | undefined> {
    const rows = await this.all<CustomerRecord>('SELECT * FROM customers WHERE id = ?', [id]);
    return rows[0];
  }

  async getAccountById(id: string): Promise<AccountRecord | undefined> {
    const rows = await this.all<AccountRecord>('SELECT * FROM accounts WHERE id = ?', [id]);
    return rows[0];
  }

  async getAccountBalance(accountId: string): Promise<number | undefined> {
    const account = await this.getAccountById(accountId);
    return account?.balance;
  }

  async getAccountsByCustomerId(customerId: string): Promise<AccountRecord[]> {
    return this.all<AccountRecord>('SELECT * FROM accounts WHERE customerId = ?', [customerId]);
  }

  async getTransactionsByAccountId(accountId: string): Promise<TransactionRecord[]> {
    return this.all<TransactionRecord>('SELECT * FROM transactions WHERE accountId = ?', [accountId]);
  }

  async getTransactionsByReference(reference: string): Promise<TransactionRecord[]> {
    return this.all<TransactionRecord>('SELECT * FROM transactions WHERE reference = ?', [reference]);
  }

  /** Transactions whose `accountId` no longer maps to an existing account row (BR-02/BR-03 cascade checks). */
  async countOrphanedTransactions(): Promise<number> {
    const rows = await this.all<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions t LEFT JOIN accounts a ON t.accountId = a.id WHERE a.id IS NULL',
    );
    return rows[0]?.count ?? 0;
  }

  /** Accounts still present for a given customer id (Requirement.md R-6 orphaned-data-after-delete check). */
  async countAccountsForCustomer(customerId: string): Promise<number> {
    const rows = await this.all<{ count: number }>(
      'SELECT COUNT(*) as count FROM accounts WHERE customerId = ?',
      [customerId],
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * The `users` table lives in whichever file the backend was launched against — see class-level
   * note above on why this same connection also serves auth assertions (bcrypt-hash checks).
   */
  async getUserPasswordHash(username: string): Promise<string | undefined> {
    const user = await this.getUserByUsername(username);
    return user?.password;
  }

  async getUserByUsername(username: string): Promise<UserRecord | undefined> {
    const rows = await this.all<UserRecord>('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0];
  }

  /** Raw passthrough for one-off ad hoc queries — mirrors `tests/utils/db.ts`'s `queryDatabase`. */
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.all<T>(sql, params);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    return this.run(sql, params);
  }
}
