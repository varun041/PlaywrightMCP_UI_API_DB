import { expect as baseExpect } from '@playwright/test';
import { accountMatchers } from '@assertions/accountAssertions';
import { transactionMatchers } from '@assertions/transactionAssertions';
import { apiMatchers, ExpectedApiError } from '@assertions/apiAssertions';
import { accessibilityMatchers } from '@assertions/accessibilityAssertions';
import { AccountStatus } from '@enums/AccountStatus';

declare module '@playwright/test' {
  interface Matchers<R, T> {
    toHaveAccountStatus(expected: AccountStatus): R;
    toHaveBalance(expected: number, tolerance?: number): R;
    toHaveLinkedTransactions(reference: string, expectedCount?: number): R;
    toMatchApiError(expected: ExpectedApiError): R;
    toRespondWithinThreshold(thresholdMs: number): R;
    toBeAccessible(scopeSelector?: string): Promise<R>;
  }
}

/**
 * The single `expect.extend()` registration point (PlaywrightAutomationArchitecture.md §7) — every
 * matcher file above exports a plain object of matcher functions; this is the only place they're
 * merged and registered. `src/fixtures/index.ts` re-exports this `expect`, and every step definition
 * imports `expect` from the fixtures module, never directly from `@playwright/test`.
 */
export const expect = baseExpect.extend({
  ...accountMatchers,
  ...transactionMatchers,
  ...apiMatchers,
  ...accessibilityMatchers,
});
