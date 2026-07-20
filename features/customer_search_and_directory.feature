# Business Capability: Customer Search & Directory
# Covers listing, searching, and paginating the customer directory.
# Consolidates: POS-03..06, NEG-22, BND-01..04, BND-11, BND-12, A11Y-02,
# PERF-01, PERF-02, PERF-04 from TestScenarios.md
# Test data: testdata/customer_search_and_directory.yml

Feature: Customer Search and Directory
  As a bank staff user
  I want to list and search customers
  So that I can quickly find the customer I need to work with

  Background:
    Given I am logged in as a registered bank staff user
    And the customer directory contains a representative set of seeded customers

  @Smoke @Regression @UI @API @Positive
  Scenario: List customers with default pagination
    When I request the customer list with default pagination
    Then a page of customers and the total customer count should be returned

  @Regression @UI @API @Positive
  Scenario: Search customers by name or email using the default filter
    When I search for customers using a name that matches an existing customer
    Then the matching customer should appear in the results

  @Regression @UI @API @Positive
  Scenario: Search customers filtered by email
    When I search for customers using the email filter with a known customer's email
    Then only customers matching that email should be returned

  @Regression @UI @API @Positive
  Scenario: Search customers filtered by phone number
    When I search for customers using the phone filter with a known customer's phone number
    Then only customers matching that phone number should be returned

  @Regression @API @Negative @Validation
  Scenario: Search fails when no query is provided
    When I search for customers without providing a query
    Then the request should be rejected with status 400

  @Regression @API @Boundary @KnownGap
  Scenario: Requesting the customer list with a limit of zero falls back to the default page size
    When I request the customer list with a limit of zero
    Then the current behavior returns the default page size instead of an empty page
    And this should be flagged as a boundary-handling gap

  @Regression @API @Boundary
  Scenario: Requesting the customer list with a limit of one returns exactly one customer
    When I request the customer list with a limit of one
    Then exactly one customer should be returned

  @Regression @API @Boundary @PerformanceSmoke
  Scenario: Requesting the customer list with a very large limit still responds successfully
    When I request the customer list with a very large limit value
    Then all matching customers should be returned without a server error
    And the response time should be recorded for performance tracking

  @Regression @API @Boundary
  Scenario: Requesting the customer list beyond the total record count returns an empty page
    When I request the customer list with an offset beyond the total number of customers
    Then an empty list should be returned without an error

  @Regression @API @Boundary
  Scenario: Searching with a single-character query returns broad matches without error
    When I search for customers using a single-character query
    Then broadly matching results should be returned without an error

  @Regression @API @Boundary @Security
  Scenario: Searching with SQL wildcard characters treats them as literal characters
    When I search for customers using test data "BND-12"
    Then those characters should be treated as literal search characters, not SQL wildcards with unintended effect

  @Regression @UI @Accessibility
  Scenario: The customer list and customer details screens are accessible
    When I run an automated accessibility scan on the customer list and customer details screens
    Then no critical or serious accessibility violations should be found

  @Regression @API @PerformanceSmoke
  Scenario: Listing customers responds within an acceptable time under seeded data volume
    When I request the customer list against the seeded dataset
    Then the response should complete within the agreed performance threshold

  @Regression @API @PerformanceSmoke
  Scenario: Searching customers responds within an acceptable time under seeded data volume
    When I search customers with a broad query against the seeded dataset
    Then the response should complete within the agreed performance threshold

  @Regression @API @PerformanceSmoke @Boundary
  Scenario: Listing customers with a very large limit under load is measured, not assumed
    When I request the customer list with a very large limit under light concurrent load
    Then the response time degradation, if any, should be measured and documented
