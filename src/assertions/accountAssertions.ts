import { AccountRecord } from '@app-types/domain';
import { AccountStatus } from '@enums/AccountStatus';
import { CurrencyUtils } from '@utils/CurrencyUtils';

/**
 * Backs account lifecycle scenarios (BR-01, BR-03/BR-04 status/balance checks). `received` accepts
 * `undefined` because the common call shape is `expect(await dbService.getAccountById(id))...` —
 * a row that should exist but doesn't is a real (failing) assertion, not a type error.
 */
export const accountMatchers = {
  toHaveAccountStatus(received: AccountRecord | undefined, expected: AccountStatus) {
    if (!received) {
      return { pass: false, message: () => `expected an account record but got undefined` };
    }
    const pass = received.status === expected;
    return {
      pass,
      message: () =>
        `expected account ${received.id} (${received.accountNumber}) status to be "${expected}" but was "${received.status}"`,
    };
  },

  /** Tolerance exists because balances are stored as floating-point `REAL` (Requirement.md R-8). */
  toHaveBalance(received: AccountRecord | undefined, expected: number, tolerance = CurrencyUtils.DEFAULT_TOLERANCE) {
    if (!received) {
      return { pass: false, message: () => `expected an account record but got undefined` };
    }
    const diff = Math.abs(received.balance - expected);
    const pass = diff <= tolerance;
    return {
      pass,
      message: () =>
        `expected account ${received.id} (${received.accountNumber}) balance to be ${expected} (±${tolerance}) but was ${received.balance} (diff ${diff})`,
    };
  },
};
