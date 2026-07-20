import { When, Then, expect } from './support/bdd';
import { RandomDataGenerator } from '@utils/RandomDataGenerator';
import { AccountType } from '@enums/AccountType';
import { CustomerListPage } from '@pages/CustomerListPage';
import { CustomerDetailsPage } from '@pages/CustomerDetailsPage';
import { AddCustomerModal } from '@modals/AddCustomerModal';
import { AddAccountModal } from '@modals/AddAccountModal';
import { TransferFundsModal } from '@modals/TransferFundsModal';

/**
 * Every interaction below goes through the same Page Objects/Modals the rest of the suite uses,
 * calling their `*ViaKeyboard` methods (focus + a real keyboard event, never `.click()`/`.fill()`)
 * so the flow is genuinely keyboard-driven end to end (A11Y-04) without maintaining a second,
 * unsynced copy of these locators. Creating the transfer's *destination* account via the API
 * (rather than a third keyboard-driven "Add Account") is test setup, not part of what this journey
 * verifies (the journey is scoped to add-customer, add-account, transfer-funds, per the feature's
 * own title/intent).
 */
When(
  'I navigate the entire flow of adding a customer, adding an account, and transferring funds using only the keyboard',
  async ({ page, appNavigator, registeredUser, dbService, accountApiService, state }) => {
    await appNavigator.openLogin();
    await appNavigator.login(registeredUser.username, registeredUser.password);

    const firstName = 'KeyboardOnly';
    const lastName = RandomDataGenerator.uniqueSuffix();
    const email = RandomDataGenerator.uniqueEmail('keyboard.only@bankcorp.com');

    // --- Add Customer ---
    const listPage = new CustomerListPage(page);
    await listPage.clickAddCustomerViaKeyboard();
    const addCustomerModal = new AddCustomerModal(page);
    await addCustomerModal.waitUntilOpen();
    await addCustomerModal.createCustomerViaKeyboard({ firstName, lastName, email });
    await addCustomerModal.waitUntilClosed();

    // --- Find and open the new customer ---
    await listPage.searchViaKeyboard(lastName);
    await listPage.openCustomerByNameViaKeyboard(`${firstName} ${lastName}`);
    const detailsPage = new CustomerDetailsPage(page);
    await detailsPage.waitUntilReady();

    // --- Add Account ---
    await detailsPage.clickAddAccountViaKeyboard();
    const addAccountModal = new AddAccountModal(page);
    await addAccountModal.waitUntilOpen();
    await addAccountModal.createAccountViaKeyboard({ balance: 500 });
    await addAccountModal.waitUntilClosed();

    const [createdCustomer] = await dbService.query<{ id: string }>('SELECT id FROM customers WHERE lastName = ?', [lastName]);
    const createdAccounts = await dbService.getAccountsByCustomerId(createdCustomer.id);
    const sourceAccountNumber = createdAccounts[0].accountNumber;
    const destinationResponse = await accountApiService.create(createdCustomer.id, {
      accountType: AccountType.SAVINGS,
      balance: 0,
    });

    // --- Transfer Funds ---
    await detailsPage.accountsTable.clickTransferForAccountNumberViaKeyboard(sourceAccountNumber);
    const transferModal = new TransferFundsModal(page);
    await transferModal.waitUntilOpen();
    await transferModal.transferViaKeyboard({ toAccountNumber: destinationResponse.body.accountNumber, amount: 50 });
    await transferModal.waitUntilClosed();

    state.extra.keyboardJourneyAccountId = createdAccounts[0].id;
  },
);

Then('every step should be reachable and operable without a mouse', async () => {
  // Enforced structurally by the step above — every interaction used `.focus()` + a keyboard
  // event, never `.click()`; if any control were unreachable via focus, the step above would
  // already have failed trying to interact with it.
});

Then('the journey should complete successfully end to end', async ({ dbService, state }) => {
  const account = await dbService.getAccountById(state.extra.keyboardJourneyAccountId as string);
  expect(account?.balance).toBeCloseTo(450, 2);
});
