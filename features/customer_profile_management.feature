# Business Capability: Customer Profile Management
# Covers creating, viewing, updating, and deleting individual customer records.
# Consolidates: POS-07..11, NEG-08..11, VAL-01..03, BND-13, BND-14, BR-03,
# INT-05, RETRY-02, A11Y-03 (Add Customer modal portion) from TestScenarios.md
# Test data: testdata/customer_profile_management.yml

Feature: Customer Profile Management
  As a bank staff user
  I want to create, view, update, and delete customer records
  So that I can maintain accurate customer information

  Background:
    Given I am logged in as a registered bank staff user

  @Smoke @Regression @UI @API @Positive
  Scenario: View a customer's profile details
    Given a customer record exists
    When I view that customer's profile
    Then their name, contact details, and address should be displayed correctly

  @Smoke @Regression @UI @API @Positive
  Scenario Outline: Create a new customer record
    When I create a new customer using test data "<testCaseId>"
    Then the customer should be created successfully
    And the customer should be retrievable with the details I provided

    Examples:
      | testCaseId |
      | POS-08     |
      | POS-09     |

  @Regression @UI @API @Positive
  Scenario: Update an existing customer's profile
    Given a customer record exists
    When I update the customer's phone number and address
    Then the customer's profile should reflect the updated details

  @Regression @UI @API @Positive
  Scenario: Delete a customer record
    Given a customer record exists with no accounts
    When I delete the customer
    Then the customer should no longer be retrievable

  @Regression @API @Negative @Validation
  Scenario: Customer creation fails when required fields are missing
    When I attempt to create a customer without providing a "last name"
    Then the request should be rejected with status 400
    And the response should indicate the missing required field

  @Regression @API @Negative
  Scenario: Viewing a customer by a non-existent identifier fails
    When I view a customer using an identifier that does not exist
    Then the request should be rejected with status 404

  @Regression @API @Negative @KnownGap
  Scenario: Updating a customer by a non-existent identifier does not raise a clear error
    When I update a customer using an identifier that does not exist
    Then the current response indicates success despite no matching record
    And this should be flagged as a gap requiring an existence check

  @Regression @API @Negative @KnownGap
  Scenario: Deleting a customer by a non-existent identifier does not raise a clear error
    When I delete a customer using an identifier that does not exist
    Then the current response indicates success despite no matching record
    And this should be flagged as a gap requiring an existence check

  @Regression @API @Validation @KnownGap
  Scenario Outline: Customer email is accepted without format or length validation
    When I create a customer using test data "<testCaseId>"
    Then the customer is currently created successfully regardless of email format or length
    And this should be flagged as a missing validation requirement

    Examples:
      | testCaseId |
      | VAL-01     |
      | BND-14     |

  @Regression @API @Validation @KnownGap
  Scenario: Customer phone number is accepted without format validation
    When I create a customer using test data "VAL-02"
    Then the customer is currently created successfully
    And this should be flagged as a missing validation requirement

  @Regression @API @Validation @KnownGap
  Scenario: Customer date of birth is accepted without format validation
    When I create a customer using test data "VAL-03"
    Then the customer is currently created successfully
    And this should be flagged as a missing validation requirement

  @Regression @API @Boundary
  Scenario: Customer is created successfully with all optional fields left empty
    When I create a customer providing only the required fields and leaving phone and address empty
    Then the customer should be created successfully with the optional fields stored as empty or null

  @Regression @API @BusinessRule @Integration @DB @KnownGap
  Scenario: Deleting a customer does not remove their accounts or transactions
    Given a customer exists with an account that has transaction history
    When I delete the customer
    Then the customer record should no longer be retrievable
    But the customer's accounts and transactions should still exist in the database
    And this should be flagged as an orphaned-data risk

  @Regression @API @Retry @KnownGap
  Scenario: Retrying a customer creation request after a timeout fails with an unhandled server error
    When I submit a request to create a customer and retry it after a timeout, without the first request having failed
    Then the retry currently fails with an unhandled server error instead of a clean conflict response
    And this should be flagged as a missing idempotency safeguard

  @Regression @UI @Accessibility
  Scenario: The Add Customer form is accessible
    When I run an automated accessibility scan on the Add Customer form
    Then no critical or serious accessibility violations should be found