# Business Capability: Account Management
# Covers creating, viewing, and deleting accounts belonging to a customer.
# Consolidates: POS-12..17, NEG-12..14, VAL-04, VAL-05, BND-09, BND-10,
# BR-01, BR-02, BR-09, BR-10, CONC-02, RETRY-03, INT-01, INT-03,
# A11Y-03 (Add Account modal portion), A11Y-07 from TestScenarios.md
# Note: BR-01 (new accounts default to ACTIVE) and BR-09 (account number
# format) are verified as part of the account creation scenario below
# rather than as separate scenario blocks, to keep this file cohesive.
# Test data: testdata/account_management.yml

Feature: Account Management
  As a bank staff user
  I want to create, view, and delete accounts for a customer
  So that customers' banking products are accurately maintained

  Background:
    Given I am logged in as a registered bank staff user
    And a customer record exists

  @Smoke @Regression @UI @API @Positive @BusinessRule @Integration @DB
  Scenario Outline: Create a new account for a customer
    When I add a new account to the customer using test data "<testCaseId>"
    Then the account should be created successfully with status "ACTIVE"
    And the account should have a system-generated 10-digit account number
    And the new account should immediately be visible via the customer's account list, the API, and the database

    Examples:
      | testCaseId      |
      | POS-12           |
      | POS-13-SAVINGS   |
      | POS-13-BUSINESS  |
      | POS-13-CREDIT    |

  @Regression @UI @API @Positive @FirstCase
  Scenario: View all accounts for a customer
    Given the customer has one or more accounts
    When I view the customer's accounts
    Then all of the customer's accounts should be listed with their balances and statuses

  @Regression @UI @API @Positive
  Scenario: View all transactions across a customer's accounts
    Given the customer has an account with transaction history
    When I view the customer's transactions
    Then all transactions across the customer's accounts should be listed

  @Smoke @Regression @UI @API @Positive @Accessibility
  Scenario: Delete an account that has no transactions
    Given the customer has an account with no transactions
    When I delete the account, confirming the delete action
    Then the account should be removed successfully
    And the delete confirmation prompt should be operable via keyboard and assistive technology

  @Smoke @Regression @UI @API @Positive @BusinessRule @Integration @DB
  Scenario: Delete an account that has existing transactions
    Given the customer has an account with existing transaction history
    When I delete the account
    Then the account should be removed successfully
    And the account's transactions should also be removed
    And the account and its transactions should no longer appear via the API or the database

  @Regression @API @Negative
  Scenario: Creating an account for a non-existent customer fails
    When I attempt to add an account to a customer identifier that does not exist
    Then the request should be rejected with status 404

  @Regression @API @Negative @Validation
  Scenario: Creating an account without an account type fails
    When I attempt to add an account without providing an account type
    Then the request should be rejected with status 400

  @Regression @API @Negative
  Scenario: Deleting a non-existent account fails
    When I attempt to delete an account using an identifier that does not exist
    Then the request should be rejected with status 404

  @Regression @API @Validation @KnownGap
  Scenario Outline: Account creation accepts values outside the intended enumerations
    When I add an account using test data "<testCaseId>"
    Then the account is currently created successfully regardless of the unsupported value
    And this should be flagged as a missing validation requirement

    Examples:
      | testCaseId |
      | VAL-04     |
      | VAL-05     |

  @Regression @API @Boundary @KnownGap
  Scenario Outline: Account balance boundary values at creation
    When I add an account using test data "<testCaseId>"
    Then the account is currently created successfully with that balance
    And this should be documented against the account type's intended business rules

    Examples:
      | testCaseId |
      | BND-09     |
      | BND-10     |

  @Regression @API @BusinessRule @KnownGap
  Scenario: A CREDIT account is permitted to carry a negative balance
    Given the customer has a CREDIT account
    When the account balance is reduced below zero through a transaction
    Then the negative balance is currently accepted
    And this should be flagged pending a defined credit-limit business rule

  @Regression @API @Concurrency
  Scenario: Two simultaneous account creation requests for the same customer both succeed distinctly
    When I submit two account creation requests for the same customer at the same time
    Then both accounts should be created with distinct identifiers and account numbers

  @Regression @API @Retry @KnownGap
  Scenario: Retrying an account creation request after a timeout creates a duplicate account
    When I submit a request to add an account and retry it after a timeout, without the first request having failed
    Then two separate accounts are currently created
    And this should be flagged as a missing idempotency safeguard

  # @slow: this scan does a real login, an API-driven customer creation, a UI search + navigate to
  # that customer's details, an "Add Account" modal open, and then a full axe-core scan of that
  # modal — clearly more round trips than the single-action scenarios elsewhere in this file, and
  # under full parallelism (all workers sharing the one backend process) it was observed ranging
  # from ~15s up to and past the default 30s test timeout, causing intermittent failures unrelated
  # to the page/form itself. See @slow's effect via playwright-bdd's tag-to-`test.slow()` mapping.
  @Regression @UI @Accessibility @slow
  Scenario: The Add Account form is accessible
    When I run an automated accessibility scan on the Add Account form
    Then no critical or serious accessibility violations should be found