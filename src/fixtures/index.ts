/**
 * Composition root. `db.fixtures` -> `api.fixtures` -> `auth.fixtures` -> `page.fixtures` ->
 * `data.fixtures` chain via sequential `.extend()` calls (each file imports the previous file's
 * `test` and extends it), so every fixture's dependencies are declared and typed by Playwright
 * automatically. Every step definition imports `test`/`expect` from this module — never
 * `@playwright/test` directly — so the registered custom matchers (src/assertions) and every
 * fixture below are always available.
 *
 * `testData` is deliberately NOT a fixture: the `TestCaseId` a scenario needs is only known from
 * the Gherkin step text captured at runtime (e.g. `{string}` in `using test data "{string}"`), so
 * step definitions call the appropriate `TestData.<feature>.get(testCaseId)` loader
 * (`@utils/TestDataLoader`) directly — those loaders are already singleton, cached-per-file
 * instances, which gives the same "single instantiation point" benefit a fixture would.
 */
export { test } from '@fixtures/data.fixtures';
export { expect } from '@assertions/index';
export type { RegisteredUser } from '@fixtures/auth.fixtures';
