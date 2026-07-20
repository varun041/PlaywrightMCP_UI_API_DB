# Business Capability: Fund Transfer
# Covers transferring funds between two accounts and the resulting transaction records.
# Consolidates: POS-18, POS-19, NEG-15..21, BND-05..08, BR-04..07, VAL-06,
# INT-02, A11Y-03 (Transfer Funds modal portion) from TestScenarios.md
# Note: BR-04, BR-05, and BR-06 are verified within the relevant negative
# scenarios below (inactive accounts, insufficient funds, same-account
# transfer) rather than as separate scenario blocks.
# Test data: testdata/fund_transfer.yml

Feature: Fund Transfer
  As a bank staff user
  I want to transfer funds between two accounts
  So that customers' money movement requests are processed accurately

  Background:
    Given I am logged in as a registered bank staff user
    And a source account exists with a known balance
    And a destination account exists with a known account number

  @Smoke @Regression @UI @API @Positive @Integration @DB
  Scenario: Transfer funds successfully between two active accounts
    Given the source account has sufficient balance for the transfer
    When I transfer an amount from the source account to the destination account number
    Then the transfer should complete successfully
    And the source account balance should decrease by the transferred amount
    And the destination account balance should increase by the transferred amount
    And both accounts and the transaction history should agree via the API, the database, and the UI

  @Regression @UI @Positive
  Scenario: The UI reflects updated balances and transactions immediately after a transfer
    Given the source account has sufficient balance for the transfer
    When I transfer an amount from the source account to the destination account number
    Then the customer details screen should show the updated balances and new transaction entries without a manual page reload

  @Regression @API @Negative @Validation
  Scenario: Transfer fails when required fields are missing
    When I submit a transfer without providing a "destination account number"
    Then the request should be rejected with status 400

  @Regression @API @Negative
  Scenario: Transfer fails when the source account does not exist
    When I transfer funds from a non-existent source account identifier
    Then the request should be rejected with status 404

  @Regression @API @Negative
  Scenario: Transfer fails when the destination account number does not exist
    When I transfer funds to a destination account number that does not exist
    Then the request should be rejected with status 404

  @Regression @API @Negative @BusinessRule
  Scenario: Transfer fails when the source and destination accounts are the same
    When I transfer funds from an account to itself
    Then the request should be rejected with status 400
    And the response should indicate that transfers to the same account are not allowed

  @Regression @API @Negative @BusinessRule
  Scenario: Transfer fails when the source account balance is insufficient
    Given the source account balance is less than the transfer amount
    When I transfer funds exceeding the source account's balance
    Then the request should be rejected with status 400
    And the response should indicate insufficient funds
    And no balance change should occur on either account

  @Regression @API @Negative @BusinessRule
  Scenario: Transfer fails when either account is inactive
    Given either the source or destination account has an "INACTIVE" status
    When I attempt to transfer funds between them
    Then the request should be rejected with status 400
    And the response should indicate both accounts must be active

  @Regression @API @Negative
  Scenario: Transfer fails when the amount is zero or negative
    When I transfer a zero or negative amount between two active accounts
    Then the request should be rejected with status 400

  @Regression @API @Boundary
  Scenario Outline: Transfer amount at the balance boundary
    Given the source account balance is set using test data "<testCaseId>"
    When I transfer an amount using test data "<testCaseId>"
    Then the transfer outcome should match test data "<testCaseId>"

    Examples:
      | testCaseId |
      | BND-05     |
      | BND-06     |

  @Regression @API @Boundary
  Scenario: Transfer amount with more than two decimal places is handled predictably
    When I transfer an amount using test data "BND-07"
    Then the resulting balances should reflect the transferred amount within an acceptable rounding tolerance

  @Regression @API @Boundary
  Scenario: The minimum positive transfer amount is processed correctly
    When I transfer an amount using test data "BND-08"
    Then both account balances should be adjusted by exactly that amount

  @Regression @API @BusinessRule @DB
  Scenario: A completed transfer creates two linked transaction records
    When I transfer funds between two active accounts
    Then a transaction record should be created against the source account
    And a transaction record should be created against the destination account
    And both transaction records should share the same reference value

  @Regression @API @Validation
  Scenario: Transfer fails when the amount is not a valid number
    When I submit a transfer with a non-numeric amount value
    Then the request should be rejected with status 400

  @Regression @UI @Accessibility
  Scenario: The Transfer Funds form is accessible
    When I run an automated accessibility scan on the Transfer Funds form
    Then no critical or serious accessibility violations should be found
