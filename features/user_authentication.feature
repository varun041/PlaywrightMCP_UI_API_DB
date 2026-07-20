# Business Capability: User Authentication
# Covers registration, login, and logout for bank staff users.
# Consolidates: POS-01, POS-02, POS-20, NEG-01..05, SEC-04, SEC-05, SEC-06,
# RETRY-04, A11Y-01, A11Y-05, A11Y-06 (from TestScenarios.md)
# Test data: testdata/user_authentication.yml

Feature: User Authentication
  As a bank staff user
  I want to register and log in to the system
  So that I can securely access customer and account management features

  @Smoke @Regression @API @Positive @login
  Scenario: Register a new bank staff user with valid details
    When I register a new user using test data "POS-01"
    Then the registration should succeed with status 201
    And a JWT access token should be returned
    And the stored password should be securely hashed, not stored in plain text

  @Regression @API @Negative
  Scenario: Registration is rejected when the username already exists
    Given a bank staff user is already registered using test data "NEG-01"
    When I register a new user using test data "NEG-01"
    Then the registration should be rejected with status 409
    And the response should contain an error message indicating the username already exists

  @Regression @API @Negative @Validation
  Scenario: Registration is rejected when required fields are missing
    When I register a new user without providing a "password"
    Then the registration should be rejected with status 400
    And the response should contain an error message indicating missing required fields

  @Smoke @Regression @API @Positive
  Scenario: Log in with valid credentials
    Given I am registered as a bank staff user using test data "POS-01"
    When I log in using test data "POS-01"
    Then the login should succeed with status 200
    And a JWT access token should be returned

  @Regression @API @Negative
  Scenario: Login is rejected with an incorrect password
    Given I am registered as a bank staff user using test data "POS-01"
    When I log in using test data "NEG-03"
    Then the login should be rejected with status 401
    And the response should contain an error message indicating invalid credentials

  @Regression @API @Negative
  Scenario: Login is rejected for a non-existent username
    When I log in using test data "NEG-04"
    Then the login should be rejected with status 401
    And the response should contain an error message indicating invalid credentials

  @Regression @API @Negative @Validation
  Scenario: Login is rejected when username or password is missing
    When I log in without providing a "password"
    Then the login should be rejected with status 400
    And the response should contain an error message indicating missing required fields

  @Regression @API @Security @KnownGap
  Scenario: Repeated failed login attempts against one username are not rate-limited
    Given I am registered as a bank staff user using test data "POS-01"
    When I repeatedly attempt to log in with an incorrect password using test data "SEC-06"
    Then each attempt should be independently rejected with status 401
    And no account lockout or throttling should currently be observed

  @Regression @API @Retry
  Scenario: Retrying a login request after a network timeout is safe
    Given I am registered as a bank staff user using test data "POS-01"
    When I log in using test data "POS-01" and the request is retried after a timeout
    Then only one valid session token per attempt should be issued
    And no unintended side effects should occur from the retry

  @Regression @API @Security
  Scenario: The password is never present in the registration or login response
    Given I am registered as a bank staff user using test data "POS-01"
    When I log in using test data "POS-01"
    Then the response body should not contain the password in any form

  @Regression @API @Security @DB
  Scenario: The stored password is a securely hashed value
    Given I am registered as a bank staff user using test data "POS-01"
    When I inspect the stored user record directly in the database
    Then the password field should contain a bcrypt hash, not the plain-text password

  @Smoke @Regression @UI @Positive
  Scenario: Log out clears the active session on the client
    Given I am logged in as a registered bank staff user
    When I log out
    Then I should be returned to the login screen
    And my session token should no longer be used by the application

  @Regression @UI @Accessibility
  Scenario: The login and registration form is accessible
    When I run an automated accessibility scan on the login/registration screen
    Then no critical or serious accessibility violations should be found

  @Regression @UI @Accessibility
  Scenario: Error banners and action buttons meet color contrast requirements
    When I run an automated accessibility scan focused on color contrast on the login screen
    Then all error banners and buttons should meet WCAG AA contrast requirements

  @Regression @UI @Accessibility
  Scenario: Login validation errors are announced to assistive technology
    Given I am on the login screen
    When I submit the login form with missing credentials
    Then the validation error should be exposed in a way that assistive technology can announce