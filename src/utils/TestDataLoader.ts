import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { FilePaths } from '@constants/filePaths';
import { Logger } from '@utils/Logger';
import {
  AccountManagementTestData,
  CustomerProfileManagementTestData,
  CustomerSearchAndDirectoryTestData,
  EndToEndCustomerBankingJourneyTestData,
  FundTransferResilienceTestData,
  FundTransferTestData,
  SecurityAndAccessControlTestData,
  SessionAndTokenManagementTestData,
  SystemHealthAndErrorHandlingTestData,
  UserAuthenticationTestData,
} from '@app-types/testdata';

const logger = Logger.forScope('TestDataLoader');
const fileCache = new Map<string, Record<string, unknown>>();

/**
 * Resolves a `testdata/<feature>.yml` file + `TestCaseId` (as referenced in the Gherkin steps,
 * e.g. `"POS-12"`) into a typed data object. One instance per feature file (below) is the single
 * point every step definition imports from — nothing reads a YAML file directly.
 */
export class TestDataLoader<T extends Record<string, unknown>> {
  constructor(private readonly fileName: string) {}

  /** Returns the full parsed document; empty/comments-only YAML files resolve to `{}`, not `undefined`. */
  all(): T {
    const cached = fileCache.get(this.fileName);
    if (cached) {
      return cached as T;
    }
    const filePath = path.join(FilePaths.TESTDATA_DIR, this.fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = (parse(raw) ?? {}) as T;
    fileCache.set(this.fileName, parsed);
    logger.info(`Loaded ${this.fileName}`, { keys: Object.keys(parsed) });
    return parsed;
  }

  /** Resolves one entry by test case id; throws with a clear message if the id doesn't exist. */
  get<K extends keyof T & string>(testCaseId: K): T[K] {
    const data = this.all();
    const entry = data[testCaseId];
    if (entry === undefined) {
      throw new Error(
        `TestDataLoader: no entry "${testCaseId}" found in testdata/${this.fileName}`,
      );
    }
    return entry;
  }
}

export const TestData = {
  userAuthentication: new TestDataLoader<UserAuthenticationTestData>('user_authentication.yml'),
  sessionAndTokenManagement: new TestDataLoader<SessionAndTokenManagementTestData>(
    'session_and_token_management.yml',
  ),
  securityAndAccessControl: new TestDataLoader<SecurityAndAccessControlTestData>(
    'security_and_access_control.yml',
  ),
  customerProfileManagement: new TestDataLoader<CustomerProfileManagementTestData>(
    'customer_profile_management.yml',
  ),
  customerSearchAndDirectory: new TestDataLoader<CustomerSearchAndDirectoryTestData>(
    'customer_search_and_directory.yml',
  ),
  accountManagement: new TestDataLoader<AccountManagementTestData>('account_management.yml'),
  fundTransfer: new TestDataLoader<FundTransferTestData>('fund_transfer.yml'),
  fundTransferResilience: new TestDataLoader<FundTransferResilienceTestData>(
    'fund_transfer_resilience.yml',
  ),
  systemHealthAndErrorHandling: new TestDataLoader<SystemHealthAndErrorHandlingTestData>(
    'system_health_and_error_handling.yml',
  ),
  endToEndCustomerBankingJourney: new TestDataLoader<EndToEndCustomerBankingJourneyTestData>(
    'end_to_end_customer_banking_journey.yml',
  ),
} as const;
