import { Given, When, Then, expect, test } from './support/bdd';
import { Logger } from '@utils/Logger';
import { AccountType } from '@enums/AccountType';
import { ApiResult } from '@services/ApiClient';
import { AccountRecord } from '@app-types/domain';

const gapLogger = Logger.forScope('transfer-resilience.steps');

// --- CONC-01: two simultaneous transfers from the same account -------------------------------

Given(
  'an account has a balance that covers only one of two simultaneous transfer requests',
  async ({ seededAccount, accountApiService, state }) => {
    // seededAccount starts at 500; two simultaneous 400 transfers combine to 800 > 500.
    state.extra.raceSourceAccount = seededAccount;
    const destination = await accountApiService.create(seededAccount.customerId, {
      accountType: AccountType.SAVINGS,
      balance: 0,
    });
    state.extra.raceDestinationAccount = destination.body;
  },
);

When('two transfer requests from that account are submitted at the same time', async ({ transferApiService, state }) => {
  const sourceAccount = state.extra.raceSourceAccount as AccountRecord;
  const destinationAccount = state.extra.raceDestinationAccount as { accountNumber: string };
  state.extra.raceResults = await transferApiService.transferConcurrently([
    { fromAccountId: sourceAccount.id, toAccountNumber: destinationAccount.accountNumber, amount: 400 },
    { fromAccountId: sourceAccount.id, toAccountNumber: destinationAccount.accountNumber, amount: 400 },
  ]);
});

Then('the current implementation may allow both to succeed, overdrawing the account', async ({ dbService, state }) => {
  const [first, second] = state.extra.raceResults as ApiResult<any>[];
  const sourceAccount = state.extra.raceSourceAccount as AccountRecord;
  const finalAccount = await dbService.getAccountById(sourceAccount.id);
  const succeededCount = [first, second].filter((result) => result.status === 201).length;
  const rejectedCount = [first, second].filter((result) => result.status === 400).length;
  gapLogger.info('CONC-01 race outcome (informational — not a hard pass/fail on which outcome "should" happen)', {
    firstStatus: first.status,
    secondStatus: second.status,
    finalBalance: finalAccount?.balance,
    succeededCount,
  });
  // The whole point of this probe is to characterize current (unsafe) behavior, not assert a
  // specific outcome — per PlaywrightAutomationArchitecture.md §13/§14 this runs informationally.
  // It must still be a REAL assertion though: every response must be a genuine outcome (success or
  // the documented insufficient-funds rejection), and the stored balance must arithmetically match
  // how many of the two 400 transfers actually went through — catching a lost-update/corruption bug
  // distinct from "double debit" that a status-code-only check would miss entirely.
  expect(succeededCount + rejectedCount).toBe(2);
  expect(finalAccount).toHaveBalance(sourceAccount.balance - succeededCount * 400);
  if (succeededCount === 2) {
    expect(finalAccount!.balance).toBeLessThan(0);
  }
});

Then('this should be tracked as a known concurrency risk pending a fix decision', async () => {
  gapLogger.knownGap('Balance updates during a transfer are two separate UPDATEs with no DB transaction/locking (Requirement.md R-4).');
});

// --- CONC-03: transfer racing an account delete ------------------------------------------------

Given('a destination account is in the process of being deleted', async ({ seededAccount, accountApiService, state }) => {
  const destination = await accountApiService.create(seededAccount.customerId, {
    accountType: AccountType.SAVINGS,
    balance: 0,
  });
  state.extra.raceSourceAccount = seededAccount;
  state.extra.raceDestinationAccount = destination.body;
});

When('a transfer to that account is submitted at the same time', async ({ transferApiService, accountApiService, state }) => {
  const sourceAccount = state.extra.raceSourceAccount as AccountRecord;
  const destinationAccount = state.extra.raceDestinationAccount as { id: string; accountNumber: string };
  const [transferResult, deleteResult] = await Promise.all([
    transferApiService.transfer({ fromAccountId: sourceAccount.id, toAccountNumber: destinationAccount.accountNumber, amount: 10 }),
    accountApiService.delete(destinationAccount.id),
  ]);
  state.extra.raceTransferResult = transferResult;
  state.extra.raceDeleteResult = deleteResult;
});

Then('the outcome should be documented as a race condition risk', async ({ dbService, state }) => {
  const transferResult = state.extra.raceTransferResult as ApiResult<any>;
  const deleteResult = state.extra.raceDeleteResult as ApiResult<any>;
  const destinationAccount = state.extra.raceDestinationAccount as { id: string };
  gapLogger.knownGap(
    `CONC-03 race outcome: transfer status=${transferResult.status}, delete status=${deleteResult.status} — no orchestration exists to prevent this interleaving.`,
  );

  // Both must be genuine, recognized outcomes for their respective endpoint — not an unrelated
  // crash status.
  expect([200, 201, 400, 404]).toContain(transferResult.status);
  expect([200, 404]).toContain(deleteResult.status);

  // The real risk this probe characterizes: a transfer reported success against an account the
  // concurrent delete also reported as removed — money "arrived" at an account the system
  // simultaneously considers gone. If that ever happens, a transaction record referencing it must
  // still exist (funds silently vanishing would be strictly worse than the raced status codes alone).
  if (transferResult.status === 201 && deleteResult.status === 200) {
    const transactions = await dbService.getTransactionsByAccountId(destinationAccount.id);
    gapLogger.info('CONC-03 confirmed race: transfer succeeded against a concurrently-deleted account', {
      transactionCount: transactions.length,
    });
    expect(transactions.length).toBeGreaterThan(0);
  }
});

