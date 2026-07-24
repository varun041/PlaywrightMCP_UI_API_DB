/**
 * Runs `playwright test` (forwarding any CLI args, e.g. --grep @UI), then always
 * regenerates the Allure report from reports/allure-results — pass or fail — so a
 * failed run still produces a report instead of silently skipping it (which is
 * what `&&`-chained npm scripts would do). Locally the report is opened in the
 * browser; in CI it's just generated so it can be uploaded as a build artifact.
 *
 * Before generating, also runs generate-run-summary.js, which injects a plain-English
 * "AI Run Summary" entry into the results (pass/fail counts, and new regressions vs.
 * already-tracked @KnownGap failures) so that summary is visible inside the report itself.
 * generate-healing-report.js similarly attaches an "AI Healing Report" entry whenever
 * reports/healing-report.md exists (written after a playwright-test-healer run) — a no-op
 * otherwise.
 */
const { spawnSync, spawn } = require('child_process');

const args = process.argv.slice(2);
const isCI = !!process.env.CI;

function run(command, commandArgs, extraOptions) {
  return spawnSync(command, commandArgs, { stdio: 'inherit', shell: true, ...extraOptions });
}

const runStartMs = Date.now();
const testRun = run('npx', ['playwright', 'test', ...args]);

// Passing the invocation's own start time lets generate-run-summary.js identify exactly which
// result files belong to this run (by file mtime) instead of guessing via a time-window heuristic —
// otherwise closely-spaced manual reruns (e.g. iterating on a fix within a few minutes) can get
// conflated into one summary.
run('node', ['scripts/generate-run-summary.js'], { env: { ...process.env, RUN_SUMMARY_SINCE_MS: String(runStartMs) } });
run('node', ['scripts/generate-healing-report.js']);

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
