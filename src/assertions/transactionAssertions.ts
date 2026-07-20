import { TransactionRecord } from '@app-types/domain';
import { TransactionType } from '@enums/TransactionType';
import { TransactionStatus } from '@enums/TransactionStatus';

/**
 * Backs the transfer transaction-pair verification (BR-07): a completed transfer writes exactly two
 * linked rows. `expectedCount` defaults to 2 (the happy-path pair) but accepts 0/1 so a
 * resilience/failure-path scenario can assert that a failed or not-yet-completed transfer did NOT
 * leave a full linked pair behind, instead of only ever being able to check the happy path.
 */
export const transactionMatchers = {
  toHaveLinkedTransactions(received: TransactionRecord[], reference: string, expectedCount = 2) {
    const matching = received.filter((transaction) => transaction.reference === reference);
    const allCompletedTransfers = matching.every(
      (transaction) => transaction.type === TransactionType.TRANSFER && transaction.status === TransactionStatus.COMPLETED,
    );
    const pass = matching.length === expectedCount && (expectedCount === 0 || allCompletedTransfers);
    return {
      pass,
      message: () =>
        `expected exactly ${expectedCount} COMPLETED TRANSFER transaction(s) sharing reference "${reference}", found ${matching.length}: ${JSON.stringify(matching)}`,
    };
  },
};
