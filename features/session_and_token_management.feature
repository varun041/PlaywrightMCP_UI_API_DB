# Business Capability: Session & Token Management
# Covers JWT issuance/validation mechanics and client-side session lifecycle.
# Consolidates: NEG-06, NEG-07, AUTHN-01..05, AUTHN-07, BR-08, SEC-09,
# SESS-01..05 (from TestScenarios.md)
# Test data: testdata/session_and_token_management.yml

Feature: Session and Token Management
  As the system
  I want to validate access tokens and manage user sessions correctly
  So that only properly authenticated requests can reach protected features

  @Smoke @Regression @API @Negative
  Scenario: A request without an authentication token is rejected
    When I call a protected endpoint without providing an authentication token
    Then the request should be rejected with status 401
    And the response should indicate an access token is required

  @Regression @API @Negative
  Scenario: A request with a malformed authentication token is rejected
    When I call a protected endpoint with a malformed authentication token
    Then the request should be rejected with status 403
    And the response should indicate the token is invalid or expired

  @Regression @API @Authentication
  Scenario: A valid login issues a well-formed access token
    Given I am logged in as a registered bank staff user
    Then the issued token should identify my user account
    And the token should have a future expiry time

  @Regression @API @Authentication @Security
  Scenario: A token signed with an incorrect secret is rejected
    When I call a protected endpoint using a token signed with an unexpected secret
    Then the request should be rejected with status 403

  @Regression @API @Authentication
  Scenario: An expired access token is rejected
    Given I hold an access token that has already expired
    When I call a protected endpoint using the expired token
    Then the request should be rejected with status 403

  @Regression @API @Authentication
  Scenario: A token submitted without the required "Bearer" prefix is rejected
    Given I am logged in as a registered bank staff user
    When I call a protected endpoint with the token sent without the "Bearer" prefix
    Then the request should be rejected

  @Regression @API @Authentication
  Scenario: A token submitted in a non-standard header is not recognized
    Given I am logged in as a registered bank staff user
    When I call a protected endpoint with the token placed in a non-standard header instead of "Authorization"
    Then the request should be rejected with status 401

  @Regression @API @Authentication
  Scenario: Multiple concurrent logins for the same user each produce an independently valid token
    Given I am registered as a bank staff user using test data "AUTHN-07"
    When I log in twice in a row with the same credentials
    Then both issued tokens should independently authorize protected requests

  @Regression @API @BusinessRule
  Scenario: An access token expires 24 hours after issuance
    Given I am logged in as a registered bank staff user
    When 24 hours have elapsed since the token was issued
    Then a request using that token should be rejected as expired

  @Regression @API @Authentication @Security
  Scenario: A token with a tampered payload but an unchanged signature is rejected
    Given I am logged in as a registered bank staff user
    When I call a protected endpoint using a token whose payload has been altered without re-signing
    Then the request should be rejected with status 403

  @Regression @UI @Session
  Scenario: Logging out clears the client-side session
    Given I am logged in as a registered bank staff user
    When I log out
    Then the application should show the login screen on the next protected action

  @Regression @API @Session @KnownGap
  Scenario: A token captured before logout remains valid against the API after client-side logout
    Given I am logged in as a registered bank staff user
    And I have captured my current access token
    When I log out of the application
    And I call a protected endpoint directly using the captured token
    Then the request should still succeed
    And this should be documented as a known session-revocation limitation

  @Regression @UI @Session
  Scenario: Refreshing the browser preserves the logged-in session
    Given I am logged in as a registered bank staff user
    When I refresh the browser page
    Then I should remain logged in without being asked to log in again

  @Regression @UI @Session
  Scenario: Two browser tabs share the same logged-in session
    Given I am logged in as a registered bank staff user in one browser tab
    When I open a second browser tab against the same application
    Then the second tab should also reflect a logged-in session

  @Regression @UI @Session @ErrorHandling
  Scenario: The application responds gracefully when a session becomes invalid mid-use
    Given I am logged in as a registered bank staff user
    When my session token becomes invalid while I am using the application
    And I attempt a protected action
    Then the application should present a clear message rather than fail silently