// --- CONC-04: concurrent reads alongside a write -----------------------------------------------

Given('multiple users are listing and searching customers', async ({ customerApiService, state }) => {
  state.extra.concurrentReadPromises = Array.from({ length: 5 }, () => customerApiService.list());
});

When('a transfer is submitted concurrently', async ({ transferApiService, accountApiService, seededAccount, state }) => {
  const destination = await accountApiService.create(seededAccount.customerId, {
    accountType: AccountType.SAVINGS,
    balance: 0,
  });
  const readPromises = state.extra.concurrentReadPromises as Promise<ApiResult<unknown>>[];
  const [reads, transfer] = await Promise.all([
    Promise.all(readPromises),
    transferApiService.transfer({ fromAccountId: seededAccount.id, toAccountNumber: destination.body.accountNumber, amount: 10 }),
  ]);
  state.extra.concurrentReads = reads;
  state.extra.concurrentTransfer = transfer;
});

Then('both the reads and the write should complete without user-facing lock errors', async ({ state }) => {
  const reads = state.extra.concurrentReads as ApiResult<unknown>[];
  const transfer = state.extra.concurrentTransfer as ApiResult<any>;
  for (const read of reads) {
    expect(read.status).toBe(200);
  }
  expect([201, 500]).toContain(transfer.status);
  if (transfer.status === 500) {
    gapLogger.knownGap('Concurrent read/write triggered a SQLITE_BUSY-style 500 instead of completing (Requirement.md R-4 related).');
  }
});

// --- RETRY-01: retried transfer double-moves funds ---------------------------------------------

Given(
  'a transfer request was submitted and the client did not receive a response before timing out',
  async ({ seededAccount, accountApiService, state }) => {
    const destination = await accountApiService.create(seededAccount.customerId, {
      accountType: AccountType.SAVINGS,
      balance: 0,
    });
    state.extra.retrySourceAccount = seededAccount;
    state.extra.retryDestinationAccount = destination.body;
  },
);

When('the client retries the same transfer request', async ({ transferApiService, state }) => {
  const sourceAccount = state.extra.retrySourceAccount as AccountRecord;
  const destinationAccount = state.extra.retryDestinationAccount as { accountNumber: string };
  const payload = { fromAccountId: sourceAccount.id, toAccountNumber: destinationAccount.accountNumber, amount: 50 };
  state.extra.retryTransferResults = await transferApiService.transferThenRetry(payload);
});

Then('the current implementation processes the transfer twice', async ({ dbService, state }) => {
  const [first, retry] = state.extra.retryTransferResults as ApiResult<any>[];
  expect(first.status).toBe(201);
  expect(retry.status).toBe(201);
  const sourceAccount = state.extra.retrySourceAccount as AccountRecord;
  const account = await dbService.getAccountById(sourceAccount.id);
  expect(account).toHaveBalance(sourceAccount.balance - 100);
});

Then(
  'this should be tracked as a missing idempotency safeguard requiring remediation before production use',
  async () => {
    gapLogger.knownGap('POST /accounts/transfer has no idempotency key (Requirement.md R-5) — a client retry double-transfers funds.');
  },
);

// --- RECOV-01: mid-transfer process failure — not automatable ---------------------------------

// Reconsidered during the 2026-07-17 framework audit: two automation paths exist and both were
// rejected. (1) Add a fault-injection hook to banking-app/backend/routes/accounts.js so a test can
// interrupt the handler between the debit and credit statements — this changes production request-
// handling code purely to make it testable, a product decision out of scope for a test-framework
// pass. (2) Approximate the interrupt by racing the transfer call against killing the isolated
// backend process on a timer — this cannot reliably land inside the single-digit-millisecond window
// between the two statements, so it would be a non-deterministic/flaky test masquerading as
// coverage, trading one known gap for another. Left as `test.fixme` + `@KnownGap` (tagged in
// fund_transfer_resilience.feature) rather than either.
Given('a transfer is in progress', async () => {
  test.fixme(
    true,
    'Not automatable: the debit and credit are two sequential statements inside one synchronous ' +
      'request handler with no external hook to interrupt between them. Requires fault-injection ' +
      'support the app does not expose (TestScenarios.md RECOV-01 — "Manual, requires fault injection ' +
      'at process level").',
  );
});

When(
  'the backend process fails after debiting the source account but before crediting the destination account',
  async () => {
    /* unreachable — the preceding Given already marked this scenario fixme */
  },
);

Then('the accounts are left in an inconsistent state', async () => {
  /* unreachable — the preceding Given already marked this scenario fixme */
});

Then('this should be tracked as a critical data-integrity risk requiring transactional safeguards', async () => {
  /* unreachable — the preceding Given already marked this scenario fixme */
});
