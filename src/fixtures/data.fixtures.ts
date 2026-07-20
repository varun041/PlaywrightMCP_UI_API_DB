import { test as pageTest } from '@fixtures/page.fixtures';
import { AccountType } from '@enums/AccountType';
import { AccountStatus } from '@enums/AccountStatus';
import { AccountRecord, CustomerRecord } from '@app-types/domain';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('data.fixtures');

export interface DataTestFixtures {
  /** Disposable customer created via API before the test, deleted after. */
  seededCustomer: CustomerRecord;
  /** Disposable CHECKING account (starting balance 500) created via API before the test, deleted after. */
  seededAccount: AccountRecord;
}

export const test = pageTest.extend<DataTestFixtures>({
  seededCustomer: async ({ customerApiService }, use) => {
    const email = RandomDataGenerator.uniqueEmail('seeded.customer@bankcorp.com');
    const createResponse = await customerApiService.create({
      firstName: 'Seeded',
      lastName: RandomDataGenerator.uniqueSuffix(),
      email,
    });
    if (createResponse.status !== 201) {
      throw new Error(
        `seededCustomer fixture: create failed (status ${createResponse.status}): ${JSON.stringify(createResponse.body)}`,
      );
    }

    const getResponse = await customerApiService.getById(createResponse.body.id);
    const customer = getResponse.body as CustomerRecord;
    logger.info('Seeded customer', { id: customer.id });

    await use(customer);

    await customerApiService.delete(customer.id);
    logger.info('Deleted seeded customer', { id: customer.id });
  },

  seededAccount: async ({ accountApiService, seededCustomer }, use) => {
    const startingBalance = 500;
    const createResponse = await accountApiService.create(seededCustomer.id, {
      accountType: AccountType.CHECKING,
      balance: startingBalance,
    });
    if (createResponse.status !== 201) {
      throw new Error(
        `seededAccount fixture: create failed (status ${createResponse.status}): ${JSON.stringify(createResponse.body)}`,
      );
    }

    const now = new Date().toISOString();
    const account: AccountRecord = {
      id: createResponse.body.id,
      customerId: seededCustomer.id,
      accountNumber: createResponse.body.accountNumber,
      accountType: AccountType.CHECKING,
      balance: startingBalance,
      currency: 'USD',
      status: AccountStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };
    logger.info('Seeded account', { id: account.id, accountNumber: account.accountNumber });

    await use(account);

    await accountApiService.delete(account.id);
    logger.info('Deleted seeded account', { id: account.id });
  },
});
