import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { FilePaths } from '@constants/filePaths';
import { Urls } from '@constants/urls';
import { BackendProcessManager } from '@utils/BackendProcessManager';
import { ProcessUtils } from '@utils/ProcessUtils';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('global-setup');

/** Copies the checked-in seed DB to a fresh per-run working copy — the seed file itself is never mutated. */
function copySeedDatabase(): string {
  fs.mkdirSync(FilePaths.RUNTIME_DB_DIR, { recursive: true });
  const runtimeDbPath = path.join(FilePaths.RUNTIME_DB_DIR, `banking-${Date.now()}.db`);
  fs.copyFileSync(FilePaths.SEED_DB_PATH, runtimeDbPath);
  logger.info('Copied seed DB to isolated working copy', { runtimeDbPath });
  return runtimeDbPath;
}

function spawnFrontend(): number | undefined {
  // On Windows, npm resolves to npm.cmd, a shell script — spawn() must run it through a shell
  // (spawning a .cmd directly without shell:true fails with EINVAL).
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: FilePaths.FRONTEND_DIR,
    env: { ...process.env },
    stdio: 'ignore',
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
  });
  logger.info('Spawned frontend process', { pid: child.pid });
  return child.pid;
}

interface RunState {
  backendPid?: number;
  frontendPid?: number;
  runtimeDbPath: string;
}

function writeRunState(state: RunState): void {
  fs.writeFileSync(path.join(FilePaths.RUNTIME_DB_DIR, 'run-state.json'), JSON.stringify(state, null, 2));
}

/**
 * Boots the isolated test environment once per run: copies the seed DB, launches the backend
 * against that copy (so `@DB` assertions and the API operate on the same file — see
 * PlaywrightAutomationArchitecture.md §6 / the plan's "critical environment gap" note), launches
 * the frontend, and waits for both to report healthy before any test/fixture runs. PIDs are
 * persisted to disk (not just in-memory) so `global-teardown.ts` can clean up reliably even across
 * process boundaries.
 */
export default async function globalSetup(): Promise<void> {
  const runtimeDbPath = copySeedDatabase();
  process.env.RUNTIME_DB_PATH = runtimeDbPath;

  const backendPort = Number(process.env.BACKEND_PORT ?? 3000);
  const frontendPort = Number(new URL(Urls.FRONTEND_BASE_URL).port || 80);

  // A leaked process from a prior run (e.g. force-stopped instead of finishing normally) can still
  // hold these ports. If left running, the health check below would pass against that orphan
  // instead of the process spawned here, silently pointing every API call at a stale DB file — see
  // ProcessUtils.killProcessOnPort for the full failure mode.
  ProcessUtils.killProcessOnPort(backendPort);
  ProcessUtils.killProcessOnPort(frontendPort);

  const backend = await BackendProcessManager.spawn({
    port: backendPort,
    dbPath: runtimeDbPath,
    env: { JWT_SECRET: process.env.JWT_SECRET ?? 'local_test_jwt_secret_key' },
  });
  logger.info('Backend healthy', { pid: backend.process.pid, baseUrl: backend.baseUrl });

  const frontendPid = spawnFrontend();
  await BackendProcessManager.waitForHealthy(Urls.FRONTEND_BASE_URL);
  logger.info('Frontend healthy', { pid: frontendPid, baseUrl: Urls.FRONTEND_BASE_URL });

  writeRunState({ backendPid: backend.process.pid, frontendPid, runtimeDbPath });
}
