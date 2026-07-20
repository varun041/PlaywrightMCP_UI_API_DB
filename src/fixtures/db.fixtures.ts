// The fixture chain's root MUST extend playwright-bdd's own `test` (not `@playwright/test`'s
// directly) — playwright-bdd v9's `createBdd()` asserts the test it's given is a descendant of its
// own base test object. It re-exports all of Playwright's built-in fixtures unchanged, so this is
// otherwise a drop-in replacement.
import { test as base } from 'playwright-bdd';
import { DbService } from '@services/DbService';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('db.fixtures');

export interface DbWorkerFixtures {
  /** Scoped once per worker — global-setup has already pointed RUNTIME_DB_PATH at the isolated per-run DB copy. */
  dbService: DbService;
}

export const test = base.extend<{}, DbWorkerFixtures>({
  dbService: [
    async ({}, use) => {
      logger.info('Opening worker-scoped DbService');
      const service = new DbService();
      await use(service);
    },
    { scope: 'worker' },
  ],
});
