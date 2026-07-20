import { AddressInput } from './domain';

/**
 * One interface per `testdata/*.yml` file, mirroring PlaywrightAutomationArchitecture.md §3.
 * Every file is a flat `Record<TestCaseId, Entry>` at the YAML document root — the key itself
 * *is* the test case id referenced from the feature files' step text (e.g. `"POS-12"`).
 * Field sets vary per key within the same file, so entry fields are optional rather than required.
 */

export interface UserAuthenticationTestDataEntry {
  username?: string;
  password?: string;
  email?: string;
  existingUsername?: string;
  newUsername?: string;
  newPassword?: string;
  newEmail?: string;
  attempts?: number;
}
export type UserAuthenticationTestData = Record<string, UserAuthenticationTestDataEntry>;

export interface SessionAndTokenManagementTestDataEntry {
  username?: string;
  password?: string;
}
export type SessionAndTokenManagementTestData = Record<string, SessionAndTokenManagementTestDataEntry>;

export interface SecurityAndAccessControlTestDataEntry {
  creatorUsername?: string;
  otherUsername?: string;
}
export type SecurityAndAccessControlTestData = Record<string, SecurityAndAccessControlTestDataEntry>;

export interface CustomerProfileManagementTestDataEntry {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: AddressInput;
}
export type CustomerProfileManagementTestData = Record<string, CustomerProfileManagementTestDataEntry>;

export interface CustomerSearchAndDirectoryTestDataEntry {
  query?: string;
}
export type CustomerSearchAndDirectoryTestData = Record<string, CustomerSearchAndDirectoryTestDataEntry>;

export interface AccountManagementTestDataEntry {
  accountType?: string;
  currency?: string;
  balance?: number | null;
}
export type AccountManagementTestData = Record<string, AccountManagementTestDataEntry>;

export interface FundTransferTestDataEntry {
  startingBalance?: number;
  transferAmount?: number;
  outcome?: string;
}
export type FundTransferTestData = Record<string, FundTransferTestDataEntry>;

/** These 3 YAML files are comments-only today (no keys) — kept for structural consistency. */
export type FundTransferResilienceTestData = Record<string, never>;
export type SystemHealthAndErrorHandlingTestData = Record<string, never>;
export type EndToEndCustomerBankingJourneyTestData = Record<string, never>;
