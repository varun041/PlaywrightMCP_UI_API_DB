# Business Capability: Security & Access Control
# Covers authorization boundaries and platform security hardening checks.
# Consolidates: AUTHZ-01..04, SEC-01, SEC-02, SEC-03, SEC-07, SEC-08, SEC-10
# (SEC-10 also represents AUTHN-06, a duplicate finding, from TestScenarios.md)
# Test data: testdata/security_and_access_control.yml

Feature: Security and Access Control
  As a system owner
  I want authorization boundaries and common security risks to be verified
  So that customer and account data is protected from unauthorized or malicious access

  @Regression @API @Authorization @KnownGap
  Scenario: A staff user can view a customer record created under a different user's session
    Given a customer was created while logged in using test data "AUTHZ-01"
    When I log in as a different staff user using test data "AUTHZ-01"
    And I view the customer created by the first staff user
    Then the request currently succeeds
    And this should be flagged as a missing ownership/tenancy control

  @Regression @API @Authorization @KnownGap
  Scenario: A staff user can delete a customer or account created under a different user's session
    Given an account was created while logged in using test data "AUTHZ-02"
    When I log in as a different staff user using test data "AUTHZ-02"
    And I delete the account created by the first staff user
    Then the request currently succeeds
    And this should be flagged as a missing ownership/tenancy control

  @Regression @API @Authorization @KnownGap
  Scenario: Any authenticated staff user can transfer funds regardless of who manages the accounts
    Given two accounts exist that were created by different staff users
    When I log in as a staff user unrelated to either account
    And I transfer funds between those two accounts
    Then the request currently succeeds
    And this should be flagged as a missing role-based access control

  @Regression @API @Authorization @KnownGap
  Scenario: Any authenticated staff user can perform destructive actions without an elevated role
    Given I am logged in as a registered bank staff user
    When I delete a customer record
    Then the request currently succeeds without any role check
    And this should be flagged as a missing role-based access control requirement

  @Regression @API @Security
  Scenario: A SQL-injection-style payload in a customer search query does not manipulate the database
    Given I am logged in as a registered bank staff user
    When I search for customers using a query containing a SQL-injection-style payload
    Then no unintended data should be returned or altered
    And the query should be treated as a literal search term

  @Regression @API @Security
  Scenario: A SQL-injection-style payload in customer creation fields is stored safely
    Given I am logged in as a registered bank staff user
    When I create a customer whose name field contains a SQL-injection-style payload
    Then the customer should be created with the value stored literally
    And no unintended database changes should occur

  @Regression @UI @Security
  Scenario: A script-injection payload in a customer's name is rendered safely in the UI
    Given a customer exists whose name field contains an embedded script payload
    When I view that customer's details in the UI
    Then the payload should be displayed as plain text
    And no script should execute in the browser

  @Regression @API @Security @KnownGap
  Scenario: The API accepts requests from an unrestricted set of origins
    When I call the API from an arbitrary, unapproved origin
    Then the request is currently accepted
    And this should be flagged as a pre-production hardening item

  @Regression @API @Security @Authorization @KnownGap
  Scenario: A customer or account can be accessed by guessing or incrementing its identifier
    Given I am logged in as a registered bank staff user
    When I request a customer or account by an identifier I did not create
    Then the request currently succeeds
    And this should be flagged as an insecure direct object reference risk

  @Regression @API @Security @KnownGap
  Scenario: The application falls back to a hardcoded default signing secret when none is configured
    Given the environment does not define a custom signing secret
    When a user logs in and a token is issued
    Then the token is currently signed using a hardcoded default secret
    And this should be flagged as a critical configuration risk requiring remediation before production use
