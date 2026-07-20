import { ChildProcess, spawn } from 'child_process';
import { FilePaths } from '@constants/filePaths';
import { Timeouts } from '@constants/timeouts';
import { Logger } from '@utils/Logger';
import { ProcessUtils } from '@utils/ProcessUtils';

const logger = Logger.forScope('BackendProcessManager');

export interface BackendHandle {
  process: ChildProcess;
  port: number;
  baseUrl: string;
  stop(): Promise<void>;
}

export interface SpawnBackendOptions {
  port: number;
  dbPath: string;
  /** Explicit env overrides applied after inheriting the current process's env. */
  env?: Record<string, string>;
  /** Keys to strip from the inherited env before applying `env` — e.g. omit `JWT_SECRET` entirely so the backend falls back to its own hardcoded default (SEC-10/AUTHN-06 scenario). */
  omitEnvKeys?: string[];
}

/**
 * Spawns/stops a `banking-app/backend` instance. Used once by `config/global-setup.ts` for the
 * shared test-run backend, and again by the "hardcoded JWT secret fallback" security scenario,
 * which needs its own isolated instance with `JWT_SECRET` deliberately absent — decoupled from the
 * shared instance so it can't affect any other test's tokens.
 */
export class BackendProcessManager {
  static async spawn(options: SpawnBackendOptions): Promise<BackendHandle> {
    const inheritedEnv: Record<string, string | undefined> = { ...process.env };
    for (const key of options.omitEnvKeys ?? []) {
      // Blank rather than `delete`: server.js calls `dotenv.config()` on startup, which only skips
      // keys already present in the child's env. A deleted key is "absent" from dotenv's point of
      // view, so it gets silently reloaded from backend/.env — defeating the omission. An empty
      // string counts as "already set" (dotenv leaves it alone) while still being falsy for the
      // app's own `process.env.X || <default>` fallback checks.
      inheritedEnv[key] = '';
    }

    const child = spawn('node', ['server.js'], {
      cwd: FilePaths.BACKEND_DIR,
      env: {
        ...inheritedEnv,
        PORT: String(options.port),
        DB_PATH: options.dbPath,
        ...options.env,
      },
      stdio: 'ignore',
      detached: process.platform !== 'win32',
    });
    logger.info('Spawned backend process', { pid: child.pid, port: options.port, dbPath: options.dbPath });

    const baseUrl = `http://localhost:${options.port}`;
    await BackendProcessManager.waitForHealthy(`${baseUrl}/api/health`);

    return {
      process: child,
      port: options.port,
      baseUrl,
      stop: async () => ProcessUtils.killTree(child.pid),
    };
  }

  static async waitForHealthy(url: string): Promise<void> {
    const deadline = Date.now() + Timeouts.HEALTH_CHECK_TIMEOUT_MS;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, Timeouts.HEALTH_CHECK_POLL_INTERVAL_MS));
    }
    throw new Error(
      `BackendProcessManager: ${url} did not become healthy within ${Timeouts.HEALTH_CHECK_TIMEOUT_MS}ms (${String(lastError)})`,
    );
  }
}
