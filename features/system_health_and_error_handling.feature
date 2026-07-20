# Business Capability: System Health & Error Handling
# Covers operational diagnostics endpoints and the system's error-handling
# behavior across the API and UI.
# Consolidates: POS-21, POS-22, ERR-01..06, VAL-07, VAL-08 (duplicate of
# ERR-06), RECOV-02..04 from TestScenarios.md
# Test data: testdata/system_health_and_error_handling.yml (no literals today)

Feature: System Health and Error Handling
  As a system operator
  I want to verify system health endpoints and consistent error handling
  So that failures are diagnosable and never expose sensitive internals

  @Smoke @Regression @API @Positive
  Scenario: The health check endpoint reports the system is running
    When I call the health check endpoint
    Then it should respond successfully indicating the API is running

  @Regression @API @Positive
  Scenario: The routes introspection endpoint lists available API routes
    When I call the routes introspection endpoint
    Then it should return the list of registered API routes

  @Regression @API @ErrorHandling
  Scenario: All API error responses follow a consistent structure
    Given I am logged in as a registered bank staff user
    When any request results in an error across the API
    Then the error response should consistently contain a single, clear error message field

  @Regression @API @ErrorHandling
  Scenario: An unexpected server-side failure is handled without crashing the service
    Given I am logged in as a registered bank staff user
    When an unexpected server-side failure occurs while processing a request
    Then the API should respond with a server error status rather than crashing
    And the service should remain available for subsequent requests

  @Regression @API @ErrorHandling @Security
  Scenario: Error responses do not leak internal implementation details
    Given I am logged in as a registered bank staff user
    When a request results in a server error
    Then the response should not contain a stack trace or other internal implementation details

  @Regression @UI @ErrorHandling
  Scenario: The UI surfaces API error messages to the user
    Given I am logged in as a registered bank staff user
    When an action I perform in the UI fails at the API level
    Then the UI should display the corresponding error message to me

  @Regression @UI @ErrorHandling
  Scenario: The UI handles complete API unavailability gracefully
    Given I am using the application
    When the backend API becomes completely unavailable
    Then the UI should present a clear failure state instead of an unresponsive or blank screen

  @Regression @API @Validation
  Scenario: A request missing the expected content type header is handled predictably
    Given I am logged in as a registered bank staff user
    When I submit a request without the expected content type header
    Then the request should be handled predictably without an unhandled server error

  @Regression @API @Recovery @DB
  Scenario: Previously persisted data survives a backend restart
    Given data has been created and persisted before a backend restart
    When the backend process restarts
    Then all previously persisted data should remain intact and accessible

  @Regression @UI @Recovery @KnownGap
  Scenario: The frontend recovers gracefully after the backend restarts mid-session
    Given I am using the application when the backend restarts
    When I perform an action immediately after the restart
    Then the action should either succeed or present a clear, retryable error rather than hanging indefinitely

  @Regression @API @Recovery @DB
  Scenario: Concurrent writes that trigger database lock contention are handled without crashing
    Given multiple write operations are submitted to the database at the same time
    When a database lock contention occurs
    Then the affected request should receive a handled error response
    And the backend process should remain running
