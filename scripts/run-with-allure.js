/**
 * Runs `playwright test` (forwarding any CLI args, e.g. --grep @UI), then always
 * regenerates the Allure report from reports/allure-results — pass or fail — so a
 * failed run still produces a report instead of silently skipping it (which is
 * what `&&`-chained npm scripts would do). Locally the report is opened in the
 * browser; in CI it's just generated so it can be uploaded as a build artifact.
 */
const { spawnSync, spawn } = require('child_process');

const args = process.argv.slice(2);
const isCI = !!process.env.CI;

function run(command, commandArgs) {
  return spawnSync(command, commandArgs, { stdio: 'inherit', shell: true });
}

const testRun = run('npx', ['playwright', 'test', ...args]);

const generate = run('npx', [
  'allure',
  'generate',
  'reports/allure-results',
  '--clean',
  '-o',
  'reports/allure',
]);

if (!isCI && generate.status === 0) {
  // `allure open` starts a long-running local preview server rather than exiting, so it's
  // launched detached/unref'd instead of via the blocking `run()` helper above — otherwise this
  // script (and anything waiting on it, e.g. `npm run test:ui`) would hang forever after the
  // report finishes generating.
  spawn('npx', ['allure', 'open', 'reports/allure'], {
    stdio: 'ignore',
    shell: true,
    detached: true,
  }).unref();
}

process.exit(testRun.status ?? 1);
