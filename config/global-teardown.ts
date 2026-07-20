import fs from 'fs';
import path from 'path';
import { FilePaths } from '@constants/filePaths';
import { ProcessUtils } from '@utils/ProcessUtils';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('global-teardown');

interface RunState {
  backendPid?: number;
  frontendPid?: number;
  runtimeDbPath: string;
}

function readRunState(): RunState | undefined {
  const statePath = path.join(FilePaths.RUNTIME_DB_DIR, 'run-state.json');
  if (!fs.existsSync(statePath)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as RunState;
}

/** Stops the backend/frontend processes global-setup spawned and discards the isolated DB working copy. */
export default async function globalTeardown(): Promise<void> {
  const state = readRunState();
  if (!state) {
    logger.warn('No run-state.json found — nothing to tear down');
    return;
  }

  ProcessUtils.killTree(state.backendPid);
  ProcessUtils.killTree(state.frontendPid);

  if (fs.existsSync(state.runtimeDbPath)) {
    fs.rmSync(state.runtimeDbPath, { force: true });
  }
  for (const suffix of ['-shm', '-wal']) {
    const sidecarPath = `${state.runtimeDbPath}${suffix}`;
    if (fs.existsSync(sidecarPath)) {
      fs.rmSync(sidecarPath, { force: true });
    }
  }

  logger.info('Global teardown complete', { ...state });
}
