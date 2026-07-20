# Business Capability: Fund Transfer (Resilience & Reliability)
# Covers concurrency, retry-safety, crash-recovery, and performance smoke
# characteristics of the fund transfer capability. Kept as a separate,
# smaller feature file from the core transfer flow to keep each file
# focused on a single cohesive theme rather than diluting fund_transfer.feature.
# Consolidates: CONC-01, CONC-03, CONC-04, RETRY-01, RECOV-01, PERF-03
# from TestScenarios.md
# Test data: testdata/fund_transfer_resilience.yml (no literals today)

Feature: Fund Transfer Resilience and Reliability
  As a system owner
  I want the fund transfer capability to behave safely under concurrency, retries, and failures
  So that customers' money is never lost, duplicated, or left in an inconsistent state

  Background:
    Given I am logged in as a registered bank staff user

  @Regression @API @Concurrency @KnownGap
  Scenario: Two simultaneous transfers from the same account can combine to exceed its balance
    Given an account has a balance that covers only one of two simultaneous transfer requests
    When two transfer requests from that account are submitted at the same time
    Then the current implementation may allow both to succeed, overdrawing the account
    And this should be tracked as a known concurrency risk pending a fix decision

  @Regression @API @Concurrency @KnownGap
  Scenario: A transfer targeting an account that is simultaneously being deleted produces an inconsistent outcome
    Given a destination account is in the process of being deleted
    When a transfer to that account is submitted at the same time
    Then the outcome should be documented as a race condition risk

  @Regression @API @Concurrency
  Scenario: Concurrent read and write operations do not block each other unexpectedly
    Given multiple users are listing and searching customers
    When a transfer is submitted concurrently
    Then both the reads and the write should complete without user-facing lock errors

  @Regression @API @Retry @KnownGap
  Scenario: Retrying a transfer request after a timeout results in funds being moved twice
    Given a transfer request was submitted and the client did not receive a response before timing out
    When the client retries the same transfer request
    Then the current implementation processes the transfer twice
    And this should be tracked as a missing idempotency safeguard requiring remediation before production use

  @Regression @API @Recovery @KnownGap
  Scenario: A backend failure between debiting and crediting leaves the transfer inconsistent
    Given a transfer is in progress
    When the backend process fails after debiting the source account but before crediting the destination account
    Then the accounts are left in an inconsistent state
    And this should be tracked as a critical data-integrity risk requiring transactional safeguards
