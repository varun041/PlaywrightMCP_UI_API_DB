# Business Capability: End-to-End Customer Banking Journey
# Covers holistic, cross-capability user journeys spanning authentication,
# customer management, account management, and fund transfer together.
# Intentionally kept small and curated per AutomationTestPlan.md section 6.5
# (E2E suites should stay small/curated, not duplicate lower-layer coverage).
# Consolidates: A11Y-04 from TestScenarios.md. This file is the designated
# home for future cross-capability journey scenarios as the suite matures.
# Test data: testdata/end_to_end_customer_banking_journey.yml (no literals today)

Feature: End-to-End Customer Banking Journey
  As a bank staff user
  I want to complete a full customer banking journey using only the keyboard
  So that the application remains usable end-to-end without a mouse

  Background:
    Given I am logged in as a registered bank staff user

  # @slow: this scenario drives an entire add-customer -> add-account -> transfer-funds journey
  # through real keyboard events (never `.fill()`/`.click()`), which is inherently slower than the
  # single-action scenarios elsewhere in the suite, and it's a full page reload/login plus five
  # backend round trips before the keyboard-only work even starts. Under full parallelism (workers
  # contending for the one shared backend process) the default 30s test timeout is too tight for
  # this scenario specifically even though the app itself isn't slow — @slow triples it via
  # playwright-bdd's tag-to-`test.slow()` mapping (see node_modules/playwright-bdd's SpecialTags).
  @Regression @E2E @UI @Accessibility @slow
  Scenario: Complete an add-customer, add-account, and transfer-funds journey using only the keyboard
    When I navigate the entire flow of adding a customer, adding an account, and transferring funds using only the keyboard
    Then every step should be reachable and operable without a mouse
    And the journey should complete successfully end to end
