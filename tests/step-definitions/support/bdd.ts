import { createBdd } from 'playwright-bdd';
import { test as base, expect } from '@fixtures/index';
import { ApiResult } from '@services/ApiClient';
import { CustomerRecord, AccountRecord, TransactionRecord } from '@app-types/domain';

/**
 * Free-form, per-scenario scratch space. A fresh, isolated instance is created for every test
 * (Playwright fixture semantics), so this is safe under full parallelism — no shared mutable state
 * across scenarios/workers. Every `*.steps.ts` file reads/writes through this same shape so a
 * "When" in one step and a "Then" in a shared common step (e.g. `the request should be rejected
 * with status {int}`) can agree on where the last result lives, without every file reinventing its
 * own local state shape.
 */
export interface ScenarioState {
  /**
   * Typed loosely (`ApiResult<any>`) deliberately: this field receives the result of whatever
   * service call a "When" step just made (each returning a differently-shaped `ApiResult<T>`), and
   * "Then" steps narrow it back down with their own local cast when they read it. Requiring every
   * assignment site to cast to one common shape added noise without adding safety.
   */
  lastApiResponse?: ApiResult<any>;
  capturedToken?: string;
  customer?: CustomerRecord;
  account?: AccountRecord;
  transactions?: TransactionRecord[];
  transferReference?: string;
  /** Scenario-specific values that don't warrant a first-class field above. */
  extra: Record<string, unknown>;
}

export const test = base.extend<{ state: ScenarioState }>({
  state: async ({}, use) => {
    await use({ extra: {} });
  },
});

/** The identity most recently registered/logged-in within the current scenario — set by `authentication.steps.ts`, read by any file (e.g. `session.steps.ts`) that needs "the account we just logged in as" without re-deriving a new one. */
export interface DerivedCredentials {
  username: string;
  password: string;
  email: string;
}

export function getLastRegisteredCredentials(state: ScenarioState): DerivedCredentials | undefined {
  return state.extra.lastRegisteredCredentials as DerivedCredentials | undefined;
}

export function setLastRegisteredCredentials(state: ScenarioState, credentials: DerivedCredentials): void {
  state.extra.lastRegisteredCredentials = credentials;
}

/**
 * The single `createBdd` call for the whole suite — every `*.steps.ts` file imports
 * `Given`/`When`/`Then` from here (never calls `createBdd` itself), so all step definitions across
 * all 10 feature files share one fixture universe and one step registry.
 */
export const { Given, When, Then } = createBdd(test);

export { expect };
