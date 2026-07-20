import { execSync } from 'child_process';
import net from 'net';
import { Logger } from '@utils/Logger';

const logger = Logger.forScope('ProcessUtils');

export class ProcessUtils {
  /**
   * Asks the OS for an ephemeral port by binding to port 0 and reading back what it assigned, then
   * releasing it immediately. Used to spawn isolated backend instances (system-health/security
   * scenarios) without hardcoding a port that could collide with another isolated instance or the
   * shared test-run backend under `fullyParallel: true`.
   */
  static async getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          reject(new Error('ProcessUtils.getFreePort: could not determine an assigned port'));
          return;
        }
        const { port } = address;
        server.close(() => resolve(port));
      });
    });
  }

  /**
   * Kills a process and, on Windows, its full child tree — `npm run dev`/`node server.js` spawn
   * nested processes that a plain `process.kill()` can leave orphaned after a test run.
   */
  static killTree(pid: number | undefined): void {
    if (pid === undefined) {
      return;
    }
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-pid, 'SIGTERM');
      }
      logger.info('Killed process tree', { pid });
    } catch (error) {
      logger.warn('Failed to kill process (it may already be stopped)', { pid, error: String(error) });
    }
  }

  /**
   * Kills whatever is already listening on `port`. A prior run's backend/frontend can survive its
   * own `globalTeardown` (e.g. the run was force-stopped instead of finishing normally) and keep
   * holding the port. If left alone, the next `globalSetup` spawns a new process that fails to bind
   * (EADDRINUSE) and dies, while the health check keeps polling and silently passes against the
   * *orphan* instead — every API call in that run then hits the orphan's stale DB file while
   * `DbService` reads the fresh per-run copy, so writes and reads silently diverge. Called
   * proactively before every spawn so a leaked process can't poison the next run.
   */
  static killProcessOnPort(port: number): void {
    try {
      const pids = new Set<string>();
      if (process.platform === 'win32') {
        const output = execSync('netstat -ano -p tcp', { encoding: 'utf-8' });
        for (const line of output.split('\n')) {
          if (line.includes(`:${port} `) && line.includes('LISTENING')) {
            const pid = line.trim().split(/\s+/).pop();
            if (pid) {
              pids.add(pid);
            }
          }
        }
      } else {
        const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf-8' });
        for (const pid of output.split('\n').map((line) => line.trim()).filter(Boolean)) {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        logger.warn('Killing stale process occupying port before spawn', { port, pid });
        ProcessUtils.killTree(Number(pid));
      }
    } catch {
      // No process currently owns the port — nothing to clean up.
    }
  }
}
